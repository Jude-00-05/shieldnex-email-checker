export type CheckStatus = 'likely_deliverable' | 'likely_bounce' | 'unknown';
export type SyntaxState = 'valid' | 'invalid' | 'unsupported';
export type RoutingState = 'mx' | 'address_fallback' | 'no_routing' | 'dns_unavailable' | 'not_checked';

export interface CheckResult {
  email: string;
  status: CheckStatus;
  explanation: string;
  checks: { syntax: SyntaxState; routing: RoutingState };
}

export interface CheckResponse {
  results: CheckResult[];
  summary: Record<CheckStatus, number> & { duplicatesRemoved: number };
}

export interface ParsedAddress { original: string; normalized: string; domain: string; }
