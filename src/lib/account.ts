/** The word a person types to confirm deleting their account. */
export const DELETE_CONFIRMATION = "DELETE";

/** The sign-in must be recent: deleting an account is not something a stolen session should be able to do. */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;
export const recentlySignedIn = (authTimeSeconds: number, nowMs = Date.now()) => nowMs / 1000 - authTimeSeconds <= RECENT_SIGN_IN_SECONDS;
