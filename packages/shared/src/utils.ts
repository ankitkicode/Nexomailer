import { randomBytes, createHmac } from 'node:crypto';
import type { Address, AddressInput } from './types.js';

/** Generate a unique message ID */
export function generateId(prefix = 'msg'): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(8).toString('hex');
  return `${prefix}_${ts}${rand}`;
}

/** Generate an API key with prefix */
export function generateApiKey(prefix = 'nxo_live'): { key: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  return { key: `${prefix}_${raw}`, prefix };
}

/** Create HMAC-SHA256 signature */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Verify HMAC-SHA256 signature */
export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= (expected.charCodeAt(i) ?? 0) ^ (signature.charCodeAt(i) ?? 0);
  }
  return result === 0;
}

/** Normalize address input to Address array */
export function normalizeAddresses(input: AddressInput): Address[] {
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => {
    if (typeof item === 'string') return { address: item };
    return item;
  });
}

/** Format address for SMTP: "Name <address>" or just "address" */
export function formatAddress(addr: Address): string {
  if (addr.name) return `"${addr.name.replace(/"/g, '\\"')}" <${addr.address}>`;
  return addr.address;
}

/** Parse "Name <address>" string into Address */
export function parseAddress(input: string): Address {
  const match = input.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1]?.trim() || undefined, address: match[2]! };
  }
  return { address: input.trim() };
}

/** Sleep utility */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate exponential backoff delay */
export function backoffDelay(attempt: number, baseDelay: number, maxDelay = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  // Add jitter: ±25%
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/** Chunk array into smaller arrays */
export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/** Base64 encode for SMTP */
export function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}

/** Generate boundary for MIME multipart */
export function generateBoundary(): string {
  return `----NexoMailer_${randomBytes(16).toString('hex')}`;
}
