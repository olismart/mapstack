import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleKomootImport } from '../../server/komootImport';

/** Serverless adapter for hosts that support Node functions in /api (for example, Vercel). */
export default function komootImport(req: IncomingMessage, res: ServerResponse) {
  return handleKomootImport(req, res);
}
