/** Firestore auto-ids (20 chars) or our readable demo ids. Firestore rejects ids shaped like `__x__`. */
export const ID_RE = /^(?!__.*__$)[A-Za-z0-9_-]{1,64}$/;
export const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
