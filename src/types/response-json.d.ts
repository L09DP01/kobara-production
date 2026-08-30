/**
 * Next.js 16.2.11 types fetch JSON as unknown. Kobara predates that change and
 * validates provider payloads at their existing service boundaries. Keep the
 * legacy inference during the security patch upgrade; new endpoints should
 * parse untrusted JSON with Zod instead of relying on this compatibility type.
 */
interface Body {
  json<T = any>(): Promise<T>;
}
