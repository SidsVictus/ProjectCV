/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#020105", color: "#a6b65b", padding: "40px clamp(24px, 5vw, 72px) 72px", boxSizing: "border-box" }}>
      <div className="screen-in" style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 20, fontSize: 17, lineHeight: "27px" }}>
        <Link href="/"><img src="/brand/logo-mark.png" alt="Project CV" style={{ width: 52, height: 52 }} /></Link>
        <h1 style={{ margin: 0, font: "italic 300 clamp(40px, 5vw, 56px)/1.05 var(--font-display)", color: "#bccf67" }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "#8e9c4e" }}>Last updated {updated}. Draft for review.</p>
        {children}
      </div>
    </main>
  );
}

export const H = ({ children }: { children: ReactNode }) => (
  <h2 style={{ margin: "12px 0 0", font: "italic 300 26px/32px var(--font-display)", color: "#bccf67" }}>{children}</h2>
);
