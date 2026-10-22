import type { Metadata } from "next";

export const metadata: Metadata = { title: "About", description: "BuildFlow is a construction business operating system for contractors and the customers who hire them." };

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold md:text-4xl">About BuildFlow</h1>
      <div className="prose-legal">
        <p>Most construction businesses run on WhatsApp threads, notebooks and word of mouth. The work is excellent; the system around it isn&apos;t. Good contractors lose jobs because customers can&apos;t find them or can&apos;t see what they&apos;ve built.</p>
        <p>BuildFlow puts the business and the reputation in one place. Contractors manage leads, customers and projects, and every finished job can become a public showcase that brings in the next one.</p>
        <p>We&apos;re starting in Jamaica and the Caribbean, and building for contractors everywhere.</p>
      </div>
    </main>
  );
}
