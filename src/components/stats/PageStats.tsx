"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mountRibbon } from "./ribbon";
import "./whosaw.css";

export type Stats = {
  visitors: number; avg_seconds: number; files_opened: number;
  buckets: [string, number][]; files: [string, number][];
};
type Range = "7d" | "30d" | "all";

const RANGES: [Range, string][] = [["7d", "7 days"], ["30d", "30 days"], ["all", "All time"]];
const UNIT: Record<Range, string> = { "7d": "per day", "30d": "per week", all: "per month" };
const PILL_LABEL: Record<Range, string> = { "7d": "visitors this week", "30d": "visitors this month", all: "visitors so far" };

async function load(slug: string, range: Range): Promise<Stats | null> {
  const { data } = await createClient().rpc("portfolio_stats", { p_slug: slug, p_range: range });
  return (data as Stats) ?? null;
}

/** The eye pill in the tool row (prototype) that opens the "Who saw your page" card (owner's design). */
/** colours: the owner's text and glass colours; the pill and card use them opaque. */
export function PageStats({ slug, owner, initial, colours }: { slug: string; owner: boolean; initial: Stats | null; colours: { ink: string; glass: string } }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("7d");
  const [stats, setStats] = useState<Stats | null>(initial);
  const [week, setWeek] = useState(initial?.visitors ?? 0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    load(slug, range).then((s) => { if (live && s) { setStats(s); if (range === "7d") setWeek(s.visitors); } });
    return () => { live = false; };
  }, [open, range, slug]);

  // The eye's iris looks toward the cursor wherever it is on the page (prototype onPointer).
  useEffect(() => {
    let raf = 0, pt = [0, 0];
    const onPointer = (e: PointerEvent) => {
      pt = [e.clientX, e.clientY];
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.querySelectorAll<SVGSVGElement>(".eye-svg").forEach((svg) => {
          const r = svg.getBoundingClientRect(), dx = pt[0] - (r.left + r.width / 2), dy = pt[1] - (r.top + r.height / 2);
          const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
          const iris = svg.querySelector<SVGGElement>(".eye-iris");
          if (iris) iris.style.translate = (dx / d * 4.2 * k).toFixed(2) + "px " + (dy / d * 2.6 * k).toFixed(2) + "px";
        });
      });
    };
    addEventListener("pointermove", onPointer, { passive: true });
    return () => { removeEventListener("pointermove", onPointer); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="stats-wrap" style={{ "--pc-ink": colours.ink, "--pc-bg": colours.glass } as React.CSSProperties}>
      <button type="button" className="eye-btn" aria-expanded={open} aria-label={`Page stats: ${week} visitors`} onClick={() => setOpen(!open)}>
        <span className="eye-ball"><svg className="eye-svg" viewBox="0 0 32 32" aria-hidden="true"><path className="eye-white" d="M3 16C7 9.5 11 7 16 7s9 2.5 13 9c-4 6.5-8 9-13 9S7 22.5 3 16z" /><g className="eye-iris"><circle cx="16" cy="16" r="5.4" /><circle cx="18" cy="14" r="1.5" fill="#ffffff" /></g></svg></span>
        <span className="eye-text"><b className="count" style={{ "--n": week } as React.CSSProperties} /><small>{PILL_LABEL["7d"]}</small></span>
      </button>
      {open && (
        <>
          <button type="button" className="stats-scrim" aria-label="Close page stats" onClick={() => setOpen(false)} />
          <div className="whosaw whosaw-pop" role="dialog" aria-label="Page stats">
            <WhoSawCard title={owner ? "Who saw your page" : "Who saw this page"} owner={owner} range={range} setRange={setRange} stats={stats} ink={colours.ink} />
          </div>
        </>
      )}
    </div>
  );
}

function WhoSawCard({ title, owner, range, setRange, stats, ink }: {
  title: string; owner: boolean; range: Range; setRange: (r: Range) => void; stats: Stats | null; ink: string;
}) {
  const stream = useRef<HTMLDivElement>(null);
  const days = stats?.buckets ?? [];
  const unitWord = "visits";

  useEffect(() => {
    if (!stream.current || !days.length) return;
    try { return mountRibbon(stream.current, { days, unitWord }, ink); } catch { return; } // the card still reads without the 3D ribbon
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, ink]);

  const files = stats?.files ?? [];
  const max = files[0]?.[1] ?? 1;
  const [widths, setWidths] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWidths(true), 300); return () => clearTimeout(t); }, [stats]);
  const secs = stats?.avg_seconds ?? 0;

  return (
    <section className="card" aria-labelledby="whosaw-t">
      <div className="head">
        <h2 id="whosaw-t">{title}</h2>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="stats">
        <div><div className="big">{stats?.visitors ?? 0}</div><div className="label">people visited</div></div>
        <div><b>{Math.floor(secs / 60)}m {secs % 60}s</b><span className="label">average time on page</span></div>
        <div><b>{stats?.files_opened ?? 0}</b><span className="label">files opened</span></div>
      </div>

      <p className="overline">Visits {UNIT[range]} <span>· each dot is one visitor</span></p>
      <div className="stream" ref={stream}>
        <canvas aria-label={`Visits ${UNIT[range]}: ${days.map((d) => `${d[0]} ${d[1]}`).join(", ")}`} />
      </div>

      <p className="overline">Most opened files</p>
      {files.length ? (
        <div>
          {files.map((f) => (
            <div key={f[0]} className="file"><span>{f[0]}</span><b>{f[1]} opens</b><span className="track"><i style={{ width: widths ? `${(f[1] / max) * 100}%` : 0 }} /></span></div>
          ))}
        </div>
      ) : owner ? (
        <p className="foot" style={{ marginTop: 6 }}>Attach a certificate or report to a project and you will see how often people open it.</p>
      ) : null}
      {owner && <p className="foot">Your own visits are not counted.</p>}
    </section>
  );
}
