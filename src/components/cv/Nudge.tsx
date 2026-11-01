"use client";

import { useEffect, useState } from "react";

/** No visible scrollbars: a faint chevron bounces bottom right while more content is below. */
export function Nudge({ hidden }: { hidden?: boolean }) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const check = () => setMore(document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) > 80);
    check();
    addEventListener("scroll", check, { passive: true }); addEventListener("resize", check);
    const ro = new ResizeObserver(check); ro.observe(document.body);
    return () => { removeEventListener("scroll", check); removeEventListener("resize", check); ro.disconnect(); };
  }, []);
  if (!more || hidden) return null;
  return (
    <span className="nudge" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  );
}
