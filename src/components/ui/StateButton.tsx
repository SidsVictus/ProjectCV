"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { burst } from "@/lib/motion";

export type ButtonState = "idle" | "busy" | "done";

/**
 * A button for the main actions (save, copy, create, accept). Idle shows its icon and label;
 * busy swaps in a spinner and a progress line (a real 0 to 1 value, or a moving line when the
 * length is not known); done draws a tick with a soft ring. While busy or done it ignores clicks
 * but keeps its fill, so it does not turn into the grey "disabled" look.
 */
export function StateButton({ state, idle, busy, done, icon, progress, onClick, disabled, className = "pcv-btn pcv-btn--primary", type = "button" }: {
  state: ButtonState; idle: string; busy: string; done: string; icon?: ReactNode;
  progress?: number | null; onClick?: () => void; disabled?: boolean; className?: string; type?: "button" | "submit";
}) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (state === "done" && btn.current) burst(btn.current); }, [state]);
  const label = state === "busy" ? busy : state === "done" ? done : idle;
  const indeterminate = state === "busy" && (progress === undefined || progress === null);
  return (
    <button ref={btn} type={type} className={`${className} sb`} data-state={state} data-indet={indeterminate ? "" : undefined}
      aria-busy={state === "busy"} disabled={state === "idle" && disabled}
      onClick={() => { if (state === "idle") onClick?.(); }}
      style={{ "--p": Math.max(0, Math.min(1, progress ?? 0)) } as CSSProperties}>
      <span className="sb__fx" aria-hidden="true"><i className="sb__fill" /></span>
      <span className="sb__ico" aria-hidden="true">
        {state === "busy" ? <span className="sb__spin" />
          : state === "done" ? <svg className="sb__tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : icon}
      </span>
      <span role={state === "idle" ? undefined : "status"}>{label}</span>
    </button>
  );
}
