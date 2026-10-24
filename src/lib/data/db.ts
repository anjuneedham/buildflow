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

export { ID_RE, isId } from "@/lib/ids";
