import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let parseKomootTourUrl;
let handleKomootImport;

before(async () => {
  vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-tests/komoot',
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ parseKomootTourUrl } = await vite.ssrLoadModule('/src/utils/komoot.ts'));
  ({ handleKomootImport } = await vite.ssrLoadModule('/server/komootImport.ts'));
});

after(async () => {
  await vite.close();
});

function mockRequest(url, method = 'POST') {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: { url },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    headersSent: false,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body = '') {
      this.body = body;
      this.headersSent = true;
    },
  };
}

const SAMPLE_GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Test Tour</name><trkseg>
    <trkpt lat="51.5" lon="-0.1" />
    <trkpt lat="51.6" lon="-0.2" />
  </trkseg></trk>
</gpx>`;

test('parses public, localized, protocol-less, and shared Tour links', () => {
  assert.deepEqual(parseKomootTourUrl('https://www.komoot.com/tour/123456'), { tourId: '123456' });
  assert.deepEqual(parseKomootTourUrl('komoot.com/en-gb/tour/987/?ref=share'), { tourId: '987' });
  assert.deepEqual(
    parseKomootTourUrl('https://www.komoot.com/tour/456?share_token=a-b_c123&utm_source=share'),
    { tourId: '456', shareToken: 'a-b_c123' },
  );
});

test('rejects insecure, lookalike, credentialed, and non-Tour URLs', () => {
  assert.throws(() => parseKomootTourUrl('http://www.komoot.com/tour/123'), /HTTPS/);
  assert.throws(() => parseKomootTourUrl('https://komoot.com.evil.test/tour/123'), /komoot\.com/);
  assert.throws(() => parseKomootTourUrl('https://user@komoot.com/tour/123'), /komoot\.com/);
  assert.throws(() => parseKomootTourUrl('https://komoot.com/plan/tour/123'), /Tour link/);
});

test('returns a successful GPX response without forwarding tracking parameters', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(SAMPLE_GPX, { status: 200 });
  };

  try {
    const req = mockRequest('https://www.komoot.com/tour/456?share_token=secret&utm_source=share');
    const res = mockResponse();
    await handleKomootImport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrl.origin, 'https://api.komoot.de');
    assert.equal(requestedUrl.pathname, '/v007/tours/456.gpx');
    assert.equal(requestedUrl.searchParams.get('share_token'), 'secret');
    assert.equal(requestedUrl.searchParams.has('utm_source'), false);
    assert.equal(JSON.parse(res.body).gpx, SAMPLE_GPX);
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to public coordinates when GPX export is denied', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  const details = {
    name: 'A & <B>',
    _embedded: {
      coordinates: {
        items: [
          { lat: 50.834012, lng: -0.130023, alt: 22, t: 0 },
          { lat: 50.834603, lng: -0.128838, t: 18781 },
        ],
      },
    },
  };
  globalThis.fetch = async (input) => {
    requestedUrls.push(new URL(String(input)));
    return requestedUrls.length === 1
      ? new Response(null, { status: 403 })
      : new Response(JSON.stringify(details), { status: 200 });
  };

  try {
    const req = mockRequest('https://www.komoot.com/tour/456?share_token=secret&utm_source=share');
    const res = mockResponse();
    await handleKomootImport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrls.length, 2);
    assert.equal(requestedUrls[0].pathname, '/v007/tours/456.gpx');
    assert.equal(requestedUrls[1].pathname, '/v007/tours/456');
    assert.equal(requestedUrls[1].searchParams.get('_embedded'), 'coordinates');
    assert.equal(requestedUrls[1].searchParams.get('format'), 'coordinate_array');
    for (const url of requestedUrls) {
      assert.equal(url.searchParams.get('share_token'), 'secret');
      assert.equal(url.searchParams.has('utm_source'), false);
    }

    const gpx = JSON.parse(res.body).gpx;
    assert.match(gpx, /<name>A &amp; &lt;B&gt;<\/name>/);
    assert.match(gpx, /<trkpt lat="50\.834012" lon="-0\.130023"><ele>22<\/ele><\/trkpt>/);
    assert.match(gpx, /<trkpt lat="50\.834603" lon="-0\.128838" \/>/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects coordinate fallback data without a usable route', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return new Response(null, { status: 403 });
    return new Response(JSON.stringify({
      name: 'Incomplete Tour',
      _embedded: { coordinates: { items: [{ lat: 50.8, lng: -0.1 }] } },
    }), { status: 200 });
  };

  try {
    const res = mockResponse();
    await handleKomootImport(mockRequest('https://www.komoot.com/tour/456'), res);
    assert.equal(res.statusCode, 502);
    assert.match(JSON.parse(res.body).error, /enough coordinates/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('maps Komoot access errors to a useful response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });

  try {
    const res = mockResponse();
    await handleKomootImport(mockRequest('https://www.komoot.com/tour/456'), res);
    assert.equal(res.statusCode, 403);
    assert.match(JSON.parse(res.body).error, /denied access/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects HTML returned instead of GPX', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>Login</html>', { status: 200 });

  try {
    const res = mockResponse();
    await handleKomootImport(mockRequest('https://www.komoot.com/tour/456'), res);
    assert.equal(res.statusCode, 502);
    assert.match(JSON.parse(res.body).error, /invalid GPX/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects non-POST requests and invalid links before calling Komoot', async () => {
  const methodRes = mockResponse();
  await handleKomootImport(mockRequest('https://www.komoot.com/tour/456', 'GET'), methodRes);
  assert.equal(methodRes.statusCode, 405);

  const linkRes = mockResponse();
  await handleKomootImport(mockRequest('https://evil.test/tour/456'), linkRes);
  assert.equal(linkRes.statusCode, 400);
  assert.match(JSON.parse(linkRes.body).error, /komoot\.com/);
});
