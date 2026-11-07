"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { hasFinePointer, prefersReducedMotion } from "@/lib/motion";
import "@/styles/oops.css";
import { Buddy, type Mood } from "./Buddy";

const COPY: Record<Mood, { code: string; eyebrow: string; title: string; text: string }> = {
  lost: {
    code: "404", eyebrow: "Error 404", title: "This page went wandering.",
    text: "The address might have a typo, or the person who owns it moved things around. No harm done. Pick a way back below.",
  },
  oops: {
    code: "500", eyebrow: "Error 500", title: "We dropped something.",
    text: "That one is on us, not you. Your projects are safe and nothing you did caused this. Give it a moment and try again.",
  },
};

/**
 * The page for broken links and site errors. Plain links on purpose: it also renders where the site's layout and
 * page transitions are not loaded (a crash in the layout, or an address that matches nothing).
 */
export function ErrorScreen({ mood, retry, digest, plain = false }: { mood: Mood; retry?: () => void; digest?: string; plain?: boolean }) {
  const copy = COPY[mood];
  const root = useRef<HTMLDivElement>(null);

  // the background drifts a little against the pointer, in layers, for depth (mouse only)
  useEffect(() => {
    if (prefersReducedMotion() || !hasFinePointer() || !root.current) return;
    const layers = Array.from(root.current.querySelectorAll<HTMLElement>("[data-depth]"));
    const to = layers.map((l) => ({ x: gsap.quickTo(l, "x", { duration: 1.2, ease: "power3.out" }), y: gsap.quickTo(l, "y", { duration: 1.2, ease: "power3.out" }), d: Number(l.dataset.depth) }));
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      to.forEach((t) => { t.x(-nx * t.d); t.y(-ny * t.d); });
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); gsap.killTweensOf(layers); };
  }, []);

  return (
    <div ref={root} className="oops">
      <div className="oops-bg" aria-hidden="true">
        <i className="oops-blob oops-blob--a" data-depth="40" /><i className="oops-blob oops-blob--b" data-depth="70" /><i className="oops-blob oops-blob--c" data-depth="55" />
        <span className="oops-big" data-depth="26">{copy.code}</span>
        {[["7%", "22%", "-14deg", "13s", ".9"], ["18%", "74%", "9deg", "16s", ".7"], ["46%", "10%", "6deg", "12s", ".6"], ["62%", "86%", "-8deg", "15s", "1"], ["84%", "18%", "12deg", "14s", ".8"], ["92%", "66%", "-10deg", "17s", ".65"]].map(([x, y, r, d, s], i) => (
          <i key={i} className="oops-page" data-depth={20 + i * 8} style={{ left: x, top: y, "--r": r, "--d": d, "--s": s } as React.CSSProperties}><b /></i>
        ))}
        {[["12%", "46%", "0s"], ["30%", "14%", ".8s"], ["54%", "62%", "1.6s"], ["71%", "30%", "2.2s"], ["88%", "44%", ".4s"], ["40%", "88%", "1.2s"]].map(([x, y, dl], i) => (
          <i key={i} className="oops-spark" style={{ left: x, top: y, animationDelay: dl }} />
        ))}
      </div>

      <header className="oops-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="Project CV home"><img src="/brand/logo-mark.png" alt="" width="44" height="44" /><span>Project CV</span></a>
      </header>

      <main className="oops-main">
        <div className="oops-copy">
          <p className="oops-eyebrow">{copy.eyebrow}</p>
          <h1 className="oops-title" aria-label={copy.title}>
            {copy.title.split(" ").map((word, w, words) => (
              <span className="oops-word" key={w} aria-hidden="true">
                {Array.from(word).map((ch, i) => <span className="oops-l" key={i} style={{ "--i": words.slice(0, w).join(" ").length + w + i } as React.CSSProperties}>{ch}</span>)}
              </span>
            ))}
          </h1>
          <p className="oops-text">{copy.text}</p>
          <div className="oops-actions">
            {/* plain: the last-resort crash page cannot count on scripts, so "Try again" is a link that reloads this address */}
            {retry && !plain && <button type="button" className="oops-btn" onClick={retry}>Try again</button>}
            {mood === "oops" && plain && <a className="oops-btn" href="">Try again</a>}
            <a className={mood === "oops" ? "oops-btn oops-btn--ghost" : "oops-btn"} href="/">Take me to the start</a>
            {mood === "lost" && <button type="button" className="oops-btn oops-btn--ghost" onClick={() => { if (history.length > 1) history.back(); else document.querySelector<HTMLAnchorElement>(".oops-actions a[href=\"/\"]")?.click(); }}>Go back</button>}
          </div>
          <nav className="oops-links" aria-label="Places to go">
            <p>Ways back</p>
            <a href="/">Sign in or create your page</a>
            <a href="/legal/terms">Terms &amp; Conditions</a>
            <a href="/legal/privacy">Privacy Policy</a>
          </nav>
          {digest && <p className="oops-ref">Reference {digest}</p>}
        </div>

        <div className="oops-stage">
          <svg className="oops-route" viewBox="0 0 440 120" aria-hidden="true"><path d="M8 96 C70 16 130 122 214 62 S372 10 424 66" /><circle cx="424" cy="66" r="7" /></svg>
          <Buddy mood={mood} />
        </div>
      </main>
    </div>
  );
}
