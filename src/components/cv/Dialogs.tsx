"use client";

import { useRef, useState } from "react";
import { finishUpload, saveProject, startUpload } from "@/app/actions/portfolio";
import { domainOf } from "@/lib/cv";
import { ACCEPT, ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/r2-rules";
import { CheckPath, ClosePath, EyePath, PIcon } from "./icons";
import type { ProjectView } from "./ProjectsTable";

const LinkPaths = <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>;
const FilePaths = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>;
const UploadPath = <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />;
const TickPath = <path d="M5 12l5 5 9-10" />;
const ClockPaths = <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>;

const size = (b: number) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1024 / 1024).toFixed(1) + " MB");

type Pending = { key: string; kind: "file" | "link"; name: string; meta: string; file?: File; url?: string };

export function ProjectDialog({ project, onClose, onSaved }: {
  project: ProjectView | null; onClose: () => void; onSaved: () => void;
}) {
  const [d, setD] = useState({
    name: project?.name ?? "", timeline: project?.timeline ?? "", description: project?.description ?? "",
    status: project?.status ?? ("wip" as "done" | "wip"),
  });
  const [kept, setKept] = useState(project?.documents ?? []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [linkDraft, setLinkDraft] = useState("");
  const [nameErr, setNameErr] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    setMsg("");
    const next: Pending[] = [];
    for (const f of Array.from(files ?? [])) {
      if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) { setMsg(`${f.name} is not a supported type. Use a PDF, image, slides, document, video or zip.`); continue; }
      if (f.size > MAX_FILE_BYTES) { setMsg(`${f.name} is over 100 MB, the most one upload can hold.`); continue; }
      next.push({ key: crypto.randomUUID(), kind: "file", name: f.name, meta: size(f.size), file: f });
    }
    setPending((p) => p.concat(next));
  }
  function addLink() {
    const t = linkDraft.trim();
    if (!t) return;
    setPending((p) => p.concat({ key: crypto.randomUUID(), kind: "link", name: domainOf(t), meta: "link", url: t }));
    setLinkDraft("");
  }

  // Once the project row exists, retries update it instead of creating a copy.
  const savedId = useRef<string | null>(project?.id ?? null);
  const inFlight = useRef(false);

  async function save() {
    if (!d.name.trim()) { setNameErr(true); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setMsg(""); setBusy("Saving");
      const links = pending.filter((p) => p.kind === "link").map((p) => p.url!);
      const r = await saveProject({ id: savedId.current, project: d, addLinks: links, removeDocs: removed });
      if (!r.ok) { setMsg(r.error); setBusy(""); return; }
      savedId.current = r.data.id;
      setRemoved([]);
      setPending((p) => p.filter((x) => x.kind === "file")); // links are saved now
      const files = pending.filter((p) => p.kind === "file");
      for (let i = 0; i < files.length; i++) {
        const f = files[i].file!;
        setBusy(`Uploading ${i + 1} of ${files.length}`);
        const s = await startUpload({ projectId: r.data.id, name: f.name, mime: f.type, size: f.size });
        if (!s.ok) { setMsg(s.error); setBusy(""); onSaved(); return; }
        await fetch(s.data.url, { method: "PUT", body: f, headers: { "Content-Type": f.type } }).catch(() => null);
        // The server checks the object itself; a failed PUT is found there and its pending row removed.
        const fin = await finishUpload(s.data.id);
        if (!fin.ok) { setMsg(`${f.name}: ${fin.error} Your project and other changes were saved.`); setBusy(""); onSaved(); return; }
        setPending((p) => p.filter((x) => x.key !== files[i].key)); // uploaded; a retry skips it
      }
      onSaved(); onClose();
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="pcv-overlay"><div className="pcv-overlay__inner">
      <div className="pcv-dialog" role="dialog" aria-modal="true" aria-labelledby="ap-title" style={{ width: "min(680px, 100%)", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1, display: "grid", gap: 4 }}>
            <h2 className="pcv-dialog__title" id="ap-title">{project ? "Edit project" : "Add a project"}</h2>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>It appears in your table as soon as you save.</p>
          </div>
          <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--icon pcv-btn--sm" aria-label="Close" onClick={onClose}><PIcon d={ClosePath} /></button>
        </div>
        <label className={`pcv-field ${nameErr ? "pcv-field--error" : ""}`}>
          <span className="pcv-field__label">Project name</span>
          <input className="pcv-input" placeholder="e.g. Line-following robot" value={d.name} maxLength={120} autoFocus
            onChange={(e) => { setD({ ...d, name: e.target.value }); setNameErr(false); }} />
          {nameErr && <span className="pcv-field__help">Give your project a name so viewers know what it is.</span>}
        </label>
        <label className="pcv-field">
          <span className="pcv-field__label">Year or timeline</span>
          <input className="pcv-input" placeholder="e.g. Jan to Mar 2026" value={d.timeline} maxLength={60} onChange={(e) => setD({ ...d, timeline: e.target.value })} />
          <span className="pcv-field__help">A single year works too, like 2025.</span>
        </label>
        <label className="pcv-field">
          <span className="pcv-field__label">Description</span>
          <textarea className="pcv-textarea" placeholder="What did you build, how, and what came of it?" value={d.description} maxLength={2000} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        <div className="pcv-field">
          <span className="pcv-field__label" id="st-label">Status</span>
          <div className="pcv-seg" role="group" aria-labelledby="st-label" style={{ justifySelf: "start" }}>
            <button type="button" className="pcv-seg__opt" aria-pressed={d.status === "done"} onClick={() => setD({ ...d, status: "done" })}><PIcon d={TickPath} />Completed</button>
            <button type="button" className="pcv-seg__opt" aria-pressed={d.status === "wip"} onClick={() => setD({ ...d, status: "wip" })}><PIcon d={ClockPaths} />In progress</button>
          </div>
        </div>
        <div className="pcv-field" style={{ gap: 12 }}>
          <span className="pcv-field__label">Documents and certificates</span>
          <div className="pcv-seg" role="group" aria-label="How to attach" style={{ justifySelf: "start" }}>
            <button type="button" className="pcv-seg__opt" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}><PIcon d={UploadPath} />Upload a file</button>
            <button type="button" className="pcv-seg__opt" aria-pressed={mode === "link"} onClick={() => setMode("link")}><PIcon d={LinkPaths} />Paste a link</button>
          </div>
          {mode === "upload" ? (
            <>
              <input ref={picker} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => picker.current?.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                style={{ display: "grid", justifyItems: "center", gap: 8, padding: 32, borderRadius: 14, border: "1px dashed var(--border-control)", background: "var(--surface-inset)", textAlign: "center", cursor: "pointer", font: "inherit", color: "inherit" }}>
                <PIcon d={UploadPath} style={{ width: 28, height: 28, color: "var(--text)" }} />
                <span style={{ color: "var(--text)", fontWeight: 600 }}>Drop a file here or browse</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>PDF, images, slides or video. Up to 100 MB each, 1 GB in total.</span>
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="pcv-input" aria-label="Link" placeholder="Paste a Drive, demo or certificate link" value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} style={{ flex: "1 1 260px", width: "auto" }} />
              <button type="button" className="pcv-btn pcv-btn--secondary" onClick={addLink}>Add link</button>
            </div>
          )}
          {(kept.length > 0 || pending.length > 0) && (
            <div className="pcv-card__chips">
              {kept.map((x) => (
                <DocChip key={x.id} kind={x.kind} name={x.name} meta={x.kind === "file" ? "file" : "link"}
                  onRemove={() => { setKept(kept.filter((k) => k.id !== x.id)); setRemoved(removed.concat(x.id)); }} />
              ))}
              {pending.map((x) => (
                <DocChip key={x.key} kind={x.kind} name={x.name} meta={x.meta} onRemove={() => setPending(pending.filter((p) => p.key !== x.key))} />
              ))}
            </div>
          )}
        </div>
        {msg && <p role="alert" style={{ margin: 0, color: "var(--text)", fontSize: 14, borderLeft: "2px dashed var(--text)", paddingLeft: 10 }}>{msg}</p>}
        <div className="pcv-dialog__actions" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20 }}>
          <span role="status" aria-live="polite" style={{ marginRight: "auto", alignSelf: "center", fontSize: 13, color: "var(--text-muted)" }}>{busy && busy + "..."}</span>
          <button type="button" className="pcv-btn pcv-btn--secondary" onClick={onClose} disabled={!!busy}>Cancel</button>
          <button type="button" className="pcv-btn pcv-btn--primary" onClick={save} disabled={!!busy}><PIcon d={CheckPath} />Save project</button>
        </div>
      </div>
    </div></div>
  );
}

