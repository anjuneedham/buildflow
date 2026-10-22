import "server-only";
import type { DocumentSnapshot, Query, QuerySnapshot } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

export const now = () => new Date().toISOString();
export const newId = () => db().collection("_").doc().id;

export function fromDoc<T>(snap: DocumentSnapshot): T | null {
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T) : null;
}
export function fromQuery<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}
export async function list<T>(q: Query): Promise<T[]> {
  return fromQuery<T>(await q.get());
}
export async function count(q: Query): Promise<number> {
  return (await q.count().get()).data().count;
}

/** Firestore auto-ids (20 chars) or our readable demo ids. */
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
