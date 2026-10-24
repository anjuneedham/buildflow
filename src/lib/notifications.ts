import "server-only";
import { db } from "@/lib/firebase/admin";

/** Unread badge: a count() aggregation (1 read per 1,000 entries), never a document fetch. */
export async function unreadCount(userId: string) {
  const snap = await db().collection("users").doc(userId).collection("notifications").where("read_at", "==", null).count().get();
  return snap.data().count;
}
