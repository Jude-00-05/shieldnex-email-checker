import { describe, expect, it } from 'vitest';
import { checkDns, type DnsResolver } from './dns-checker.js';

const address = { original: 'person@example.test', normalized: 'person@example.test', domain: 'example.test' };
const resolver = (overrides: Partial<DnsResolver>): DnsResolver => ({
  resolveMx: async () => [], resolve4: async () => [], resolve6: async () => [], ...overrides
});
const fail = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));

describe('DNS classification', () => {
  it('keeps MX-routed addresses unknown', async () => {
    const result = await checkDns(address, resolver({ resolveMx: async () => [{ exchange: 'mail.example.test', priority: 10 }] }));
    expect(result).toMatchObject({ status: 'unknown', checks: { routing: 'mx' } });
  });
  it('classifies null MX as likely bounce', async () => {
    const result = await checkDns(address, resolver({ resolveMx: async () => [{ exchange: '.', priority: 0 }] }));
    expect(result.status).toBe('likely_bounce');
  });
  it('uses valid A fallback as unknown', async () => {
    const result = await checkDns(address, resolver({ resolveMx: () => fail('ENODATA'), resolve4: async () => ['192.0.2.1'] }));
    expect(result).toMatchObject({ status: 'unknown', checks: { routing: 'address_fallback' } });
  });
  it('classifies no routing as likely bounce', async () => {
    const result = await checkDns(address, resolver({ resolveMx: () => fail('ENODATA'), resolve4: () => fail('ENODATA'), resolve6: () => fail('ENODATA') }));
    expect(result.status).toBe('likely_bounce');
  });
  it('keeps resolver failures unknown', async () => {
    const result = await checkDns(address, resolver({ resolveMx: () => fail('SERVFAIL') }));
    expect(result).toMatchObject({ status: 'unknown', checks: { routing: 'dns_unavailable' } });
  });
});
