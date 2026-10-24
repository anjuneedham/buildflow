"use server";

import { headers } from "next/headers";
import { db } from "@/lib/firebase/admin";
import { isId, newId, now } from "@/lib/data/db";
import { isVisible, recountPosts } from "@/lib/data/business";
import { addActivity, addEvent, addNotification, inc, ownerIds, tenant } from "@/lib/data/tenant";
import { getSession, requireBusiness } from "@/lib/session";
import { isEmailVerified, VERIFY_EMAIL_MESSAGE } from "@/server/email-verification";
import { rateLimit } from "@/lib/rate-limit";
import { deleteObjects, pathFromPublicUrl, uploadImage, validImage } from "@/lib/storage";
import { UPLOAD } from "@/lib/constants";
import { commentSchema, parseForm, postSchema, quoteRequestSchema, reportSchema, type ActionState } from "@/lib/validation";
import type { Business } from "@/lib/types";

type ToggleResult = { ok: boolean; on?: boolean; error?: string; needsAuth?: boolean };

async function signedIn() {
  const s = await getSession();
  if (!s.user || s.profile?.is_suspended) return null;
  return { userId: s.user.id, name: s.profile?.full_name || "Someone", avatar: s.profile?.avatar_url ?? null, membership: s.membership, isAdmin: s.isAdmin };
}

async function visiblePost(postId: string) {
  if (!isId(postId)) return null;
  const snap = await db().collection("posts").doc(postId).get();
  return snap.exists && snap.get("visible") ? snap : null;
}

