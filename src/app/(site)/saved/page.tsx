import { Bookmark, Users } from "lucide-react";
import { PostCard } from "@/components/cards/post-card";
import { ContractorCard } from "@/components/cards/contractor-card";
import { ButtonLink, EmptyState, Tabs } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/data/db";
import { getFeed, getViewerState } from "@/lib/queries";
import type { Business } from "@/lib/types";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Saved", robots: { index: false } };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser("/saved");
  const { tab = "posts" } = await searchParams;
  const me = db().collection("users").doc(s.user.id);

  let content: React.ReactNode;
  if (tab === "following") {
    const following = await me.collection("following").orderBy("created_at", "desc").limit(100).get();
    const snaps = following.empty ? [] : await db().getAll(...following.docs.map((f) => db().collection("businesses").doc(f.id)));
    const businesses = snaps.map((x) => fromDoc<Business>(x)).filter((b): b is Business => Boolean(b && b.is_public && !b.is_suspended));
    content = businesses.length === 0
      ? <EmptyState icon={Users} title="You're not following anyone yet" description="Follow contractors to keep up with their latest work." action={<ButtonLink href="/explore?tab=contractors">Find contractors</ButtonLink>} />
      : <div className="grid gap-4 sm:grid-cols-2">{businesses.map((b) => <ContractorCard key={b.id} business={b} />)}</div>;
  } else {
    const saves = await me.collection("saves").orderBy("created_at", "desc").limit(60).get();
    const ids = saves.docs.map((d) => d.id);
    const posts = ids.length ? await getFeed({ postIds: ids, limit: 60 }) : [];
    const viewer = await getViewerState(s.user.id, ids);
    content = posts.length === 0
      ? <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap the bookmark on any post to save ideas for your project." action={<ButtonLink href="/explore">Explore work</ButtonLink>} />
      : <div className="space-y-5">{posts.map((p) => <PostCard key={p.id} post={p} liked={viewer.liked.has(p.id)} saved />)}</div>;
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold">Saved</h1>
      <Tabs className="mb-5 mt-2" active={tab} tabs={[{ key: "posts", label: "Saved work", href: "/saved" }, { key: "following", label: "Following", href: "/saved?tab=following" }]} />
      {content}
    </main>
  );
}
