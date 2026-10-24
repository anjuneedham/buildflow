// Browser-side photo shrinking. Runs before a form is sent so that:
//  - a request fits the hosting platform's body limit (Vercel Functions: about 4.5 MB per request),
//  - uploads over a weak mobile connection take seconds instead of minutes,
//  - the original, with its GPS location, never leaves the phone (the server also strips metadata).
// The server still checks the real bytes and re-encodes, so nothing here is trusted.

export const REQUEST_BUDGET_BYTES = 4 * 1024 * 1024;
/** A phone photo larger than this is refused outright (decoding it could exhaust a low-end phone's memory). */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const SKIP_UNDER_BYTES = 350 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Largest side and quality tried, best first, until everything fits. */
export const SHRINK_STEPS: [number, number][] = [[2048, 0.82], [1600, 0.76], [1280, 0.7], [1024, 0.64], [800, 0.58]];

export type Prepared = { fd: FormData; error?: undefined } | { fd?: undefined; error: string };

async function shrink(file: File, maxSide: number, quality: number): Promise<File | null> {
  try {
    const probe = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(probe.width, probe.height));
    const w = Math.max(1, Math.round(probe.width * scale)), h = Math.max(1, Math.round(probe.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(probe, 0, 0, w, h);
    probe.close();
    // WebP keeps transparency (logos) and is smaller; browsers without WebP encoding fall back to JPEG on a white background.
    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") {
      ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    }
    if (!blob) return null;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return null; // not decodable here (for example HEIC): leave it for the server to explain
  }
}

const isImage = (v: FormDataEntryValue): v is File => v instanceof File && v.size > 0 && IMAGE_TYPES.includes(v.type);

/**
 * Returns a copy of the form with large photos shrunk until the files fit one request, or an explanation of why they cannot.
 * Forms without files come back untouched.
 */
export async function prepareUploads(fd: FormData, budget = REQUEST_BUDGET_BYTES): Promise<Prepared> {
  const files = [...fd.entries()].filter((e): e is [string, File] => e[1] instanceof File && e[1].size > 0);
  if (files.length === 0) return { fd };
  for (const [, f] of files) {
    if (f.size > MAX_ORIGINAL_BYTES) return { error: `${f.name || "That file"} is ${(f.size / 1048576).toFixed(0)} MB. Choose a photo under ${MAX_ORIGINAL_BYTES / 1048576} MB, or take it at a lower quality.` };
  }
  const total = (list: File[]) => list.reduce((n, f) => n + f.size, 0);
  const others = files.filter(([, f]) => !isImage(f)).map(([, f]) => f);
  const pdf = others.find((f) => f.size > budget);
  if (pdf) return { error: `${pdf.name} is ${(pdf.size / 1048576).toFixed(1)} MB. Files must be ${budget / 1048576} MB or smaller for now. Try a smaller PDF.` };

  // Photos over a few hundred KB are always shrunk (faster on a weak connection, and the original's GPS stays on the phone);
  // if the files still do not fit one request, try smaller sizes until they do.
  let current: [string, File][] = files;
  for (const [maxSide, quality] of SHRINK_STEPS) {
    const next: [string, File][] = [];
    for (const [name, original] of files) next.push([name, isImage(original) && original.size > SKIP_UNDER_BYTES ? (await shrink(original, maxSide, quality)) ?? original : original]);
    current = next;
    if (total(current.map(([, f]) => f)) <= budget) break;
  }
  if (total(current.map(([, f]) => f)) > budget) return { error: `These files add up to ${(total(current.map(([, f]) => f)) / 1048576).toFixed(1)} MB even after shrinking. Send fewer photos at a time.` };

  // Rebuild in the original order, swapping in the shrunk files.
  const out = new FormData();
  let i = 0;
  for (const [k, v] of fd.entries()) {
    if (v instanceof File && v.size > 0) out.append(k, current[i++][1]);
    else out.append(k, v);
  }
  return { fd: out };
}
