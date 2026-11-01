"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTES, TABLES, WALLPAPERS, cvVars, paneAlpha, type Colours } from "@/lib/cv";
import { CheckPath, ClosePath, FileIcon, PIcon } from "./icons";
import type { ProjectView } from "./ProjectsTable";

const SPOOL = 112, RUN = 140;

// Shown only while the page has no projects, so the style still has rows to show.
const PLACEHOLDER_ROWS = [
  { name: "Your first project", timeline: "Timeline", status: "done", docs: 1 },
  { name: "Your next project", timeline: "Timeline", status: "wip", docs: 0 },
] as const;

/** "The spool": table styles on a 3D drum, live preview of the owner's own projects on the right. */
export function TablePicker({ current, wallpaper, colours, projects, onApply, onClose }: {
  current: string; wallpaper: string; colours: Colours; projects: ProjectView[];
  onApply: (id: string) => void; onClose: () => void;
}) {
  const start = Math.max(0, TABLES.findIndex((t) => t.id === current));
  const [pos, setPos] = useState(start);
  const wheel = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = wheel.current; if (el) { el.scrollTop = start * SPOOL; el.focus({ preventScroll: true }); } }, [start]);
  const focusIdx = Math.max(0, Math.min(TABLES.length - 1, Math.round(pos)));
  const focus = TABLES[focusIdx];
  const vars = cvVars(colours) as React.CSSProperties;
  const rows = projects.length
    ? projects.slice(0, 4).map((p) => ({ name: p.name, timeline: p.timeline || "Not added", status: p.status, docs: p.documents.length }))
    : PLACEHOLDER_ROWS;

  return (
    <div className="pcv-overlay" style={{ background: "rgba(2,1,5,.86)" }} role="dialog" aria-modal="true" aria-labelledby="ts-title">
      <div style={{ minHeight: "100%", boxSizing: "border-box", padding: "40px 24px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", display: "grid", gap: 6 }}>
            <h2 id="ts-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300, fontSize: 44, lineHeight: "50px", color: "#bccf67" }}>Table style</h2>
          </div>
          <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--icon" aria-label="Close" onClick={onClose}><PIcon d={ClosePath} /></button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", ...vars }}>
          <div style={{ flex: "1 1 400px", minWidth: 0, position: "relative" }}>
            <div className="spool-cue" aria-hidden="true" />
            <div ref={wheel} className="spool" data-wheel="tables" tabIndex={0} role="listbox" aria-label="Table styles" aria-activedescendant={`ts-${focus.id}`}
              onScroll={(e) => setPos(e.currentTarget.scrollTop / SPOOL)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.currentTarget.scrollBy({ top: e.key === "ArrowDown" ? SPOOL : -SPOOL, behavior: "smooth" }); }
                else if (e.key === "Enter") { e.preventDefault(); onApply(focus.id); }
                else if (e.key === "Escape") onClose();
              }}>
              {TABLES.map((t, i) => {
                const dd = i - pos, a = Math.min(Math.abs(dd), 3), on = i === focusIdx;
                return (
                  <button key={t.id} type="button" id={`ts-${t.id}`} role="option" aria-selected={on} className={`spool-item ${on ? "is-on" : ""}`}
                    onClick={(e) => { if (on) onApply(t.id); else e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                    style={{ willChange: "transform, opacity, filter", transform: `rotateX(${(-dd * 16).toFixed(2)}deg) scale(${(1 - a * 0.07).toFixed(3)})`, opacity: on ? 1 : Math.max(0.12, 0.9 - a * 0.28), filter: `blur(${(Math.min(Math.abs(dd), 2) * 1.2).toFixed(2)}px)`, animationDelay: `${i * 55}ms` }}>
                    <span className={`spool-mini wp wp-box wp-${wallpaper}`}>
                      <span className="spool-mini-pane">
                        <table className={`tbl tbl-mini tbl-${t.id}`}>
                          <thead><tr><th className="c-num"></th><th className="c-name"><i className="bar" style={{ width: 30 }} /></th><th><i className="bar" style={{ width: 20 }} /></th><th><i className="bar" style={{ width: 16 }} /></th></tr></thead>
                          <tbody>
                            <tr><td className="c-num">1</td><td className="c-name"><i className="bar" style={{ width: 36 }} /></td><td><i className="bar" style={{ width: 18 }} /></td><td><i className="pill" /></td></tr>
                            <tr><td className="c-num">2</td><td className="c-name"><i className="bar" style={{ width: 26 }} /></td><td><i className="bar" style={{ width: 22 }} /></td><td><i className="pill o" /></td></tr>
                          </tbody>
                        </table>
                      </span>
                    </span>
                    <span style={{ display: "grid", gap: 2, minWidth: 0 }}><span className="spool-name">{t.name}</span><span className="spool-desc">{t.desc}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: "1.6 1 520px", minWidth: 0, display: "grid", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "#727d40" }}>Live on your page · <span style={{ color: "#bccf67" }}>{focus.name}</span></p>
            <div className={`wp wp-box wp-${wallpaper}`} style={{ borderRadius: 28, padding: 28, boxShadow: "var(--satin-fold)" }}>
              <div className="cv-pane" style={{ ...vars, padding: 22 }}>
                <div className="tbl-scroll">
                  <table className={`tbl tbl-${focus.id}`}>
                    <thead><tr><th className="c-num">No.</th><th className="c-name">Project</th><th className="c-when">Timeline</th><th>Documents</th><th>Status</th></tr></thead>
                    <tbody>
                      {rows.map((p, i) => (
                        <tr key={i}>
                          <td className="c-num">{String(i + 1).padStart(2, "0")}</td>
                          <td className="c-name">{p.name}</td>
                          <td className="c-when">{p.timeline}</td>
                          <td><span className="tbl-doc"><i><FileIcon /></i>{p.docs === 1 ? "1 document" : p.docs + " documents"}</span></td>
                          <td>{p.status === "done" ? <span className="cv-done">Completed</span> : <span className="cv-wip">In progress</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="pcv-btn pcv-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="pcv-btn pcv-btn--primary" onClick={() => onApply(focus.id)}><PIcon d={CheckPath} />Use {focus.name}</button>
        </div>
      </div>
    </div>
  );
}

/** "The lit runway": swatches fan in 3D; the page behind tries each one on live. */
export function WallpaperPicker({ current, onTry, onApply, onCancel }: {
  current: string; onTry: (id: string) => void; onApply: (id: string) => void; onCancel: () => void;
}) {
  const start = Math.max(0, WALLPAPERS.findIndex((w) => w.id === current));
  const [pos, setPos] = useState(start);
  const wheel = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = wheel.current; if (el) { el.scrollLeft = start * RUN; el.focus({ preventScroll: true }); } }, [start]);
  const focusIdx = Math.max(0, Math.min(WALLPAPERS.length - 1, Math.round(pos)));
  const wf = WALLPAPERS[focusIdx];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="wp-title">
      <div className="runway-top pcv-glass" style={{ background: "rgba(2,1,5,.7)" }}>
        <span id="wp-title" style={{ fontSize: 13, color: "#a6b65b", whiteSpace: "nowrap" }}>Trying on wallpaper</span>
        <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="pcv-btn pcv-btn--primary pcv-btn--sm" onClick={() => onApply(wf.id)}><PIcon d={CheckPath} />Apply</button>
      </div>
      <div className="runway-dock">
        <div className="runway-label" aria-live="polite"><span className="runway-name">{wf.name}</span></div>
        <div ref={wheel} className="runway" data-wheel="walls" tabIndex={0} role="listbox" aria-label="Wallpapers" aria-activedescendant={`wp-${wf.id}`}
          onScroll={(e) => { const p = e.currentTarget.scrollLeft / RUN; setPos(p); onTry(WALLPAPERS[Math.max(0, Math.min(WALLPAPERS.length - 1, Math.round(p)))].id); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.currentTarget.scrollBy({ left: e.key === "ArrowRight" ? RUN : -RUN, behavior: "smooth" }); }
            else if (e.key === "Enter") { e.preventDefault(); onApply(wf.id); }
            else if (e.key === "Escape") onCancel();
          }}>
          {WALLPAPERS.map((b, i) => {
            const dd = i - pos, a = Math.min(Math.abs(dd), 4), on = i === focusIdx, rot = Math.max(-55, Math.min(55, -dd * 32));
            return (
              <button key={b.id} type="button" id={`wp-${b.id}`} role="option" aria-selected={on} aria-label={b.name}
                className={`swatch wp wp-box wp-${b.id} ${on ? "is-on" : ""}`}
                onClick={(e) => { if (on) onApply(b.id); else e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }}
                style={{ willChange: "transform, opacity", transform: `translateY(${(on ? -22 : a * 6).toFixed(1)}px) rotateY(${rot.toFixed(2)}deg) scale(${(on ? 1.18 : 1 - a * 0.08).toFixed(3)})`, opacity: on ? 1 : Math.max(0.18, 1 - a * 0.22), animationDelay: `${Math.min(i, 10) * 40}ms` }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ROWS: { key: keyof Colours; label: string; delay: number }[] = [
  { key: "ink", label: "Text", delay: 0 }, { key: "glass", label: "Glass pane", delay: 120 }, { key: "line", label: "Lines and grid", delay: 240 },
];

/** "The droplet palette": text, glass and line colours, applied live. */
export function ColourPanel({ colours, onChange, onReset, onDone }: {
  colours: Colours; onChange: (c: Colours) => void; onReset: () => void; onDone: () => void;
}) {
  const tip = paneAlpha(colours.ink, colours.glass) === null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="co-title">
      <button type="button" aria-label="Close Edit Colors" onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 21, border: 0, padding: 0, background: "transparent", cursor: "default" }} />
      <div className="palette">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, display: "grid", gap: 4 }}>
            <h2 id="co-title" style={{ margin: 0, font: "italic 300 34px/38px var(--font-display)", color: "#bccf67" }}>Edit Colors</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#8e9c4e" }}>Changes show on your page as you pick.</p>
          </div>
          <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--icon pcv-btn--sm" aria-label="Close" onClick={onDone}><PIcon d={ClosePath} /></button>
        </div>
        {ROWS.map((row) => {
          const pal = PALETTES[row.key];
          const value = colours[row.key].toLowerCase();
          return (
            <div key={row.key} className="palette-row">
              <div className="palette-title"><b>{row.label}</b><span>{(pal.find((x) => x[1] === value) ?? ["Custom"])[0]}</span></div>
              <div className="drops" role="radiogroup" aria-label={`${row.label} colour`}>
                {pal.map(([name, hex], i) => (
                  <button key={hex} type="button" role="radio" aria-checked={hex === value} aria-label={name} title={name}
                    className={`drop ${hex === value ? "is-on" : ""}`} onClick={() => onChange({ ...colours, [row.key]: hex })}
                    style={{ background: hex, animationDelay: `${row.delay + i * 35}ms` }} />
                ))}
                <label className="drop drop-custom" title="Any colour" style={{ animationDelay: `${row.delay + pal.length * 35}ms` }}>
                  <span className="pcv-sr">Pick any {row.label} colour</span>
                  <input type="color" value={value} onChange={(e) => onChange({ ...colours, [row.key]: e.target.value.toLowerCase() })} />
                </label>
              </div>
            </div>
          );
        })}
        {tip && <p className="palette-tip">Your text and glass colours are too close to read comfortably. Pick a text colour that is much darker or much lighter than the glass.</p>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--sm" onClick={onReset}>Reset to default</button>
          <button type="button" className="pcv-btn pcv-btn--primary pcv-btn--sm" onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
