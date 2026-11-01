/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveProfile } from "@/app/actions/portfolio";
import { CvHeader } from "@/components/cv/CvHeader";
import { cvVars, type Colours, type ProfileFields } from "@/lib/cv";

type Key = keyof ProfileFields;

export function SetupForm({ initial, editing, wallpaper, colours }: { initial: ProfileFields; editing: boolean; wallpaper: string; colours: Colours }) {
  const router = useRouter();
  const [pd, setPd] = useState(initial);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const on = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPd({ ...pd, [k]: e.target.value });
  const bad = (k: "full_name" | "headline") => (err && !pd[k].trim() ? "setup-err" : "");

  async function save() {
    if (!pd.full_name.trim() || !pd.headline.trim()) { setErr(true); return; }
    setBusy(true); setMsg("");
    const r = await saveProfile(pd);
    if (r.ok) router.replace("/portfolio"); else { setMsg(r.error); setBusy(false); }
  }

  const field = (k: Key, label: React.ReactNode, ph: string, full = false, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label className={`setup-field ${k === "full_name" || k === "headline" ? bad(k) : ""}`} style={full ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      <input className="setup-input" value={pd[k]} onChange={on(k)} placeholder={ph} {...extra} />
    </label>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#020105", display: "flex", flexWrap: "wrap" }}>
      <div className="screen-in" style={{ flex: "1 1 520px", minWidth: 0, boxSizing: "border-box", padding: "40px clamp(24px, 5vw, 72px) 56px", display: "flex", flexDirection: "column", gap: 28 }}>
        <img src="/brand/logo-mark.png" alt="Project CV" style={{ width: 52, height: 52 }} />
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0, font: "600 12px/16px var(--font-sans)", letterSpacing: ".16em", textTransform: "uppercase", color: "#727d40" }}>{editing ? "Your details" : "Almost there · About you"}</p>
          <h1 style={{ margin: 0, font: "italic 300 clamp(44px, 5vw, 64px)/1 var(--font-display)", letterSpacing: "-.02em", color: "#bccf67" }}>Tell people who you are.</h1>
          <p style={{ margin: 0, maxWidth: "34em", fontSize: 17, lineHeight: "27px", color: "#a6b65b" }}>This sits at the top of your page, above your projects. You can change it any time.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px 16px" }}>
          {field("full_name", <>Full name <em>required</em></>, "Your name as you want it shown", true, { maxLength: 80, autoComplete: "name" })}
          {field("headline", <>Headline <em>required</em></>, "e.g. B.Tech Data Science student", true, { maxLength: 120 })}
          {field("org", "College or organisation", "e.g. MVSR Engineering College", false, { maxLength: 120 })}
          {field("grad_year", "Graduation year", "e.g. 2028", false, { maxLength: 10 })}
          {field("location", "Location", "e.g. Hyderabad, India", true, { maxLength: 80 })}
          <label className="setup-field" style={{ gridColumn: "1 / -1" }}>
            <span>A line about you <em>{pd.about.length} / 160</em></span>
            <textarea className="setup-input" rows={3} maxLength={160} value={pd.about} onChange={on("about")} placeholder="What you build and what you care about." style={{ resize: "none" }} />
          </label>
          {field("linkedin", "LinkedIn", "linkedin.com/in/you", false, { maxLength: 200 })}
          {field("github", "GitHub", "github.com/you", false, { maxLength: 200 })}
          {field("website", "Website or other link", "yourname.dev", true, { maxLength: 200 })}
        </div>
        {err && (!pd.full_name.trim() || !pd.headline.trim()) && <p role="alert" style={{ margin: 0, color: "#bccf67", fontSize: 14 }}>Add your name and a headline to continue.</p>}
        {msg && <p role="alert" style={{ margin: 0, color: "#bccf67", fontSize: 14 }}>{msg}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="pcv-btn pcv-btn--primary pcv-btn--lg" onClick={save} disabled={busy}>{editing ? "Save details" : "Create my page"}</button>
          {editing && <a className="pcv-btn pcv-btn--ghost pcv-btn--lg" href="/portfolio">Cancel</a>}
        </div>
      </div>
      <div className={`wp wp-box wp-${wallpaper}`} style={{ flex: "1 1 480px", minWidth: 0, minHeight: 520, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px", boxSizing: "border-box" }}>
        <div className="cv-pane" style={{ ...(cvVars(colours) as React.CSSProperties), width: "100%", maxWidth: 560, animation: "satin-rise var(--satin-fall) var(--satin-glide) .2s both" }}>
          <CvHeader profile={pd} count={null} nameAs="h2" nameSize={48} staticLinks />
          <p style={{ margin: "12px 0 0", paddingTop: 14, borderTop: "1px dashed var(--cv-line)", font: "italic 300 18px/24px var(--font-display)", color: "var(--cv-ink-soft)" }}>Your projects table appears here.</p>
        </div>
        <span style={{ position: "absolute", top: 18, left: "50%", translate: "-50% 0", padding: "6px 14px", borderRadius: 999, background: "rgba(2,1,5,.6)", color: "#bccf67", fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" }}>Live preview</span>
      </div>
    </div>
  );
}
