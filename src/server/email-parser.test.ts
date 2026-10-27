import { describe, expect, it } from 'vitest';
import { InputError, parseAddress, splitInput } from './email-parser.js';

describe('email parsing and input limits', () => {
  it('accepts conventional addresses and IDNA domains', () => {
    expect(parseAddress('alex+test@example.com').parsed?.domain).toBe('example.com');
    expect(parseAddress('alex@bücher.de').parsed?.domain).toBe('xn--bcher-kva.de');
  });
  it('distinguishes invalid structure from unsupported international local parts', () => {
    expect(parseAddress('a..b@example.com').issue).toBe('invalid');
    expect(parseAddress('用户@example.com').issue).toBe('unsupported');
    expect(parseAddress('a@example').issue).toBe('invalid');
  });
  it('parses separators, deduplicates case-insensitive domains, and enforces bounds', () => {
    expect(splitInput('a@EXAMPLE.com, b@example.com\na@example.com')).toEqual({ addresses: ['a@EXAMPLE.com', 'b@example.com'], duplicatesRemoved: 1 });
    expect(() => splitInput('x'.repeat(20_001))).toThrow(InputError);
    expect(() => splitInput(Array.from({ length: 101 }, (_, i) => `u${i}@example.com`).join('\n'))).toThrow(InputError);
    expect(() => splitInput(' , ; \n ')).toThrow(InputError);
  });
});
