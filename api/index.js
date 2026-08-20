// api/index.js
// Vercel Serverless Function entry point for Doctor on Call API routes.

import { handleApi, sendJson } from '../server.js';
import { getDb } from '../db/index.js';

export default async function handler(req, res) {
  try {
    await getDb();
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url, `${proto}://${host}`);
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());

    const handled = await handleApi(req, res, pathname, query);
    if (!handled) {
      sendJson(res, 404, { error: 'API endpoint not found' });
    }
  } catch (err) {
    console.error('Vercel API handler error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}
