"use client";

import { useEffect } from "react";
import { signinPointerMotion } from "@/lib/motion";

/** Renders nothing; starts the sign-in page's pointer motion (dome depth, magnetic Google button). */
export function SigninMotion() {
  useEffect(() => signinPointerMotion(), []);
  return null;
}
