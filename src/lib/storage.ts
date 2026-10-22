import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * Uploads an image under `{prefix}/...`. Storage RLS requires the prefix to
 * be a business the user belongs to (or users/{uid}). Returns a public URL
 * for public-media, or the object path for the private project-files bucket.
 */
export async function uploadImage(supabase: SupabaseClient, bucket: "public-media" | "project-files", prefix: string, file: File) {
  const problem = checkImage(file);
  if (problem) return { error: problem } as const;
  const path = `${prefix}/${crypto.randomUUID()}.${EXT[file.type] ?? "jpg"}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Upload failed. Please try again." } as const;
  if (bucket === "public-media") return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl } as const;
  return { url: path } as const;
}

export async function signedUrls(supabase: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from("project-files").createSignedUrls(paths, 60 * 60);
  return new Map<string, string>((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl as string]));
}
