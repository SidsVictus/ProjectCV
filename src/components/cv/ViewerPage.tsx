/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageStats, type Stats } from "@/components/stats/PageStats";
import { cvVars, type Colours, type ProfileFields } from "@/lib/cv";
import { CvHeader } from "./CvHeader";
import { EyePath, PIcon } from "./icons";
import { Nudge } from "./Nudge";
import { ProjectsTable, type ProjectView } from "./ProjectsTable";

/** Counts this visit and how long the page stays open (never the owner's; the server checks too). */
function useVisit(slug: string, skip: boolean) {
  useEffect(() => {
    if (skip) return;
    let id: string | null = null;
    const send = (body: object) => fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    send({ slug }).then((r) => r.json()).then((j: { id: string | null }) => { id = j.id; }).catch(() => {});
    const ping = () => { if (id && !document.hidden) send({ ping: id }).catch(() => {}); };
    const t = setInterval(ping, 15_000);
    const leave = () => { if (id) navigator.sendBeacon("/api/visit", new Blob([JSON.stringify({ ping: id })], { type: "application/json" })); };
    addEventListener("pagehide", leave);
    return () => { clearInterval(t); removeEventListener("pagehide", leave); };
  }, [slug, skip]);
}

export function ViewerPage({ slug, profile, projects, style, stats, previewing = false, isOwner = false }: {
  slug: string; profile: ProfileFields; projects: ProjectView[]; style: { wallpaper: string; table: string } & Colours;
  stats: Stats | null; previewing?: boolean; isOwner?: boolean;
}) {
  useVisit(slug, previewing || isOwner);
  const owner = previewing || isOwner;
  return (
    <div className={`wp wp-${style.wallpaper}`} style={{ minHeight: "100vh", boxSizing: "border-box", padding: "16px 24px 48px" }}>
      <div className="screen-in" style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {previewing && (
          <div className="pcv-viewer pcv-glass" style={{ flexWrap: "wrap", background: "rgba(2,1,5,.62)", position: "sticky", top: 16, zIndex: 5 }}>
            <PIcon d={EyePath} style={{ color: "#bccf67" }} />
            <span className="pcv-viewer__text">You are seeing your page <strong>exactly as viewers do.</strong></span>
            <a className="pcv-btn pcv-btn--primary pcv-btn--sm" href="/portfolio">Back to editing</a>
          </div>
        )}
        <div className="tool-row" style={{ margin: "36px 0 0" }}>
          <PageStats slug={slug} owner={owner} initial={stats} colours={style} />
        </div>
        <section className="cv-pane" style={cvVars(style) as React.CSSProperties} aria-label="Portfolio">
          <CvHeader profile={profile} count={projects.length} />
          {projects.length > 0
            ? <ProjectsTable projects={projects} table={style.table} />
            : <p className="cv-empty">Projects are on their way.</p>}
        </section>
        {!previewing && (
          <div className="pcv-viewer pcv-glass" style={{ position: "sticky", bottom: 16, marginTop: 12, flexWrap: "wrap", background: "rgba(2,1,5,.62)" }}>
            <img src="/brand/logo-mark.png" alt="Project CV" style={{ width: 34, height: 34 }} />
            <span className="pcv-viewer__text"><strong>View only.</strong> Made with Project CV.</span>
            <Link className="pcv-btn pcv-btn--primary pcv-btn--sm" href="/">Create one for yourself</Link>
          </div>
        )}
      </div>
      <Nudge />
    </div>
  );
}
