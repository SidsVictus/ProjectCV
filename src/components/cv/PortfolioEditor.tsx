/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteProject, heartbeat, saveStyle } from "@/app/actions/portfolio";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageStats, type Stats } from "@/components/stats/PageStats";
import { DEFAULT_COLOURS, cvVars, type Colours, type ProfileFields } from "@/lib/cv";
import { CvHeader } from "./CvHeader";
import { DeleteDialog, ProjectDialog, ShareDialog } from "./Dialogs";
import { PencilIcon } from "./icons";
import { ColourPanel, TablePicker, WallpaperPicker } from "./Pickers";
import { ProjectsTable, type ProjectView } from "./ProjectsTable";
import { Nudge } from "./Nudge";

type Modal = null | "tables" | "background" | "colours" | "share" | { add: ProjectView | null } | { del: ProjectView };

export function PortfolioEditor({ profile, style, projects, slug, shareUrl, superAdmin, stats }: {
  profile: ProfileFields; style: { wallpaper: string; table: string } & Colours; projects: ProjectView[];
  slug: string; shareUrl: string; superAdmin: boolean; stats: Stats | null;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bg, setBg] = useState(style.wallpaper);
  const [tryBg, setTryBg] = useState(style.wallpaper);
  const [table, setTable] = useState(style.table);
  const [colours, setColours] = useState<Colours>({ ink: style.ink, glass: style.glass, line: style.line });
  const [savedColours, setSavedColours] = useState(colours);
  const [pulse, setPulse] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  // Editing time for the admin's engagement numbers: a heartbeat while this page is open and visible.
  useEffect(() => {
    let id: string | null = null;
    const beat = async () => { if (!document.hidden) id = await heartbeat(id); };
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, []);

  async function persist(patch: Record<string, string>) {
    const r = await saveStyle(patch);
    if (!r.ok) setNotice(r.error);
  }
  function applyWall(id: string) {
    setBg(id); setTryBg(id); setModal(null); setPulse(true); setTimeout(() => setPulse(false), 950);
    if (id !== bg) persist({ wallpaper: id });
  }
  function applyTable(id: string) { setTable(id); setModal(null); if (id !== table) persist({ table_style: id }); }
  function closeColours() {
    setModal(null);
    if (colours.ink !== savedColours.ink || colours.glass !== savedColours.glass || colours.line !== savedColours.line) {
      setSavedColours(colours); persist(colours);
    }
  }
  async function confirmDelete(p: ProjectView) {
    setDeleting(true);
    const r = await deleteProject(p.id);
    setDeleting(false); setModal(null);
    if (!r.ok) setNotice(r.error); else router.refresh();
  }

  const shownBg = modal === "background" ? tryBg : bg;
  const vars = cvVars(colours) as React.CSSProperties;
  const initial = (profile.full_name || "Y")[0].toUpperCase();
  const preview = () => router.push("/portfolio/preview");

  return (
    <div className={`wp wp-${shownBg}`} style={{ minHeight: "100vh", boxSizing: "border-box", padding: "16px 24px 120px", overflowX: "clip" }}>
      <div className="screen-in" style={{ maxWidth: 1080, margin: "0 auto" }}>
        <nav className="pcv-nav pcv-glass" aria-label="Main" style={{ position: "sticky", top: 16, zIndex: 6, height: 60, padding: "0 8px 0 10px", background: "rgba(2,1,5,.62)" }}>
          <span className="pcv-nav__brand"><img src="/brand/logo-mark.png" alt="Project CV" style={{ width: 42, height: 42 }} /></span>
          <div className="pcv-seg" role="group" aria-label="Mode" style={{ margin: "0 auto", background: "rgba(0,0,0,.35)", borderColor: "rgba(188,207,103,.22)" }}>
            <button type="button" className="pcv-seg__opt" aria-pressed="true">Edit</button>
            <button type="button" className="pcv-seg__opt" aria-pressed="false" onClick={preview}>Preview</button>
          </div>
          <div className="pcv-nav__actions" style={{ position: "relative" }}>
            <button type="button" className="pcv-btn pcv-btn--primary pcv-btn--sm" onClick={() => { setModal("share"); setMenuOpen(false); }}>
              <svg className="pcv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>Share
            </button>
            <button type="button" className="pcv-avatar" aria-label="Account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} style={{ cursor: "pointer" }}>{initial}</button>
            {menuOpen && (
              <div className="pcv-glass" style={{ position: "absolute", right: 0, top: 52, minWidth: 210, padding: 8, borderRadius: 18, background: "rgba(11,11,9,.92)", display: "grid", gap: 2, animation: "satin-rise var(--satin-flow) var(--satin-glide) both" }}>
                <a className="pcv-nav__link" href="/setup" style={{ textAlign: "left" }}>Edit my details</a>
                {/* A full page load: the admin dashboard has its own root layout and styles. */}
                {superAdmin && <a className="pcv-nav__link" href="/admin" style={{ textAlign: "left" }}>Admin dashboard</a>}
                <SignOutButton className="pcv-nav__link" style={{ background: "none", border: 0, textAlign: "left", cursor: "pointer" }} />
              </div>
            )}
          </div>
        </nav>

        <div className="cv-zone">
          <div className="tool-row">
            <PageStats slug={slug} owner initial={stats} />
            <div className="tool-set">
              <div className="tool-stack">
                <button type="button" className={`tool-btn ${pulse ? "pulse-once" : ""}`} aria-label="Change wallpaper" onClick={() => { setTryBg(bg); setModal("background"); setMenuOpen(false); }} style={{ animationDelay: ".25s" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3.5" width="15" height="6" rx="1.8" /><path d="M18 6.5h2a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-8.5v2.5" /><rect x="10" y="14.5" width="3" height="6.5" rx="1.2" /></svg>
                </button>
                <span className="tool-label">wallpaper</span>
                <svg className="doodle doodle-wall" viewBox="0 0 130 70" aria-hidden="true">
                  <path d="M4 56 C20 66 40 58 40 44 C40 30 22 32 26 44 C30 58 62 56 82 40 C96 30 108 26 122 28" />
                  <path d="M112 20 L123 28 L112 36" />
                </svg>
                <span className="doodle-note doodle-wall-note">this is your wallpaper</span>
              </div>
              <div className="tool-stack">
                <button type="button" className="tool-btn" aria-label="Choose text colour" onClick={() => { setModal("colours"); setMenuOpen(false); }} style={{ animationDelay: ".4s" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5c3.6 4.3 6 7.6 6 10.4a6 6 0 0 1-12 0c0-2.8 2.4-6.1 6-10.4z" /><path d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.6" /></svg>
                </button>
                <span className="tool-label">text colour</span>
              </div>
              <div className="tool-stack">
                <button type="button" className="tool-btn" aria-label="Choose a table style" onClick={() => { setModal("tables"); setMenuOpen(false); }} style={{ animationDelay: ".55s" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M3 9.5h18M3 14.5h18M9 9.5v10M15 9.5v10" /></svg>
                </button>
                <span className="tool-label">table style</span>
                <svg className="doodle doodle-table" viewBox="0 0 84 420" aria-hidden="true">
                  <path d="M10 410 C28 388 58 390 60 362 C62 338 34 338 38 358 C42 380 72 368 72 334 C72 250 70 140 58 70 C52 40 34 22 8 18" />
                  <path d="M18 9 L7 18 L18 26" />
                </svg>
              </div>
            </div>
          </div>

          <section className="cv-pane" style={vars} aria-label="Portfolio">
            <a className="cv-edit" href="/setup" style={{ textDecoration: "none" }}><PencilIcon />Edit details</a>
            <CvHeader profile={profile} count={projects.length} />
            <ProjectsTable projects={projects} table={table} owner={{ onEdit: (p) => setModal({ add: p }), onDelete: (p) => setModal({ del: p }) }} />
            {projects.length === 0 && <p className="cv-empty">Your first project goes here.</p>}
            <button type="button" className="cv-add" onClick={() => setModal({ add: null })}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add a project
            </button>
          </section>
          {notice && <p role="alert" className="pcv-toast" style={{ margin: "16px auto 0", width: "fit-content" }}>{notice}</p>}
        </div>
      </div>

      {modal === "tables" && <TablePicker current={table} wallpaper={bg} colours={colours} projects={projects} onApply={applyTable} onClose={() => setModal(null)} />}
      {modal === "background" && <WallpaperPicker current={bg} onTry={setTryBg} onApply={applyWall} onCancel={() => { setTryBg(bg); setModal(null); }} />}
      {modal === "colours" && <ColourPanel colours={colours} onChange={setColours} onReset={() => setColours(DEFAULT_COLOURS)} onDone={closeColours} />}
      {modal === "share" && <ShareDialog url={shareUrl} onClose={() => setModal(null)} onPreview={preview} />}
      {modal && typeof modal === "object" && "add" in modal && (
        <ProjectDialog project={modal.add} onClose={() => setModal(null)} onSaved={() => router.refresh()} />
      )}
      {modal && typeof modal === "object" && "del" in modal && (
        <DeleteDialog project={modal.del} busy={deleting} onClose={() => setModal(null)} onConfirm={() => confirmDelete(modal.del)} />
      )}
      <Nudge hidden={!!modal} />
    </div>
  );
}
