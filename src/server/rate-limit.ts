import type { RequestHandler } from 'express';
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, number[]>();

export const checkRateLimit: RequestHandler = (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
  recent.push(now); hits.set(key, recent); next();
};
