// Pure helpers for uploads (no server imports), unit-tested in tests/file-type.test.ts.

export type Sniffed = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

/** Identifies a file from its first bytes (magic numbers). */
export function sniff(buf: Uint8Array): Sniffed | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => buf[i + k] === v);
  const ascii = (i: number, s: string) => at(i, ...[...s].map((c) => c.charCodeAt(0)));
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].some((b) => ascii(8, b))) return "image/heic";
  if (ascii(0, "%PDF-")) return "application/pdf";
  return null;
}

/** Object path inside a public URL we issued, or null for foreign URLs (e.g. seed images). */
export function pathFromPublicUrl(url: string | null | undefined): string | null {
  const m = url?.match(/\/o\/([^?]+)\?alt=media/);
  if (!m) return null;
  const path = decodeURIComponent(m[1]);
  return path.startsWith("public-media/") ? path : null;
}

