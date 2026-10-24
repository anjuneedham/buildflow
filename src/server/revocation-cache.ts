import "server-only";

// Revocation (a Firebase Auth API call) is checked on every mutation and at
// most every 5 minutes per user for page reads (ARCHITECTURE_V2.md §5.1).
// Anything that ends a session (log out, removed from a team, suspension)
// forgets the user here so this server instance stops trusting the cookie at once.
export const REVOCATION_TTL_MS = 5 * 60_000;
// On globalThis: Next bundles server actions and page renders separately, and a module-level Map would be a different
// Map in each, so a logout (an action) could never evict what the next page read (a render) consults.
const g = globalThis as unknown as { __bfRevocationChecks?: Map<string, number> };
const lastCheck = (g.__bfRevocationChecks ??= new Map<string, number>());

export const lastRevocationCheck = (uid: string) => lastCheck.get(uid) ?? 0;
export function markRevocationChecked(uid: string) {
  lastCheck.set(uid, Date.now());
  if (lastCheck.size > 10_000) lastCheck.clear();
}
export const forgetRevocationCheck = (uid: string) => { lastCheck.delete(uid); };
