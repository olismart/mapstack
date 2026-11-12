import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseKomootTourUrl } from '../src/utils/komoot';
import { getKomootRateLimitRetry } from './rateLimit';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_GPX_BYTES = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 20 * 1000;

interface KomootRequest extends IncomingMessage {
  /** Some serverless runtimes parse JSON before invoking the handler. */
  body?: unknown;
}

class ImportError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, payload: object) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

async function readIncomingBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new ImportError(413, 'The import request is too large.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function getRequestUrl(req: KomootRequest): Promise<string> {
  let body = req.body === undefined ? await readIncomingBody(req) : req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
      throw new ImportError(413, 'The import request is too large.');
    }
    try {
      body = JSON.parse(body);
    } catch {
      throw new ImportError(400, 'The import request must contain valid JSON.');
    }
  }
  if (!body || typeof body !== 'object' || typeof (body as { url?: unknown }).url !== 'string') {
    throw new ImportError(400, 'Provide a Komoot Tour URL.');
  }
  return (body as { url: string }).url;
}

function upstreamError(status: number): ImportError {
  if (status === 401 || status === 403) {
    return new ImportError(
      403,
      'Komoot denied access to this Tour. Check its sharing settings and copy a fresh Share link.',
    );
  }
  if (status === 404) return new ImportError(404, 'Komoot could not find this Tour.');
  if (status === 429) {
    return new ImportError(429, 'Komoot is receiving too many requests. Please try again shortly.');
  }
  return new ImportError(502, 'Komoot is unavailable right now. Please try again later.');
}

async function readUpstreamText(response: Response): Promise<string> {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_GPX_BYTES) {
    throw new ImportError(502, 'This Komoot GPX is too large to import.');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_GPX_BYTES) {
      await reader.cancel();
      throw new ImportError(502, 'This Komoot GPX is too large to import.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tourDetailsToGPX(payload: unknown): string {
  const tour = payload as {
    name?: unknown;
    _embedded?: { coordinates?: { items?: unknown } };
  };
  const items = tour?._embedded?.coordinates?.items;
  if (!Array.isArray(items)) {
    throw new ImportError(502, 'Komoot did not provide a usable route for this Tour.');
  }

  const points: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { lat, lng, alt } = item as { lat?: unknown; lng?: unknown; alt?: unknown };
    if (
      typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180
    ) {
      continue;
    }

    const elevation = typeof alt === 'number' && Number.isFinite(alt)
      ? `<ele>${alt}</ele>`
      : '';
    points.push(
      elevation
        ? `<trkpt lat="${lat}" lon="${lng}">${elevation}</trkpt>`
        : `<trkpt lat="${lat}" lon="${lng}" />`,
    );
  }

  if (points.length < 2) {
    throw new ImportError(502, 'Komoot did not provide enough coordinates for this Tour.');
  }

  const name = typeof tour.name === 'string' && tour.name.trim()
    ? tour.name.trim()
    : 'Komoot Route';
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mapstack Komoot Import" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>${escapeXml(name)}</name><trkseg>
    ${points.join('\n    ')}
  </trkseg></trk>
</gpx>`;
}

async function fetchKomootGPX(tourId: string, shareToken: string | undefined, signal: AbortSignal) {
  // These are Komoot's undocumented app endpoints; keep them isolated so upstream changes are easy to handle.
  const gpxUrl = new URL(`https://api.komoot.de/v007/tours/${tourId}.gpx`);
  if (shareToken) gpxUrl.searchParams.set('share_token', shareToken);

  const response = await fetch(gpxUrl, {
    headers: { Accept: 'application/gpx+xml, application/xml, text/xml' },
    redirect: 'error',
    signal,
  });

  if (response.ok) {
    const gpx = await readUpstreamText(response);
    if (!/<gpx(?:\s|>)/i.test(gpx.trimStart())) {
      throw new ImportError(502, 'Komoot returned an invalid GPX file. Try exporting it manually.');
    }
    return gpx;
  }

  if (response.status !== 401 && response.status !== 403) {
    throw upstreamError(response.status);
  }

  // Public Tours can expose their geometry even when Komoot denies GPX export.
  const detailsUrl = new URL(`https://api.komoot.de/v007/tours/${tourId}`);
  detailsUrl.searchParams.set('_embedded', 'coordinates');
  detailsUrl.searchParams.set('format', 'coordinate_array');
  if (shareToken) detailsUrl.searchParams.set('share_token', shareToken);

  const detailsResponse = await fetch(detailsUrl, {
    headers: { Accept: 'application/hal+json, application/json' },
    redirect: 'error',
    signal,
  });
  if (!detailsResponse.ok) throw upstreamError(detailsResponse.status);

  const detailsText = await readUpstreamText(detailsResponse);
  let details: unknown;
  try {
    details = JSON.parse(detailsText);
  } catch {
    throw new ImportError(502, 'Komoot returned invalid Tour data.');
  }
  return tourDetailsToGPX(details);
}

export async function handleKomootImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw new ImportError(405, 'Use POST to import a Komoot Tour.');
    }

    const retryAfter = getKomootRateLimitRetry(req);
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      throw new ImportError(429, 'Too many import attempts. Please try again shortly.');
    }

    const contentType = req.headers['content-type'];
    if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
      throw new ImportError(415, 'The import request must use application/json.');
    }

    const input = await getRequestUrl(req as KomootRequest);
    const { tourId, shareToken } = parseKomootTourUrl(input);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, UPSTREAM_TIMEOUT_MS);

    try {
      const gpx = await fetchKomootGPX(tourId, shareToken, controller.signal);
      sendJson(res, 200, { gpx });
    } catch (error) {
      if (error instanceof ImportError) throw error;
      if (timedOut) throw new ImportError(504, 'Komoot took too long to respond. Please try again.');
      throw new ImportError(502, 'Could not connect to Komoot. Please try again later.');
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const status = error instanceof ImportError ? error.status : 400;
    const message = error instanceof Error ? error.message : 'Unable to import this Komoot Tour.';
    sendJson(res, status, { error: message });
  }
}

export function komootImportMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) {
  if (req.url?.split('?')[0] !== '/api/komoot/import') {
    next();
    return;
  }
  void handleKomootImport(req, res).catch(next);
}
