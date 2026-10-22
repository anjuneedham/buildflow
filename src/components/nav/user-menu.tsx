"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";

export function UserMenu({ name, avatar, links }: { name: string; avatar: ReactNode; links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className="flex h-10 items-center rounded-full">
        {avatar}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-xl border border-concrete-200 bg-white py-1 shadow-lg">
          <p className="truncate border-b border-concrete-200 px-4 py-2.5 text-sm font-semibold text-ink">{name}</p>
          {links.map((l) => (
            <Link key={l.href} role="menuitem" href={l.href} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-ink-600 hover:bg-concrete-50 hover:text-ink">{l.label}</Link>
          ))}
          <form action={signOut} className="border-t border-concrete-200">
            <button role="menuitem" className="w-full px-4 py-2.5 text-left text-sm text-site-red hover:bg-concrete-50">Log out</button>
          </form>
        </div>
      )}
    </div>
  );
}
