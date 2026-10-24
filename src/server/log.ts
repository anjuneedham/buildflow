// Structured logging (ARCHITECTURE_V2.md §12). One JSON object per line so
// Cloud Logging / the host's log drain can index fields. No emails, phone
// numbers or message bodies in logs. captureError is the single hook for an
// error tracker (Sentry): wire it here, nowhere else.

type Fields = Record<string, unknown>;

function line(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const entry = { severity: level.toUpperCase(), time: new Date().toISOString(), event, ...fields };
  const out = JSON.stringify(entry, (_, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v));
  if (level === "error") console.error(out); else if (level === "warn") console.warn(out); else console.log(out);
}

export const log = {
  info: (event: string, fields: Fields = {}) => line("info", event, fields),
  warn: (event: string, fields: Fields = {}) => line("warn", event, fields),
  error: (event: string, error: unknown, fields: Fields = {}) => line("error", event, { ...fields, error }),
};

/** Report an unexpected error. Today: structured log. Later: also the error tracker. */
export function captureError(error: unknown, context: Fields = {}) {
  log.error("unhandled_error", error, context);
}
