"use server";

import { headers } from "next/headers";
import { db } from "@/lib/firebase/admin";
import { isId, newId, now } from "@/lib/data/db";
import { isVisible, postSnapshot, recountPosts } from "@/lib/data/business";
import { addActivity, addEvent, addNotification, inc, ownerIds, tenant } from "@/lib/data/tenant";
import { getSession, requireBusiness } from "@/lib/session";
import { isEmailVerified, VERIFY_EMAIL_MESSAGE } from "@/server/email-verification";
import { findOrCreateCustomer } from "@/lib/data/workflow";
import { responseLabel } from "@/lib/data/trust";
import { excerpt, phoneDigits } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { deleteObjects, pathFromPublicUrl, publishPrivateImage, uploadImage, validImage } from "@/lib/storage";
import { UPLOAD } from "@/lib/constants";
import { parseForm, postSchema, quoteRequestSchema, reportSchema, type ActionState } from "@/lib/validation";
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
  const t = tenant(s.business.id);
  const project = d.projectId ? await t.doc("projects", d.projectId).get() : null;
  if (d.projectId && !project?.exists) return { ok: false, error: "Job not found." };

  // Photos come from the job's own gallery (already private and stripped of
  // metadata) and/or new uploads. Each source is one ordered slot.
  type Slot = { file: File } | { mediaId: string };
  const jobPhoto = async (mediaId: string) => {
    if (!project || !isId(mediaId)) return null;
    const m = await t.doc("media", mediaId).get();
    return m.exists && m.get("project_id") === project.id && m.get("kind") === "image" ? (m.get("path") as string) : null;
  };
  const pick = (key: string): Slot | null => {
    const f = fd.get(key);
    if (validImage(f)) return { file: f };
    const id = String(fd.get(`${key}MediaId`) ?? "");
    return id ? { mediaId: id } : null;
  };
  const slots: Slot[] = d.type === "before_after"
    ? [pick("before"), pick("after")].filter((x): x is Slot => x !== null)
    : [...fd.getAll("jobMediaIds").map(String).filter(Boolean).map((mediaId) => ({ mediaId })), ...fd.getAll("images").filter(validImage).map((file) => ({ file }))].slice(0, UPLOAD.maxImagesPerPost);
  if (slots.length === 0) return { ok: false, error: d.type === "before_after" ? "Add a before and an after photo." : "Add at least one photo of your work." };
  if (d.type === "before_after" && slots.length < 2) return { ok: false, error: "Add both a before and an after photo." };

  const media = [];
  for (const [i, slot] of slots.entries()) {
    let url: string;
    if ("file" in slot) {
      const r = await uploadImage("public", s.business.id, slot.file);
      if ("error" in r) return { ok: false, error: r.error };
      url = r.url;
    } else {
      const path = await jobPhoto(slot.mediaId);
      if (!path) return { ok: false, error: "One of the job photos is no longer available." };
      const r = await publishPrivateImage(path, s.business.id);
      if ("error" in r) return { ok: false, error: r.error };
      url = r.url;
    }
    media.push({ id: newId(), url, position: i, label: d.type === "before_after" ? (i === 0 ? "before" : "after") : null });
  }
  const service = d.serviceId ? await db().collection("services").doc(d.serviceId).get() : null;
  const b = (await tenant(s.business.id).root.get()).data() as Business;
  const ref = db().collection("posts").doc();
  const batch = db().batch();
  batch.set(ref, {
    business_id: s.business.id, author_id: s.user.id, type: d.type, caption: d.caption ?? null, project_id: d.projectId ?? null,
    service_id: service?.exists ? service.id : null, service: service?.exists ? { name: service.get("name"), slug: service.get("slug") } : null,
    location_text: d.locationText ?? null, media, is_public: true, is_hidden: false, visible: isVisible(b),
    // Linked to a job the business marked completed in BuildFlow: shown as "Verified job".
    verified_job: project?.get("status") === "completed", completed_on: (project?.get("completed_at") as string | null)?.slice(0, 10) ?? null,
    // Flattened copy (FIRESTORE_SCHEMA_V2.md §3.18) so feed filters use plain indexes.
    region_id: b.region_id ?? null,
    business: postSnapshot(b, s.business.id),
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
  const comments = await ref.collection("comments").limit(400).get(); // V1 data
  const batch = db().batch();
  comments.docs.forEach((c) => batch.delete(c.ref));
  batch.delete(ref);
  await batch.commit();
  // Remove the images too: their public URLs must stop working (audit C.2.6).
  await deleteObjects((post.get("media") as { url: string }[] | undefined ?? []).map((m) => pathFromPublicUrl(m.url)));
  await recountPosts(s.business.id);
  return { ok: true, redirectTo: `/contractor/${s.business.slug}` };
}

// ---------------- Saves (a customer's shortlist) ----------------
// BuildFlow deliberately has no likes, comments or follower counts: they
// don't help a customer hire or a contractor get work (PRODUCT_STRATEGY_V2.md
// §9). Saving work or a contractor is a private shortlist for comparing.
export async function toggleSave(postId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  const post = await visiblePost(postId);
  if (!post) return { ok: false, error: "Post not available" };
  const marker = db().collection("users").doc(c.userId).collection("saves").doc(postId);
  const on = await db().runTransaction(async (tx) => {
    const exists = (await tx.get(marker)).exists;
    if (exists) {
      tx.delete(marker);
      tx.update(post.ref, { save_count: inc(-1) });
    } else {
      tx.set(marker, { created_at: now(), business_id: post.get("business_id") });
      tx.update(post.ref, { save_count: inc() });
      addEvent(tx, post.get("business_id"), "save");
    }
    return !exists;
  });
  return { ok: true, on };
}

/** Shortlists a contractor (users/{uid}/following). Private: no public counts, no notifications. */
export async function toggleSaveContractor(businessId: string): Promise<ToggleResult> {
  const c = await signedIn();
  if (!c) return { ok: false, needsAuth: true };
  if (!isId(businessId)) return { ok: false, error: "Business not found" };
  const t = tenant(businessId);
  const biz = await t.root.get();
  if (!biz.exists || !isVisible(biz.data() as Business)) return { ok: false, error: "Business not available" };
  const mine = db().collection("users").doc(c.userId).collection("following").doc(businessId);
  const on = await db().runTransaction(async (tx) => {
    const exists = (await tx.get(mine)).exists;
    if (exists) tx.delete(mine);
    else { tx.set(mine, { created_at: now() }); addEvent(tx, businessId, "save"); }
    return !exists;
  });
  return { ok: true, on };
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

  // "Request a similar job": remember which piece of work prompted the enquiry.
  const refPost = d.postId ? await db().collection("posts").doc(d.postId).get() : null;
  const reference = refPost?.exists && refPost.get("business_id") === d.businessId && refPost.get("visible")
    ? { id: refPost.id, caption: excerpt(refPost.get("caption") as string | null), service_id: refPost.get("service_id") as string | null }
    : null;
  const service = (d.serviceId ?? reference?.service_id) ? await db().collection("services").doc((d.serviceId ?? reference?.service_id)!).get() : null;
  const qrRef = t.col("quote_requests").doc();
  const leadRef = t.col("leads").doc();
  const ts = now();
  const description = [
    d.description, d.budgetRange && `Budget: ${d.budgetRange}`, d.timeline && `Timeline: ${d.timeline}`,
    reference && `Saw your work: ${reference.caption ?? "a portfolio post"}`,
  ].filter(Boolean).join("\n");
  const batch = db().batch();
  // Same person asking again (same phone or email) joins their existing customer record.
  const customer = await findOrCreateCustomer(t, { name: d.name, phone: d.phone, email: d.email, address: d.location }, null);
  batch.set(qrRef, {
    requester_id: s.user?.id ?? null, name: d.name, email: d.email ?? null, phone: d.phone ?? null, service_id: service?.exists ? service.id : null,
    location: d.location ?? null, description: d.description, budget_range: d.budgetRange ?? null, timeline: d.timeline ?? null, kind: d.kind, lead_id: leadRef.id, created_at: ts,
  });
  batch.set(leadRef, {
    name: d.name, name_lower: d.name.toLowerCase(), phone: d.phone ?? null, email: d.email ?? null, location: d.location ?? null, description,
    service_id: service?.exists ? service.id : null, service_name: service?.exists ? service.get("name") : null, status: "new", source: "buildflow",
    estimated_value: null, assigned_to: null, customer_id: customer.id, customer_name: customer.name, project_id: null, next_follow_up: null, phone_digits: phoneDigits(d.phone),
    quote_request_id: qrRef.id, quote: { budget_range: d.budgetRange ?? null, timeline: d.timeline ?? null }, reference_post_id: reference?.id ?? null,
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
  addActivity(batch, d.businessId, { actorId: s.user?.id ?? null, actorName: d.name.slice(0, 80), entityType: "lead", entityId: leadRef.id, leadId: leadRef.id, customerId: customer.id, action: "created", summary: `${d.kind === "quote" ? "Quote request received from" : "Contact request from"} ${d.name.slice(0, 80)}` });
  await batch.commit();
  const reply = responseLabel(b);
  return { ok: true, message: `Sent to ${b.name}.${reply ? ` ${reply.replace("Usually replies", "They usually reply")}` : " They'll be in touch soon"}, by WhatsApp or phone.` };
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

/** Counts taps on a contractor's WhatsApp/phone button (insights: "contact clicks"). */
export async function trackContact(businessId: string) {
  if (!isId(businessId)) return;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`contact:${ip}:${businessId}`, 5, 60 * 60_000).ok) return;
  const biz = await tenant(businessId).root.get();
  if (!biz.exists || !isVisible(biz.data() as Business)) return;
  const batch = db().batch();
  addEvent(batch, businessId, "contact_click");
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
