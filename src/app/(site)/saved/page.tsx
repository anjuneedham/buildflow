import { Bookmark, Users } from "lucide-react";
import { PostCard } from "@/components/cards/post-card";
import { ContractorCard } from "@/components/cards/contractor-card";
import { ButtonLink, EmptyState, Tabs } from "@/components/ui";
import { db } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/data/db";
import { getFeed } from "@/lib/queries";
import type { Business } from "@/lib/types";
import { requireUser } from "@/lib/session";
import { firstParams } from "@/lib/params";

export const metadata = { title: "Saved", robots: { index: false } };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser("/saved");
  const { tab: rawTab } = firstParams(await searchParams);
  const tab = rawTab === "contractors" || rawTab === "following" ? "contractors" : "posts";
  const me = db().collection("users").doc(s.user.id);

  let content: React.ReactNode;
  if (tab === "contractors") {
    const following = await me.collection("following").orderBy("created_at", "desc").limit(100).get();
    const snaps = following.empty ? [] : await db().getAll(...following.docs.map((f) => db().collection("businesses").doc(f.id)));
    const businesses = snaps.map((x) => fromDoc<Business>(x)).filter((b): b is Business => Boolean(b && b.is_public && !b.is_suspended));
    content = businesses.length === 0
      ? <EmptyState icon={Users} title="No saved contractors yet" description="Tap Save on a contractor's profile to shortlist them while you compare quotes. Only you can see this list." action={<ButtonLink href="/explore?tab=contractors">Find contractors</ButtonLink>} />
      : <div className="grid gap-4 sm:grid-cols-2">{businesses.map((b) => <ContractorCard key={b.id} business={b} />)}</div>;
  } else {
    const saves = await me.collection("saves").orderBy("created_at", "desc").limit(60).get();
    const ids = saves.docs.map((d) => d.id);
    const posts = ids.length ? await getFeed({ postIds: ids, limit: 60 }) : [];
    content = posts.length === 0
      ? <EmptyState icon={Bookmark} title="Nothing saved yet" description="Save finished jobs you like, then request a similar job from the contractor who did it." action={<ButtonLink href="/explore">Explore work</ButtonLink>} />
      : <div className="space-y-5">{posts.map((p) => <PostCard key={p.id} post={p} saved />)}</div>;
  }

  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-xl px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold">Saved</h1>
      <Tabs className="mb-5 mt-2" active={tab} tabs={[{ key: "posts", label: "Saved work", href: "/saved" }, { key: "contractors", label: "Contractors", href: "/saved?tab=contractors" }]} />
      {content}
    </main>
  );
}
