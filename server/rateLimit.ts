import type { IncomingMessage } from 'node:http';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 30;
const clients = new Map<string, { count: number; resetAt: number }>();

/** Small best-effort limiter for local/serverless use; a shared limiter can replace it at scale. */
export function getKomootRateLimitRetry(req: IncomingMessage): number {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const client = forwardedIp?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = clients.get(client);

  if (!current || current.resetAt <= now) {
    clients.set(client, { count: 1, resetAt: now + WINDOW_MS });
  } else if (current.count >= MAX_REQUESTS) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  } else {
    current.count += 1;
  }

  if (clients.size > 1000) {
    for (const [key, value] of clients) {
      if (value.resetAt <= now) clients.delete(key);
    }
  }
  return 0;
}
