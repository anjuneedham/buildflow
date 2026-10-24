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

// When this server itself ends a session (log out, removed from a team, suspended) it records the moment, and any
// session that signed in earlier is refused from then on without another Firebase call. Clearing the "last checked"
// time alone was not enough: a request already in flight when the session ended could write a fresh "checked" entry
// back and keep a copied cookie alive for another five minutes.
const rg = globalThis as unknown as { __bfRevokedAt?: Map<string, number> };
const revokedAt = (rg.__bfRevokedAt ??= new Map<string, number>());

export function forgetRevocationCheck(uid: string) {
  lastCheck.delete(uid);
  revokedAt.set(uid, Date.now());
  if (revokedAt.size > 10_000) revokedAt.clear();
}
/** True when a session whose sign-in time is `authTimeSeconds` was ended by this server after it began. */
export function endedByThisServer(uid: string, authTimeSeconds: number) {
  const at = revokedAt.get(uid);
  // auth_time is whole seconds; the one-second allowance keeps a sign-in in the same second as a logout valid.
  return at !== undefined && authTimeSeconds * 1000 < at - 1000;
}
