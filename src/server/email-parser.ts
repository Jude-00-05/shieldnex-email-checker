import { domainToASCII } from 'node:url';
import type { ParsedAddress } from './types.js';

const MAX_INPUT_LENGTH = 20_000;
const MAX_ADDRESSES = 100;
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

export function splitInput(input: string): { addresses: string[]; duplicatesRemoved: number } {
  if (input.length > MAX_INPUT_LENGTH) throw new InputError(`Input must be ${MAX_INPUT_LENGTH.toLocaleString()} characters or fewer.`);
  const values = input.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
  if (!values.length) throw new InputError('Enter at least one email address.');
  const unique = new Map<string, string>();
  for (const value of values) {
    const key = duplicateKey(value);
    if (!unique.has(key)) unique.set(key, value);
  }
  if (unique.size > MAX_ADDRESSES) throw new InputError(`Enter no more than ${MAX_ADDRESSES} unique email addresses.`);
  return { addresses: [...unique.values()], duplicatesRemoved: values.length - unique.size };
}

function duplicateKey(value: string): string {
  const at = value.lastIndexOf('@');
  return at < 0 ? value : `${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`;
}

export function parseAddress(email: string): { parsed?: ParsedAddress; issue?: 'invalid' | 'unsupported'; reason?: string } {
  if (email.length > 254 || /[\u0000-\u001F\u007F\s]/.test(email)) return { issue: 'invalid', reason: 'It contains whitespace or control characters.' };
  const firstAt = email.indexOf('@');
  if (firstAt < 1 || firstAt !== email.lastIndexOf('@')) return { issue: 'invalid', reason: 'It must contain one local part and one domain separated by @.' };
  const local = email.slice(0, firstAt);
  const rawDomain = email.slice(firstAt + 1);
  if (!LOCAL.test(local)) {
    return /[^\x00-\x7F]/.test(local)
      ? { issue: 'unsupported', reason: 'Internationalized local parts are not supported by this checker.' }
      : { issue: 'invalid', reason: 'Its local part has an invalid structure.' };
  }
  const domain = domainToASCII(rawDomain).toLowerCase();
  if (!domain || domain.length > 253 || !domain.includes('.') || domain.split('.').some((label) => !LABEL.test(label))) {
    return { issue: 'invalid', reason: 'Its domain is not a valid routable domain name.' };
  }
  return { parsed: { original: email, normalized: `${local}@${domain}`, domain } };
}

export class InputError extends Error {}
