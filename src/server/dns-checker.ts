import { promises as dns } from 'node:dns';
import type { CheckResult, ParsedAddress } from './types.js';

export interface DnsResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}
export const systemResolver: DnsResolver = dns;
const DNS_TIMEOUT_MS = 3_000;

export async function checkDns(address: ParsedAddress, resolver: DnsResolver = systemResolver): Promise<CheckResult> {
  try {
    const mx = await timed(resolver.resolveMx(address.domain));
    if (mx.some((record) => record.exchange === '.')) return bounce(address.original, 'The domain explicitly indicates that it does not accept email (null MX).');
    if (mx.some((record) => record.exchange && record.exchange !== '.')) return unknown(address.original, 'The domain has mail-routing records, but mailbox existence is not verified.', 'mx');
    return await checkAddressFallback(address, resolver);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENODATA' || code === 'NODATA') return checkAddressFallback(address, resolver);
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') return bounce(address.original, 'The domain could not be found in DNS.');
    return unknown(address.original, 'Mail routing could not be confirmed because DNS was temporarily unavailable.', 'dns_unavailable');
  }
}

async function checkAddressFallback(address: ParsedAddress, resolver: DnsResolver): Promise<CheckResult> {
  const [v4, v6] = await Promise.allSettled([timed(resolver.resolve4(address.domain)), timed(resolver.resolve6(address.domain))]);
  if ((v4.status === 'fulfilled' && v4.value.length) || (v6.status === 'fulfilled' && v6.value.length)) {
    return unknown(address.original, 'The domain has direct address routing but no MX record; mailbox existence is not verified.', 'address_fallback');
  }
  const codes = [v4, v6].filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected').map((entry) => errorCode(entry.reason));
  if (codes.some((code) => !['ENODATA', 'NODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(code))) {
    return unknown(address.original, 'Mail routing could not be confirmed because DNS was temporarily unavailable.', 'dns_unavailable');
  }
  return bounce(address.original, 'The domain has no usable MX record or direct address fallback for email.');
}

function timed<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
function errorCode(error: unknown): string { return typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : 'UNKNOWN'; }
function bounce(email: string, explanation: string): CheckResult { return { email, status: 'likely_bounce', explanation, checks: { syntax: 'valid', routing: 'no_routing' } }; }
function unknown(email: string, explanation: string, routing: CheckResult['checks']['routing']): CheckResult { return { email, status: 'unknown', explanation, checks: { syntax: 'valid', routing } }; }
