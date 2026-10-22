"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireBusiness } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";
import { uploadImage, validImage } from "@/lib/storage";
import { UPLOAD } from "@/lib/constants";
import { commentSchema, parseForm, postSchema, quoteRequestSchema, reportSchema, type ActionState } from "@/lib/validation";

type ToggleResult = { ok: boolean; on?: boolean; error?: string; needsAuth?: boolean };

async function signedIn() {
  const s = await getSession();
  return s.user ? { supabase: await createClient(), userId: s.user.id } : null;
}

// ---------------- Posts ----------------
export async function createPost(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  const supabase = await createClient();
  const parsed = parseForm(postSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const before = fd.get("before"), after = fd.get("after");
  const images = d.type === "before_after"
    ? [before, after].filter(validImage)
    : fd.getAll("images").filter(validImage).slice(0, UPLOAD.maxImagesPerPost);
  if (images.length === 0) return { ok: false, error: d.type === "before_after" ? "Add a before and an after photo." : "Add at least one photo of your work." };
  if (d.type === "before_after" && images.length < 2) return { ok: false, error: "Add both a before and an after photo." };

  const { data: post, error } = await supabase.from("posts").insert({
    business_id: s.business.id, author_id: s.user.id, type: d.type, caption: d.caption ?? null,
    project_id: d.projectId ?? null, service_id: d.serviceId ?? null, location_text: d.locationText ?? null,
  }).select("id").single();
  if (error) return { ok: false, error: "Couldn't publish the post." };

  for (const [i, file] of images.entries()) {
    const r = await uploadImage(supabase, "public-media", s.business.id, file);
    if ("error" in r) {
      await supabase.from("posts").delete().eq("id", post.id);
      return { ok: false, error: r.error };
    }
    await supabase.from("post_media").insert({
      post_id: post.id, business_id: s.business.id, url: r.url, position: i,
      label: d.type === "before_after" ? (i === 0 ? "before" : "after") : null,
    });
  }
  await logActivity(supabase, { businessId: s.business.id, actorId: s.user.id, entityType: "post", entityId: post.id, action: "created", summary: "Published a new post" });
  revalidatePath("/explore");
  revalidatePath(`/contractor/${s.business.slug}`);
  redirect(`/post/${post.id}?published=1`);
}

export async function deletePost(postId: string) {
  const s = await requireBusiness();
  const supabase = await createClient();
  await supabase.from("posts").delete().eq("id", postId).eq("business_id", s.business.id);
  revalidatePath(`/contractor/${s.business.slug}`);
  redirect(`/contractor/${s.business.slug}`);
}

// ---------------- Interactions ----------------
export async function toggleLike(postId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  const { data: existing } = await c.supabase.from("likes").select("post_id").eq("post_id", postId).eq("user_id", c.userId).maybeSingle();
  if (existing) {
    await c.supabase.from("likes").delete().eq("post_id", postId).eq("user_id", c.userId);
    return { ok: true, on: false };
  }
  const { error } = await c.supabase.from("likes").insert({ post_id: postId, user_id: c.userId });
  return error ? { ok: false, error: "Couldn't like this post" } : { ok: true, on: true };
}

export async function toggleSave(postId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  const { data: existing } = await c.supabase.from("saves").select("post_id").eq("post_id", postId).eq("user_id", c.userId).maybeSingle();
  if (existing) {
    await c.supabase.from("saves").delete().eq("post_id", postId).eq("user_id", c.userId);
  } else {
    const { error } = await c.supabase.from("saves").insert({ post_id: postId, user_id: c.userId });
    if (error) return { ok: false, error: "Couldn't save this post" };
  }
  revalidatePath("/saved");
  return { ok: true, on: !existing };
}

export async function toggleFollow(businessId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  const { data: existing } = await c.supabase.from("follows").select("business_id").eq("business_id", businessId).eq("user_id", c.userId).maybeSingle();
  if (existing) {
    await c.supabase.from("follows").delete().eq("business_id", businessId).eq("user_id", c.userId);
  } else {
    const { error } = await c.supabase.from("follows").insert({ business_id: businessId, user_id: c.userId });
    if (error) return { ok: false, error: "Couldn't follow" };
  }
  revalidatePath("/saved");
  return { ok: true, on: !existing };
}

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await signedIn();
  if (!c) return { ok: false, error: "Sign in to comment." };
  if (!rateLimit(`comment:${c.userId}`, 10, 60_000).ok) return { ok: false, error: "You're commenting too fast. Wait a moment." };
  const parsed = parseForm(commentSchema, fd);
  if (!parsed.data) return parsed.state;
  const { error } = await c.supabase.from("comments").insert({ post_id: parsed.data.postId, user_id: c.userId, body: parsed.data.body });
  if (error) return { ok: false, error: "Couldn't post your comment." };
  revalidatePath(`/post/${parsed.data.postId}`);
  return { ok: true, message: "Comment posted" };
}

export async function deleteComment(commentId: string, postId: string) {
  const c = await signedIn();
  if (!c) return { ok: false, error: "Sign in first" };
  await c.supabase.from("comments").delete().eq("id", commentId);
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

// ---------------- Quote requests -> leads ----------------
export async function submitQuoteRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseForm(quoteRequestSchema, fd);
  if (!parsed.data) return parsed.state;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`quote:${ip}`, 8, 60 * 60_000).ok) return { ok: false, error: "Too many requests from this device. Please try again later." };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_quote_request", {
    p_business_id: d.businessId, p_name: d.name, p_email: d.email ?? null, p_phone: d.phone ?? null, p_service_id: d.serviceId ?? null,
    p_location: d.location ?? null, p_description: d.description, p_budget_range: d.budgetRange ?? null, p_timeline: d.timeline ?? null, p_kind: d.kind,
  });
  if (error) {
    return { ok: false, error: error.message.includes("too many") ? "You've sent several requests already. The contractor will be in touch." : "Couldn't send your request. Please try again." };
  }
  return { ok: true, message: d.kind === "quote" ? "Quote request sent! The contractor will contact you soon." : "Message sent! The contractor will get back to you." };
}

// ---------------- Views & reports ----------------
export async function trackView(businessId: string, postId?: string) {
  const parsedB = z.string().uuid().safeParse(businessId);
  if (!parsedB.success) return;
  const supabase = await createClient();
  await supabase.rpc("track_view", { p_business_id: businessId, p_post_id: postId ?? null });
}

export async function reportContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await signedIn();
  if (!c) return { ok: false, error: "Sign in to report content." };
  if (!rateLimit(`report:${c.userId}`, 10, 60 * 60_000).ok) return { ok: false, error: "Too many reports. Try again later." };
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const { error } = await c.supabase.from("reports").insert({ reporter_id: c.userId, target_type: d.targetType, target_id: d.targetId, reason: d.reason, details: d.details ?? null });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: "Couldn't send the report." };
  return { ok: true, message: "Thanks. Our team will review this." };
}
