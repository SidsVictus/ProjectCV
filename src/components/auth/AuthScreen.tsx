/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";

/** The stained-glass auth layout: logo, headline, one line, actions, legal line (DESIGN.md section 8). */
export function AuthScreen({ label, title, sub, children, legal }: {
  label: string; title: ReactNode; sub: ReactNode; children: ReactNode; legal: ReactNode;
}) {
  return (
    <section className="pcv-auth" aria-label={label} style={{ minHeight: "100vh" }}>
      <div className="pcv-auth__scene auth-scene" />
      <div className="pcv-auth__shade" />
      <span className="pcv-auth__brand"><img src="/brand/logo-full.png" alt="Project CV" /></span>
      <div className="pcv-auth__content">
        <h1 className="pcv-auth__title">{title}</h1>
        <p className="pcv-auth__sub">{sub}</p>
        {children}
      </div>
      <p className="pcv-auth__legal">{legal}</p>
    </section>
  );
}

export function LegalLine() {
  return <>By continuing you agree to the <a href="/legal/terms">Terms &amp; Conditions</a> and <a href="/legal/privacy">Privacy Policy</a>.</>;
}
