import gsap from "gsap";

// GSAP helpers for the main interactions. Every one of them does nothing when the visitor asked the
// system for reduced motion, and the CSS fallbacks in styles/motion.css still apply in that case.

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A real mouse or trackpad, not a touch screen: hover effects only make sense there. */
export const hasFinePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** A dialog rises with a soft overshoot and comes into focus. Returns a clean up. */
export function springIn(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};
  el.style.animation = "none"; // the CSS entrance would fight the tween
  const tween = gsap.fromTo(el,
    { y: 34, scale: 0.93, opacity: 0, filter: "blur(8px)" },
    { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.65, ease: "back.out(1.6)", clearProps: "transform,opacity,filter" });
  return () => { tween.kill(); gsap.set(el, { clearProps: "transform,opacity,filter" }); };
}

/** New table rows drop in one after another and glow lime for a moment, so it is clear what was added. */
export function rowArrival(rows: HTMLElement[]): void {
  if (prefersReducedMotion() || !rows.length) return;
  const cells = rows.flatMap((r) => Array.from(r.children) as HTMLElement[]);
  gsap.fromTo(rows, { opacity: 0, y: -16, filter: "blur(4px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.09, ease: "power3.out", clearProps: "opacity,transform,filter" });
  gsap.fromTo(cells, { boxShadow: "inset 0 0 0 999px rgba(188, 207, 103, 0.32)" },
    { boxShadow: "inset 0 0 0 999px rgba(188, 207, 103, 0)", duration: 1.5, delay: 0.25, ease: "power2.out", clearProps: "boxShadow" });
}

const BURST = ["#bccf67", "#e4f0a0", "#8e9c4e", "#ffffff"];

/** Small sparks fly out of an element, for the moment an action succeeds. */
export function burst(el: HTMLElement, count = 14, colors: string[] = BURST): void {
  if (prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:0;height:0;pointer-events:none;z-index:9999`;
  document.body.appendChild(layer);
  const sparks = Array.from({ length: count }, (_, i) => {
    const s = document.createElement("i");
    const size = gsap.utils.random(3, 7);
    s.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px;border-radius:${i % 3 ? "50%" : "2px"};background:${colors[i % colors.length]}`;
    layer.appendChild(s);
    return s;
  });
  gsap.timeline({ onComplete: () => layer.remove() })
    .to(sparks, {
      x: (i) => Math.cos((i / count) * Math.PI * 2 + gsap.utils.random(-0.25, 0.25)) * gsap.utils.random(r.height * 0.9, r.height * 1.9 + 18),
      y: (i) => Math.sin((i / count) * Math.PI * 2 + gsap.utils.random(-0.25, 0.25)) * gsap.utils.random(r.height * 0.9, r.height * 1.9 + 18),
      rotation: () => gsap.utils.random(-200, 200), duration: 0.85, ease: "power3.out",
    }, 0)
    .to(sparks, { opacity: 0, scale: 0.2, duration: 0.45, ease: "power1.in" }, 0.4);
}

/**
 * Sign-in page: the dome drifts against the cursor for depth, and the Google button leans toward the
 * pointer when it comes close. Mouse only; returns a clean up.
 */
export function signinPointerMotion(): () => void {
  if (prefersReducedMotion() || !hasFinePointer()) return () => {};
  const dome = document.querySelector<HTMLElement>(".dome");
  const pill = document.querySelector<HTMLElement>(".gsi-pill");
  const domeX = dome && gsap.quickTo(dome, "x", { duration: 1.2, ease: "power3.out" });
  const domeY = dome && gsap.quickTo(dome, "y", { duration: 1.2, ease: "power3.out" });
  const pillX = pill && gsap.quickTo(pill, "x", { duration: 0.45, ease: "power3.out" });
  const pillY = pill && gsap.quickTo(pill, "y", { duration: 0.45, ease: "power3.out" });
  const onMove = (e: PointerEvent) => {
    domeX?.(-(e.clientX / innerWidth - 0.5) * 30);
    domeY?.(-(e.clientY / innerHeight - 0.5) * 22);
    if (pill && pillX && pillY) {
      const r = pill.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (gsap.getProperty(pill, "x") as number);
      const cy = r.top + r.height / 2 - (gsap.getProperty(pill, "y") as number);
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
      pillX(near ? gsap.utils.clamp(-10, 10, dx * 0.06) : 0);
      pillY(near ? gsap.utils.clamp(-6, 6, dy * 0.2) : 0);
    }
  };
  const onLeave = () => { domeX?.(0); domeY?.(0); pillX?.(0); pillY?.(0); };
  addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  return () => {
    removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    gsap.set([dome, pill].filter(Boolean) as HTMLElement[], { clearProps: "transform,translate" });
  };
}