function DocChip({ kind, name, meta, onRemove }: { kind: "file" | "link"; name: string; meta: string; onRemove: () => void }) {
  return (
    <span className="pcv-doc">
      <span className="pcv-doc__tile"><PIcon d={kind === "file" ? FilePaths : LinkPaths} /></span>
      <span className="pcv-doc__name">{name}</span><span className="pcv-doc__meta">{meta}</span>
      <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--icon pcv-btn--sm" aria-label={`Remove ${name}`} onClick={onRemove} style={{ width: 28, minHeight: 28 }}><PIcon d={ClosePath} /></button>
    </span>
  );
}

export function ShareDialog({ url, onClose, onPreview }: { url: string; onClose: () => void; onPreview: () => void }) {
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, "");
  const text = encodeURIComponent("See the projects I have built: " + url);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }
  return (
    <div className="pcv-overlay"><div className="pcv-overlay__inner">
      <div className="pcv-dialog" role="dialog" aria-modal="true" aria-labelledby="sh-title" style={{ width: "min(600px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1, display: "grid", gap: 4 }}>
            <h2 className="pcv-dialog__title" id="sh-title">Share your page</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Send it to recruiters, professors and friends, or add it to your CV.</p>
          </div>
          <button type="button" className="pcv-btn pcv-btn--ghost pcv-btn--icon pcv-btn--sm" aria-label="Close" onClick={onClose}><PIcon d={ClosePath} /></button>
        </div>
        <div className="pcv-share">
          <div className="pcv-share__row">
            <span className="pcv-share__url">{shown}</span>
            <button type="button" className="pcv-btn pcv-btn--primary pcv-btn--sm" onClick={copy}><PIcon d={<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>} />{copied ? "Copied" : "Copy link"}</button>
          </div>
          <div className="pcv-share__note"><PIcon d={<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>} style={{ width: 16, height: 16 }} />Anyone with this link can view. Only you can edit. The link stays the same when you add projects.</div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: "16px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Share to</p>
          <div className="pcv-share__targets">
            <a className="pcv-btn pcv-btn--secondary pcv-btn--sm" href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a className="pcv-btn pcv-btn--secondary pcv-btn--sm" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a className="pcv-btn pcv-btn--secondary pcv-btn--sm" href={`mailto:?subject=${encodeURIComponent("My Project CV")}&body=${text}`}>Email</a>
          </div>
        </div>
        <div className="pcv-dialog__actions" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20, justifyContent: "space-between" }}>
          <button type="button" className="pcv-btn pcv-btn--ghost" onClick={onPreview}><PIcon d={EyePath} />Open as a viewer</button>
          <button type="button" className="pcv-btn pcv-btn--primary" onClick={onClose}>Done</button>
        </div>
        {copied && <div style={{ display: "flex", justifyContent: "center" }}><span className="pcv-toast" role="status" style={{ animation: "satin-rise var(--satin-flow) var(--satin-ripple) both" }}><PIcon d={CheckPath} />Link copied</span></div>}
      </div>
    </div></div>
  );
}

export function DeleteDialog({ project, onClose, onConfirm, busy }: { project: ProjectView; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  const n = project.documents.length;
  return (
    <div className="pcv-overlay"><div className="pcv-overlay__inner">
      <div className="pcv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dl-title" aria-describedby="dl-body">
        <h2 className="pcv-dialog__title" id="dl-title">Delete this project?</h2>
        <p className="pcv-dialog__body" id="dl-body">
          &quot;{project.name}&quot;{n ? ` and its ${n}${n === 1 ? " document" : " documents"}` : ""} will be removed from your page and your shared link. This cannot be undone.
        </p>
        <div className="pcv-dialog__actions">
          <button type="button" className="pcv-btn pcv-btn--secondary" onClick={onClose} autoFocus>Keep it</button>
          <button type="button" className="pcv-btn pcv-btn--danger" onClick={onConfirm} disabled={busy}>
            <PIcon d={<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />} />Delete project
          </button>
        </div>
      </div>
    </div></div>
  );
}
