"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { burst, prefersReducedMotion } from "@/lib/motion";

export type Mood = "lost" | "oops";

const LINES: Record<Mood, string[]> = {
  lost: ["Psst, over here!", "I had a map. It had a plan.", "Is this left, or is this up?", "Home is probably that way.", "Hee hee, that tickles."],
  oops: ["Oops, butterfingers.", "Totally fine. Mostly fine.", "Hold still, patching it up.", "Take two?", "Hee hee, that tickles."],
};
const SPARKS = ["#bccf67", "#e4f0a0", "#f0b45a", "#f4cfa4", "#fff3d6"];

/**
 * The page's character: the logo's card and bookmark with a face. Its eyes follow the pointer (and look around
 * by themselves when nothing moves), it floats, blinks and waves, and poking it makes it hop and say something.
 */
export function Buddy({ mood }: { mood: Mood }) {
  const root = useRef<HTMLButtonElement>(null);
  const [line, setLine] = useState(0);
  const [talking, setTalking] = useState(false);
  const lines = LINES[mood];

  useEffect(() => {
    if (prefersReducedMotion() || !root.current) return;
    const el = root.current;
    const pupils = Array.from(el.querySelectorAll<SVGGElement>("[data-pupil]"));
    const moveX = pupils.map((p) => gsap.quickTo(p, "x", { duration: 0.35, ease: "power3.out" }));
    const moveY = pupils.map((p) => gsap.quickTo(p, "y", { duration: 0.35, ease: "power3.out" }));
    const look = (x: number, y: number) => { moveX.forEach((m) => m(x)); moveY.forEach((m) => m(y)); };
    let lastPointer = 0;
    const onMove = (e: PointerEvent) => {
      lastPointer = performance.now();
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220);
      look((dx / d) * 8 * k, (dy / d) * 7 * k);
    };
    // with no pointer around (a phone, or a still mouse) it glances about on its own
    const idle = setInterval(() => {
      if (performance.now() - lastPointer < 2600) return;
      look(gsap.utils.random(-8, 8), gsap.utils.random(-5, 6));
    }, 1900);
    addEventListener("pointermove", onMove, { passive: true });
    return () => { removeEventListener("pointermove", onMove); clearInterval(idle); gsap.killTweensOf(pupils); };
  }, []);

  function poke() {
    const el = root.current;
    setLine((n) => (n + 1) % lines.length);
    setTalking(true);
    if (!el || prefersReducedMotion()) return;
    const body = el.querySelector<HTMLElement>(".oops-hop");
    if (body && !gsap.isTweening(body)) {
      gsap.timeline()
        .to(body, { scaleX: 1.12, scaleY: 0.84, duration: 0.12, ease: "power2.out", transformOrigin: "50% 100%" })
        .to(body, { scaleX: 0.94, scaleY: 1.1, y: -86, rotation: gsap.utils.random(-7, 7), duration: 0.34, ease: "power2.out" })
        .to(body, { y: 0, scaleX: 1.1, scaleY: 0.88, rotation: 0, duration: 0.3, ease: "power2.in" })
        .to(body, { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1.1, 0.4)" });
    }
    burst(el, 12, SPARKS);
  }
  useEffect(() => {
    if (!talking) return;
    const t = setTimeout(() => setTalking(false), 2600);
    return () => clearTimeout(t);
  }, [talking, line]);

  return (
    <button ref={root} type="button" className={`oops-buddy oops-buddy--${mood}`} onClick={poke} aria-label="Say hi to the character">
      <span className={`oops-bubble${talking ? " is-on" : ""}`} aria-live="polite" key={line}>{talking ? lines[line] : ""}</span>
      <svg viewBox="0 0 360 380" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="bd-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0f8b8" /><stop offset="1" stopColor="#bccf67" /></linearGradient>
          <linearGradient id="bd-back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8b85a" /><stop offset="1" stopColor="#74823d" /></linearGradient>
          <radialGradient id="bd-glow"><stop offset="0" stopColor="#bccf67" stopOpacity=".35" /><stop offset="1" stopColor="#bccf67" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="180" cy="190" r="170" fill="url(#bd-glow)" className="oops-glow" />
        <ellipse className="oops-shadow" cx="180" cy="352" rx="92" ry="12" fill="#000" opacity=".45" />
        {mood === "oops" && (
          <g className="oops-orbit" fill="#f0b45a">
            <path className="oops-star" d="M0 -12 L3.6 -3.6 L12 0 L3.6 3.6 L0 12 L-3.6 3.6 L-12 0 L-3.6 -3.6z" transform="translate(76 40)" />
            <path className="oops-star" d="M0 -9 L2.7 -2.7 L9 0 L2.7 2.7 L0 9 L-2.7 2.7 L-9 0 L-2.7 -2.7z" transform="translate(186 -6)" fill="#f4cfa4" />
            <path className="oops-star" d="M0 -12 L3.6 -3.6 L12 0 L3.6 3.6 L0 12 L-3.6 3.6 L-12 0 L-3.6 -3.6z" transform="translate(296 44)" fill="#e4f0a0" />
            <path className="oops-star" d="M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4z" transform="translate(186 236)" fill="#f0b45a" />
          </g>
        )}
        <g className="oops-hop">
          <g className="oops-float">
            <rect x="84" y="74" width="172" height="228" rx="40" transform="rotate(-9 170 188)" fill="url(#bd-back)" stroke="#e4f0a0" strokeOpacity=".25" strokeWidth="2" />
            <ellipse cx="146" cy="316" rx="26" ry="13" fill="#74823d" /><ellipse cx="216" cy="316" rx="26" ry="13" fill="#74823d" />
            <path className="oops-arm oops-arm--l" d="M104 214 C78 222 66 242 70 262" stroke="#a5b552" strokeWidth="17" strokeLinecap="round" fill="none" />
            <rect x="100" y="62" width="172" height="244" rx="42" fill="url(#bd-front)" stroke="#f7ffd0" strokeOpacity=".8" strokeWidth="3" />
            <path d="M126 84 C150 74 190 72 214 78" stroke="#fff" strokeOpacity=".55" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M218 62 h38 v64 l-19 -15 l-19 15 z" fill="#f0b45a" stroke="#fff3d6" strokeOpacity=".6" strokeWidth="2" strokeLinejoin="round" />
            <g className="oops-eye" transform="translate(150 172)"><ellipse rx="25" ry="29" fill="#fff8e6" /><g data-pupil><circle r="13" fill="#26210f" /><circle cx="4" cy="-5" r="4.5" fill="#fff" /></g></g>
            <g className="oops-eye" transform="translate(224 172)"><ellipse rx="25" ry="29" fill="#fff8e6" /><g data-pupil><circle r="13" fill="#26210f" /><circle cx="4" cy="-5" r="4.5" fill="#fff" /></g></g>
            <ellipse cx="128" cy="214" rx="16" ry="9.5" fill="#f4b88a" opacity=".8" /><ellipse cx="246" cy="214" rx="16" ry="9.5" fill="#f4b88a" opacity=".8" />
            {mood === "lost" ? (
              <g className="oops-mouth"><ellipse cx="187" cy="226" rx="9" ry="11" fill="#3a2c14" /><ellipse cx="187" cy="232" rx="5" ry="4" fill="#f4b88a" /></g>
            ) : (
              <g>
                <path d="M122 134 q14 -10 30 -4 M232 128 q16 -6 30 4" stroke="#3a2c14" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path className="oops-mouth" d="M166 228 q7 -9 14 0 t14 0 t14 0" stroke="#3a2c14" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path className="oops-drop" d="M266 150 q-12 20 0 30 q12 -10 0 -30z" fill="#f4cfa4" stroke="#fff3d6" strokeWidth="2" />
                <g transform="rotate(-24 128 272)"><rect x="100" y="262" width="56" height="22" rx="8" fill="#f4cfa4" stroke="#e0a878" strokeWidth="2" /><circle cx="120" cy="273" r="2" fill="#e0a878" /><circle cx="136" cy="273" r="2" fill="#e0a878" /></g>
              </g>
            )}
            {mood === "lost" ? (
              <g className="oops-arm oops-arm--r">
                <path d="M268 210 C300 206 316 184 314 156" stroke="#a5b552" strokeWidth="17" strokeLinecap="round" fill="none" />
                <g transform="rotate(14 318 126)"><rect x="288" y="82" width="62" height="74" rx="7" fill="#fff3d6" stroke="#d9b15a" strokeWidth="3" /><path d="M298 138 q10 -26 22 -8 t20 -26" stroke="#d9b15a" strokeWidth="3" strokeDasharray="5 6" strokeLinecap="round" fill="none" /><text x="319" y="116" textAnchor="middle" fontSize="30" fontWeight="700" fill="#f0b45a">?</text></g>
              </g>
            ) : (
              <path className="oops-arm oops-arm--r" d="M268 214 C294 206 308 184 304 160" stroke="#a5b552" strokeWidth="17" strokeLinecap="round" fill="none" />
            )}
          </g>
        </g>
        {mood === "lost" ? (
          <g fontWeight="700" fill="#f0b45a">
            <text className="oops-q oops-q1" x="40" y="120" fontSize="40">?</text>
            <text className="oops-q oops-q2" x="300" y="70" fontSize="30" fill="#f4cfa4">?</text>
            <text className="oops-q oops-q3" x="52" y="300" fontSize="26" fill="#e4f0a0">?</text>
          </g>
        ) : null}
      </svg>
    </button>
  );
}
