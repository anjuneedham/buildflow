/** A real calendar day in YYYY-MM-DD: "2026-13-45" and "2026-02-31" look like dates but aren't. */
export function isRealDay(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
