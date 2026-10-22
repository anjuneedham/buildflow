import "server-only";
import { randomUUID } from "node:crypto";
import { bucket } from "@/lib/firebase/admin";
import { UPLOAD } from "@/lib/constants";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

export function validImage(f: FormDataEntryValue | null): f is File {
  return f instanceof File && f.size > 0;
}

export function checkImage(file: File): string | null {
  if (!UPLOAD.allowedTypes.includes(file.type)) return "Only JPG, PNG, WEBP or HEIC images are allowed.";
  if (file.size > UPLOAD.maxBytes) return "Images must be 10 MB or smaller.";
  return null;
}

function publicUrl(path: string, token: string) {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/**
 * Uploads a validated image with the Admin SDK (storage.rules deny all
 * direct client access).
 *  - "public":  public-media/{prefix}/… → returns a tokenised download URL
 *  - "private": project-files/{businessId}/… → returns the object path, served
 *               only through /media/[...path] after a membership check.
 */
export async function uploadImage(kind: "public" | "private", prefix: string, file: File) {
  const problem = checkImage(file);
  if (problem) return { error: problem } as const;
  const path = `${kind === "public" ? "public-media" : "project-files"}/${prefix}/${randomUUID()}.${EXT[file.type] ?? "jpg"}`;
  const token = randomUUID();
  try {
    await bucket().file(path).save(Buffer.from(await file.arrayBuffer()), {
      contentType: file.type, resumable: false,
      metadata: kind === "public" ? { metadata: { firebaseStorageDownloadTokens: token } } : undefined,
    });
  } catch (e) {
    console.error("upload failed", e);
    return { error: "Upload failed. Please try again." } as const;
  }
  return { url: kind === "public" ? publicUrl(path, token) : path } as const;
}

/** URL for a private project photo, served via the authenticated media route. */
export const privateMediaUrl = (path: string) => `/media/${path}`;
