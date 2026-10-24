import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { bucket } from "@/lib/firebase/admin";
import { UPLOAD } from "@/lib/constants";
import { sniff, type Sniffed } from "@/lib/file-type";
export { pathFromPublicUrl } from "@/lib/file-type";

// Storage foundation (ARCHITECTURE_V2.md §6). Every upload is checked by its
// real bytes, not the browser-reported type. Images are re-encoded: rotated
// upright, resized to at most 2048 px, saved as WebP, with ALL metadata
// (EXIF, GPS location of the job site, camera details) removed. PDFs are
// stored as-is after the type check. Nothing is ever served from the
// original upload.

export function validImage(f: FormDataEntryValue | null): f is File {
  return f instanceof File && f.size > 0;
}

const HEIC_MESSAGE = "iPhone HEIC photos aren't supported yet. In Settings → Camera → Formats choose \"Most Compatible\", or share the photo as JPEG.";

type Checked = { ok: true; buf: Buffer; type: Sniffed } | { ok: false; error: string };

async function readChecked(file: File, allowed: readonly Sniffed[], maxBytes: number): Promise<Checked> {
  if (file.size > maxBytes) return { ok: false, error: `Files must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.` };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (type === "image/heic") return { ok: false, error: HEIC_MESSAGE };
  if (!type || !allowed.includes(type)) return { ok: false, error: allowed.includes("application/pdf") ? "Only photos (JPG, PNG, WEBP) and PDFs are allowed." : "Only JPG, PNG or WEBP images are allowed." };
  return { ok: true, buf, type };
}

/** Upright, ≤ 2048 px, WebP, no metadata. Throws if the bytes aren't a decodable image. */
export async function processImage(buf: Buffer) {
  const out = await sharp(buf, { failOn: "error" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

const IMAGE_TYPES = UPLOAD.allowedTypes as readonly Sniffed[];

function publicUrl(path: string, token: string) {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function save(path: string, data: Buffer, contentType: string, token?: string) {
  await bucket().file(path).save(data, {
    contentType, resumable: false,
    metadata: { cacheControl: token ? "public, max-age=31536000, immutable" : "private, max-age=3600", ...(token ? { metadata: { firebaseStorageDownloadTokens: token } } : {}) },
  });
}

/**
 * Uploads an image after validation and re-encoding.
 *  - "public":  public-media/{prefix}/… → returns a tokenised download URL
 *  - "private": project-files/{businessId}/… → returns the object path, served
 *               only through /media/[...path] after a membership check.
 */
export async function uploadImage(kind: "public" | "private", prefix: string, file: File) {
  const checked = await readChecked(file, IMAGE_TYPES, UPLOAD.maxBytes);
  if (!checked.ok) return { error: checked.error } as const;
  let img;
  try {
    img = await processImage(checked.buf);
  } catch {
    return { error: "That image looks damaged and couldn't be read. Try another photo." } as const;
  }
  const path = `${kind === "public" ? "public-media" : "project-files"}/${prefix}/${randomUUID()}.webp`;
  const token = kind === "public" ? randomUUID() : undefined;
  try {
    await save(path, img.data, "image/webp", token);
  } catch (e) {
    console.error("upload failed", e);
    return { error: "Upload failed. Please try again." } as const;
  }
  return { url: token ? publicUrl(path, token) : path, path, width: img.width, height: img.height, bytes: img.data.length } as const;
}

/**
 * Private job document or photo (project-files/{businessId}/…). Images are
 * re-encoded like uploadImage; PDFs are stored unchanged.
 */
export async function uploadPrivateFile(businessId: string, file: File) {
  const checked = await readChecked(file, [...IMAGE_TYPES, "application/pdf"], UPLOAD.maxFileBytes);
  if (!checked.ok) return { error: checked.error } as const;
  const isPdf = checked.type === "application/pdf";
  let data = checked.buf;
  if (!isPdf) {
    try { data = (await processImage(checked.buf)).data; } catch { return { error: "That image looks damaged and couldn't be read." } as const; }
  }
  const path = `project-files/${businessId}/${randomUUID()}.${isPdf ? "pdf" : "webp"}`;
  const contentType = isPdf ? "application/pdf" : "image/webp";
  try {
    await save(path, data, contentType);
  } catch (e) {
    console.error("upload failed", e);
    return { error: "Upload failed. Please try again." } as const;
  }
  const name = (file.name || "file").replace(/[^\w.\- ()]+/g, "_").slice(0, 120);
  return { path, contentType, bytes: data.length, name, kind: isPdf ? "file" as const : "image" as const } as const;
}

/** Best-effort delete; missing objects are fine. */
export async function deleteObjects(paths: (string | null | undefined)[]) {
  await Promise.all(paths.filter((p): p is string => Boolean(p)).map((p) => bucket().file(p).delete({ ignoreNotFound: true }).catch((e) => console.error("delete failed", p, e))));
}

/** URL for a private project file, served via the authenticated media route. */
export const privateMediaUrl = (path: string) => `/media/${path}`;
