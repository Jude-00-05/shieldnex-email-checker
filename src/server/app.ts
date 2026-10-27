import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDns, systemResolver, type DnsResolver } from './dns-checker.js';
import { InputError, parseAddress, splitInput } from './email-parser.js';
import { checkRateLimit } from './rate-limit.js';
import type { CheckResponse, CheckResult } from './types.js';

const CACHE_TTL_MS = 10 * 60_000;
const domainCache = new Map<string, { expires: number; result: Omit<CheckResult, 'email'> }>();

export function createApp(resolver: DnsResolver = systemResolver) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '24kb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, mode: 'dns-only' }));
  app.post('/api/check', checkRateLimit, async (req, res) => {
    if (!req.body || typeof req.body.input !== 'string') return res.status(400).json({ error: 'Provide an input string containing email addresses.' });
    try {
      const { addresses, duplicatesRemoved } = splitInput(req.body.input);
      const results = await mapWithConcurrency(addresses, 5, (email) => checkOne(email, resolver));
      const summary = { likely_deliverable: 0, likely_bounce: 0, unknown: 0, duplicatesRemoved };
      for (const result of results) summary[result.status] += 1;
      return res.json({ results, summary } satisfies CheckResponse);
    } catch (error) {
      if (error instanceof InputError) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: 'Unable to complete this batch. Please try again.' });
    }
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 500;
    if (status === 413) return res.status(413).json({ error: 'Request body exceeds the 24 KB server limit.' });
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  });
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(serverDir, '../client');
  app.use(express.static(clientDir));
  app.use((req, res) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(clientDir, 'index.html'));
    return res.status(404).json({ error: 'Not found.' });
  });
  return app;
}

async function checkOne(email: string, resolver: DnsResolver): Promise<CheckResult> {
  const parsed = parseAddress(email);
  if (!parsed.parsed) return {
    email, status: parsed.issue === 'invalid' ? 'likely_bounce' : 'unknown',
    explanation: parsed.issue === 'invalid' ? `This is not a structurally valid email address. ${parsed.reason}` : parsed.reason ?? 'This address format is not supported.',
    checks: { syntax: parsed.issue === 'invalid' ? 'invalid' : 'unsupported', routing: 'not_checked' }
  };
  const cached = domainCache.get(parsed.parsed.domain);
  if (cached && cached.expires > Date.now()) return { ...cached.result, email };
  const result = await checkDns(parsed.parsed, resolver);
  if (result.checks.routing !== 'dns_unavailable') {
    const { email: _email, ...withoutEmail } = result;
    domainCache.set(parsed.parsed.domain, { expires: Date.now() + CACHE_TTL_MS, result: withoutEmail });
  }
  return result;
}

async function mapWithConcurrency<T, R>(items: T[], max: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(max, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }));
  return output;
}
