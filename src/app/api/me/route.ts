import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export type Me =
  | { signedIn: false }
  | {
      signedIn: true; name: string; avatarUrl: string | null; isAdmin: boolean; needsOnboarding: boolean;
      business: { slug: string; name: string } | null; unread: number;
    };

/**
 * Who is signed in, for the client-rendered public header. Public pages stay
 * static because only this endpoint reads the session (ARCHITECTURE_V2.md §2.1).
 */
export async function GET() {
  const s = await getSession();
  const body: Me = !s.user ? { signedIn: false } : {
    signedIn: true,
    name: s.profile?.full_name || s.user.email || "",
    avatarUrl: s.profile?.avatar_url ?? null,
    isAdmin: s.isAdmin,
    needsOnboarding: !s.membership && s.profile?.account_type === "contractor",
    business: s.membership ? { slug: s.membership.business.slug, name: s.membership.business.name } : null,
    unread: s.membership ? await unreadCount(s.user.id) : 0,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
