import { sha256Text } from "./sha256.ts";

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/**
 * Canonical JSON: object keys sorted by UTF-16 code unit, no whitespace, integers and finite numbers
 * only, `undefined` members omitted. Other languages can reproduce it byte for byte.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  throw new Error(`Canonical JSON cannot encode ${typeof value}`);
}

/** SHA-256 (lowercase hex) of the canonical JSON of a value. */
export const canonicalSha256 = (value: unknown): string => sha256Text(canonicalJson(value));
