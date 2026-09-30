// api/index.js
// Vercel Serverless Function entry point
import handler from '../server.js';

export default async function (req, res) {
  return handler(req, res);
}