// ---------------- Posts ----------------
export async function createPost(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireBusiness();
  if (!s.can("profile.edit")) return { ok: false, error: "You don't have permission to publish posts." };
  // Publishing is public: require a verified email (ARCHITECTURE_V2.md §5.1).
  if (!(await isEmailVerified(s.user.id))) return { ok: false, error: VERIFY_EMAIL_MESSAGE };
  const parsed = parseForm(postSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  const images = d.type === "before_after"
    ? [fd.get("before"), fd.get("after")].filter(validImage)
    : fd.getAll("images").filter(validImage).slice(0, UPLOAD.maxImagesPerPost);
  if (images.length === 0) return { ok: false, error: d.type === "before_after" ? "Add a before and an after photo." : "Add at least one photo of your work." };
  if (d.type === "before_after" && images.length < 2) return { ok: false, error: "Add both a before and an after photo." };
  if (d.projectId && !(await tenant(s.business.id).doc("projects", d.projectId).get()).exists) return { ok: false, error: "Project not found." };

  const media = [];
  for (const [i, file] of images.entries()) {
    const r = await uploadImage("public", s.business.id, file);
    if ("error" in r) return { ok: false, error: r.error };
    media.push({ id: newId(), url: r.url, position: i, label: d.type === "before_after" ? (i === 0 ? "before" : "after") : null });
  }
  const service = d.serviceId ? await db().collection("services").doc(d.serviceId).get() : null;
  const b = (await tenant(s.business.id).root.get()).data() as Business;
  const ref = db().collection("posts").doc();
  const batch = db().batch();
  batch.set(ref, {
    business_id: s.business.id, author_id: s.user.id, type: d.type, caption: d.caption ?? null, project_id: d.projectId ?? null,
    service_id: service?.exists ? service.id : null, service: service?.exists ? { name: service.get("name"), slug: service.get("slug") } : null,
    location_text: d.locationText ?? null, media, is_public: true, is_hidden: false, visible: isVisible(b),
    // Flattened copy (FIRESTORE_SCHEMA_V2.md §3.18) so feed filters use plain indexes.
    region_id: b.region_id ?? null,
    business: { id: s.business.id, name: b.name, slug: b.slug, logo_url: b.logo_url ?? null, is_verified: b.is_verified, city: b.city ?? null, region_id: b.region_id ?? null },
    like_count: 0, comment_count: 0, save_count: 0, created_at: now(), updated_at: now(),
  });
  if (isVisible(b)) batch.update(tenant(s.business.id).root, { post_count: inc() });
  addActivity(batch, s.business.id, { actorId: s.user.id, actorName: s.profile?.full_name, entityType: "post", entityId: ref.id, action: "created", summary: "Published a new post" });
  await batch.commit();
  return { ok: true, redirectTo: `/post/${ref.id}?published=1` };
}

export async function deletePost(postId: string) {
  const s = await requireBusiness();
  if (!isId(postId)) return { ok: false, error: "Post not found" };
  const ref = db().collection("posts").doc(postId);
  const post = await ref.get();
  if (!post.exists || post.get("business_id") !== s.business.id || (!s.can("profile.edit") && post.get("author_id") !== s.user.id)) return { ok: false, error: "You can't delete this post." };
  const comments = await ref.collection("comments").get();
  const batch = db().batch();
  comments.docs.forEach((c) => batch.delete(c.ref));
  batch.delete(ref);
  await batch.commit();
  // Remove the images too: their public URLs must stop working (audit C.2.6).
  await deleteObjects((post.get("media") as { url: string }[] | undefined ?? []).map((m) => pathFromPublicUrl(m.url)));
  await recountPosts(s.business.id);
  return { ok: true, redirectTo: `/contractor/${s.business.slug}` };
}

// ---------------- Interactions ----------------
// Each toggle runs in a transaction so the per-user marker and the public
// counter can never drift apart.
async function toggleMarker(kind: "likes" | "saves", postId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  const post = await visiblePost(postId);
  if (!post) return { ok: false, error: "Post not available" };
  const marker = db().collection("users").doc(c.userId).collection(kind).doc(postId);
  const counter = kind === "likes" ? "like_count" : "save_count";
  const on = await db().runTransaction(async (tx) => {
    const exists = (await tx.get(marker)).exists;
    if (exists) {
      tx.delete(marker);
      tx.update(post.ref, { [counter]: inc(-1) });
    } else {
      tx.set(marker, { created_at: now(), business_id: post.get("business_id") });
      tx.update(post.ref, { [counter]: inc() });
      addEvent(tx, post.get("business_id"), kind === "likes" ? "like" : "save");
    }
    return !exists;
  });
  return { ok: true, on };
}

export async function toggleLike(postId: string) { return toggleMarker("likes", postId); }
export async function toggleSave(postId: string) { return toggleMarker("saves", postId); }

export async function toggleFollow(businessId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  if (!isId(businessId)) return { ok: false, error: "Business not found" };
  const t = tenant(businessId);
  const biz = await t.root.get();
  if (!biz.exists || !isVisible(biz.data() as Business)) return { ok: false, error: "Business not available" };
  const mine = db().collection("users").doc(c.userId).collection("following").doc(businessId);
  const theirs = t.root.collection("followers").doc(c.userId);
  const owners = await ownerIds(businessId);
  const on = await db().runTransaction(async (tx) => {
    const exists = (await tx.get(mine)).exists;
    if (exists) {
      tx.delete(mine); tx.delete(theirs);
      tx.update(t.root, { follower_count: inc(-1) });
    } else {
      tx.set(mine, { created_at: now() }); tx.set(theirs, { created_at: now(), full_name: c.name });
      tx.update(t.root, { follower_count: inc() });
      addEvent(tx, businessId, "follow");
      owners.filter((o) => o !== c.userId).forEach((o) => tx.set(db().collection("users").doc(o).collection("notifications").doc(), {
        business_id: businessId, type: "follower", title: `${c.name} started following your business`, body: null, link: "/app/analytics", read_at: null, created_at: now(),
      }));
    }
    return !exists;
  });
  return { ok: true, on };
}

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await signedIn();
  if (!c) return { ok: false, error: "Sign in to comment." };
  if (!rateLimit(`comment:${c.userId}`, 10, 60_000).ok) return { ok: false, error: "You're commenting too fast. Wait a moment." };
  const parsed = parseForm(commentSchema, fd);
  if (!parsed.data) return parsed.state;
  const post = await visiblePost(parsed.data.postId);
  if (!post) return { ok: false, error: "This post isn't available." };
  const businessId = post.get("business_id") as string;
  const batch = db().batch();
  batch.set(post.ref.collection("comments").doc(), {
    user_id: c.userId, author: { full_name: c.name, avatar_url: c.avatar }, body: parsed.data.body, is_hidden: false, created_at: now(),
  });
  batch.update(post.ref, { comment_count: inc() });
  addEvent(batch, businessId, "comment");
  for (const o of await ownerIds(businessId)) {
    if (o !== c.userId) addNotification(batch, o, { businessId, type: "comment", title: `${c.name} commented on your post`, body: parsed.data.body.slice(0, 140), link: `/post/${post.id}` });
  }
  await batch.commit();
  return { ok: true, message: "Comment posted" };
}

