import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from './index.js';

describe('Vercel Express entry point', () => {
  it('exposes health through the exported function app', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, mode: 'dns-only' });
  });

  it('routes API validation through Express instead of a static 404', async () => {
    const response = await request(app).post('/api/check').send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('input string');
  });
});
