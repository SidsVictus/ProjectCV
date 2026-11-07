"use client";

import { useLayoutEffect, useRef } from "react";
import { springIn } from "@/lib/motion";

/** Attach to a dialog's panel: it springs in when it opens. */
export function useSpringIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => (ref.current ? springIn(ref.current) : undefined), []);
  return ref;
}