export async function deleteComment(commentId: string, postId: string) {
  const c = await signedIn();
  if (!c || !isId(commentId) || !isId(postId)) return { ok: false, error: "Sign in first" };
  const postRef = db().collection("posts").doc(postId);
  const ref = postRef.collection("comments").doc(commentId);
  await db().runTransaction(async (tx) => {
    const [comment, post] = await Promise.all([tx.get(ref), tx.get(postRef)]);
    if (!comment.exists || !post.exists) return;
    const ownsPost = c.membership?.role === "owner" && c.membership.business.id === post.get("business_id");
    if (comment.get("user_id") !== c.userId && !ownsPost && !c.isAdmin) return;
    tx.delete(ref);
    tx.update(postRef, { comment_count: inc(-1) });
  });
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
  const s = await getSession();
  const t = tenant(d.businessId);
  const biz = await t.root.get();
  if (!biz.exists || !isVisible(biz.data() as Business)) return { ok: false, error: "This business isn't accepting requests." };
  const b = biz.data() as Business;

  // Persistent abuse guard (survives restarts): max 5 per contact per business per hour.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = (await t.col("quote_requests").where("created_at", ">=", hourAgo).limit(200).get()).docs;
  const sameSender = recent.filter((r) => (d.email && r.get("email")?.toLowerCase() === d.email.toLowerCase()) || (d.phone && r.get("phone") === d.phone) || (s.user && r.get("requester_id") === s.user.id));
  if (sameSender.length >= 5) return { ok: false, error: "You've sent several requests already. The contractor will be in touch." };

  const service = d.serviceId ? await db().collection("services").doc(d.serviceId).get() : null;
  const qrRef = t.col("quote_requests").doc();
  const leadRef = t.col("leads").doc();
  const ts = now();
  const description = [d.description, d.budgetRange && `Budget: ${d.budgetRange}`, d.timeline && `Timeline: ${d.timeline}`].filter(Boolean).join("\n");
  const batch = db().batch();
  batch.set(qrRef, {
    requester_id: s.user?.id ?? null, name: d.name, email: d.email ?? null, phone: d.phone ?? null, service_id: service?.exists ? service.id : null,
    location: d.location ?? null, description: d.description, budget_range: d.budgetRange ?? null, timeline: d.timeline ?? null, kind: d.kind, lead_id: leadRef.id, created_at: ts,
  });
  batch.set(leadRef, {
    name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, location: d.location ?? null, description,
    service_id: service?.exists ? service.id : null, service_name: service?.exists ? service.get("name") : null, status: "new", source: "buildflow",
    estimated_value: null, assigned_to: null, customer_id: null, quote_request_id: qrRef.id, quote: { budget_range: d.budgetRange ?? null, timeline: d.timeline ?? null },
    created_by: null, status_changed_at: ts, created_at: ts, updated_at: ts,
  });
  if (s.user) {
    batch.set(db().collection("users").doc(s.user.id).collection("quote_requests").doc(qrRef.id), {
      business_id: d.businessId, business_name: b.name, business_slug: b.slug, kind: d.kind, description: d.description, created_at: ts,
    });
  }
  addEvent(batch, d.businessId, d.kind === "quote" ? "quote_request" : "contact_click");
  addEvent(batch, d.businessId, "lead_created");
  for (const o of await ownerIds(d.businessId)) {
    addNotification(batch, o, { businessId: d.businessId, type: "quote_request", title: `${d.kind === "quote" ? "New quote request from" : "New message from"} ${d.name.slice(0, 80)}`, body: d.description.slice(0, 140), link: `/app/leads/${leadRef.id}` });
  }
  addActivity(batch, d.businessId, { actorId: s.user?.id ?? null, entityType: "lead", entityId: leadRef.id, action: "created", summary: `${d.kind === "quote" ? "Quote request received from" : "Contact request from"} ${d.name.slice(0, 80)}` });
  await batch.commit();
  return { ok: true, message: d.kind === "quote" ? "Quote request sent! The contractor will contact you soon." : "Message sent! The contractor will get back to you." };
}

// ---------------- Views & reports ----------------
export async function trackView(businessId: string, postId?: string) {
  if (!isId(businessId) || (postId && !isId(postId))) return;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`view:${ip}`, 120, 60 * 60_000).ok) return;
  const s = await getSession();
  if (s.membership?.business.id === businessId) return; // don't count your own views
  const biz = await tenant(businessId).root.get();
  if (!biz.exists || !isVisible(biz.data() as Business)) return;
  const batch = db().batch();
  addEvent(batch, businessId, postId ? "post_view" : "profile_view");
  await batch.commit();
}

export async function reportContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await signedIn();
  if (!c) return { ok: false, error: "Sign in to report content." };
  if (!rateLimit(`report:${c.userId}`, 10, 60 * 60_000).ok) return { ok: false, error: "Too many reports. Try again later." };
  const parsed = parseForm(reportSchema, fd);
  if (!parsed.data) return parsed.state;
  const d = parsed.data;
  // Deterministic id: one report per user per target.
  await db().collection("reports").doc(`${c.userId}_${d.targetType}_${d.targetId}`).set({
    reporter_id: c.userId, reporter_name: c.name, target_type: d.targetType, target_id: d.targetId, target_path: String(fd.get("targetPath") ?? "") || null,
    reason: d.reason, details: d.details ?? null, status: "open", resolved_by: null, resolved_at: null, created_at: now(),
  });
  return { ok: true, message: "Thanks. Our team will review this." };
}
