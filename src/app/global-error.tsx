"use client";

// Last resort when the root layout itself fails: no app styles or providers
// can be assumed, so this is plain, self-contained HTML.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f7f6f3", color: "#1c2127" }}>
        <main style={{ maxWidth: 420, margin: "20vh auto", padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>BuildFlow couldn&apos;t load</h1>
          <p style={{ color: "#59626d" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ background: "#c2410c", color: "#fff", border: 0, borderRadius: 8, padding: "12px 20px", fontWeight: 600, fontSize: 15 }}>Try again</button>
          {error.digest && <p style={{ color: "#59626d", fontSize: 12 }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
