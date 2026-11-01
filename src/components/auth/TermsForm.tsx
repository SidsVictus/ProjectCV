"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptTerms } from "@/app/actions/portfolio";
import { SignOutButton } from "./SignOutButton";

export function TermsForm() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setBusy(true); setError("");
    const r = await acceptTerms();
    if (r.ok) router.replace("/setup"); else { setError(r.error); setBusy(false); }
  }
  return (
    <>
      <label style={{ display: "flex", gap: 12, alignItems: "center", padding: 16, borderRadius: 14, border: "1px solid var(--border-control)", background: "var(--surface-inset)", cursor: "pointer", fontSize: 14, lineHeight: "20px", color: "var(--text)" }}>
        <input className="pcv-check" type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
        <span>I agree to the <a href="/legal/terms" target="_blank" style={{ color: "#bccf67" }}>Terms &amp; Conditions</a> and <a href="/legal/privacy" target="_blank" style={{ color: "#bccf67" }}>Privacy Policy</a>.</span>
      </label>
      {error && <p role="alert" style={{ margin: 0, color: "#bccf67", fontSize: 14 }}>{error}</p>}
      <div className="pcv-auth__actions">
        <button type="button" className="pcv-btn pcv-btn--primary" disabled={!agreed || busy} onClick={accept}>Accept and continue</button>
        <SignOutButton className="pcv-btn pcv-btn--ghost" label="Cancel" />
      </div>
    </>
  );
}
