import { Decimal } from '../core/decimal.js';

/**
 * RFC 8785: JSON Canonicalization Scheme (JCS)
 *
 * Guarantees deterministic serialization:
 * 1. Lexicographical key sorting by UTF-16 code units at all nested depths.
 * 2. Zero whitespace between tokens (no extra spaces around ':' or ',').
 * 3. Consistent serialization for primitives, Decimal objects, Dates, arrays, and nested maps.
 * 4. Produces deterministic UTF-8 byte representation for cryptographic hashing.
 */
export function canonicalJsonStringify(data: unknown): string {
  if (data === null || data === undefined) {
    return 'null';
  }

  // Handle primitives
  if (typeof data === 'boolean') {
    return data ? 'true' : 'false';
  }

  if (typeof data === 'number') {
    if (!Number.isFinite(data)) {
      throw new TypeError('Cannot canonicalize non-finite number');
    }
    // RFC 8785 specifies standard JSON number representation
    return JSON.stringify(data);
  }

  if (typeof data === 'string') {
    return JSON.stringify(data);
  }

  if (typeof data === 'bigint') {
    return JSON.stringify(data.toString());
  }

  // Handle Date
  if (data instanceof Date) {
    return JSON.stringify(data.toISOString());
  }

  // Handle Decimal.js instances
  if (Decimal.isDecimal(data) || (typeof data === 'object' && data !== null && '_isDecimal' in data)) {
    return JSON.stringify(data.toString());
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    const elements = data.map((item) => canonicalJsonStringify(item));
    return '[' + elements.join(',') + ']';
  }

  // Handle Objects
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const entries: string[] = [];

    for (const key of sortedKeys) {
      const val = obj[key];
      // Skip undefined, functions, and symbols
      if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
        continue;
      }
      entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
    }

    return '{' + entries.join(',') + '}';
  }

  return JSON.stringify(data);
}

/**
 * Returns canonical UTF-8 bytes for a payload
 */
export function canonicalJsonBytes(payload: unknown): Buffer {
  const canonicalStr = canonicalJsonStringify(payload);
  return Buffer.from(canonicalStr, 'utf8');
}
