/**
 * Next hands a page `string[]` when a query key repeats (`?q=a&q=b`), so a page
 * that calls `.trim()` on it crashes on a URL anyone can craft. Pages take the
 * first value of each key instead.
 */
export function firstParams<T extends object>(sp: T): T {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as T;
}
