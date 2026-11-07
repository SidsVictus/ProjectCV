"use client";

import gsap from "gsap";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

type Go = (href: string, opts?: { replace?: boolean; from?: Element | null }) => void;
const GoContext = createContext<Go>(() => {});

/** Moves to another screen with the iris transition (falls back to a plain move). */
export const useGo = () => useContext(GoContext);

const farthest = (x: number, y: number) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 48;
const tween = (target: gsap.TweenTarget, vars: gsap.TweenVars) => new Promise<void>((resolve) => { gsap.to(target, { ...vars, onComplete: () => resolve() }); });

/** Resolves when the new screen has really arrived: the path changed and no skeleton is showing (or after a limit). */
function arrived(path: () => string, start: string, limit = 9000): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      const moved = path() !== start, skeleton = !!document.querySelector(".ld, .ld-signin, .adm-ld");
      if ((moved && !skeleton) || performance.now() - t0 > limit) { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); return; }
      setTimeout(check, 60);
    };
    check();
  });
}

/**
 * Screen to screen, the page does not swap: the dome irises shut from where you clicked, the next
 * screen loads out of sight behind it, then the dome opens from the centre. The overlay is the only
 * thing on screen while the next page loads, so no skeleton or spinner is ever seen on these moves.
 */
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const busy = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const dome = useRef<HTMLDivElement>(null);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  // Warm the transition picture once the page is idle, unless the visitor is saving data.
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;
    const t = setTimeout(() => { new Image().src = "/brand/dome-t.webp"; }, 2500);
    return () => clearTimeout(t);
  }, []);

  const go = useCallback<Go>(async (href, opts = {}) => {
    const move = () => (opts.replace ? router.replace(href) : router.push(href));
    const target = new URL(href, location.href);
    const el = root.current;
    if (busy.current || !el || !dome.current || prefersReducedMotion() || target.pathname === pathRef.current) { if (!busy.current) move(); return; }
    busy.current = true;
    try {
      router.prefetch(href);
      const r = opts.from?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
      const cx = innerWidth / 2, cy = innerHeight / 2;

      // 1. close: the dome grows out of the click until it fills the screen
      el.dataset.mode = "cover"; el.dataset.state = "on";
      gsap.set(el, { "--x": `${x}px`, "--y": `${y}px`, "--r": "0px" });
      gsap.set(".pt__ring", { opacity: 1 });
      gsap.fromTo(dome.current, { rotation: -24, scale: 1.2 }, { rotation: 10, scale: 1, duration: 2.6, ease: "power2.out" });
      await tween(el, { "--r": `${farthest(x, y)}px`, duration: 0.8, ease: "power3.inOut" });

      // 2. go: the next screen loads behind the dome
      const start = pathRef.current;
      move();
      await arrived(() => pathRef.current, start);

      // 3. open: a hole widens from the centre and the new screen is there
      el.dataset.mode = "reveal";
      gsap.set(el, { "--x": `${cx}px`, "--y": `${cy}px`, "--r": "0px" });
      gsap.to(dome.current, { scale: 1.14, rotation: "+=6", duration: 1.1, ease: "power2.inOut" });
      gsap.to(".pt__ring", { opacity: 0, duration: 0.3, delay: 0.75 });
      await tween(el, { "--r": `${farthest(cx, cy)}px`, duration: 1.05, ease: "power3.inOut" });
    } finally {
      el.dataset.state = "idle"; el.dataset.mode = "";
      busy.current = false;
    }
  }, [router]);

  return (
    <GoContext.Provider value={go}>
      {children}
      <div ref={root} className="pt-root" data-state="idle" aria-hidden="true">
        <div className="pt"><div ref={dome} className="pt__dome" /></div>
        <div className="pt__ring" />
      </div>
    </GoContext.Provider>
  );
}

/** A normal link that uses the iris transition for plain left clicks (new tabs, copied links and modified clicks behave as usual). */
export function TransitionLink({ href, replace, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; replace?: boolean }) {
  const go = useGo();
  return (
    <a href={href} {...rest} onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
      e.preventDefault();
      go(href, { replace, from: e.currentTarget });
    }} />
  );
}
