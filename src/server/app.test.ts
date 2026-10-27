import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { DnsResolver } from './dns-checker.js';

const resolver: DnsResolver = {
  resolveMx: async () => [{ exchange: 'mail.example.com', priority: 10 }],
  resolve4: async () => [], resolve6: async () => []
};
describe('API', () => {
  it('returns individual results and removes duplicates', async () => {
    const response = await request(createApp(resolver)).post('/api/check').send({ input: 'ok@example.com, bad@@example.com\nok@EXAMPLE.COM' });
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].status).toBe('unknown');
    expect(response.body.results[1].status).toBe('likely_bounce');
    expect(response.body.summary.duplicatesRemoved).toBe(1);
  });
  it('rejects missing and empty input', async () => {
    expect((await request(createApp(resolver)).post('/api/check').send({})).status).toBe(400);
    expect((await request(createApp(resolver)).post('/api/check').send({ input: '   ' })).status).toBe(400);
  });
  it('rejects batches over the unique-address limit', async () => {
    const input = Array.from({ length: 101 }, (_, i) => `user${i}@example.com`).join('\n');
    const response = await request(createApp(resolver)).post('/api/check').send({ input });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('no more than 100');
  });
  it('returns JSON for oversized request bodies', async () => {
    const response = await request(createApp(resolver)).post('/api/check').set('Content-Type', 'application/json').send(JSON.stringify({ input: 'x'.repeat(25_000) }));
    expect(response.status).toBe(413);
    expect(response.body.error).toContain('24 KB');
  });
  it('reports DNS-only health', async () => {
    const response = await request(createApp(resolver)).get('/health');
    expect(response.body).toEqual({ ok: true, mode: 'dns-only' });
  });
  it('serves the frontend shell from the Vercel root route', async () => {
    const previousVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const response = await request(createApp(resolver)).get('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('id="root"');
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });
});
