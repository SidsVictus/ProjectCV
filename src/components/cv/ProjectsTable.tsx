"use client";

import { useLayoutEffect, useRef } from "react";
import { rowArrival } from "@/lib/motion";
import { tableLook, type Catalog } from "@/lib/catalog";
import { ClockIcon, FileIcon, LinkIcon, PencilIcon, TickIcon, TrashIcon } from "./icons";

export type DocView = { id: string; kind: "file" | "link"; name: string };
export type ProjectView = {
  id: string; name: string; timeline: string; description: string; status: "done" | "wip"; documents: DocView[];
};

/** The projects table, markup as in ProjectCV-Table-Styles/demo.html. Owner adds "+ attach" and Actions. */
export function ProjectsTable({ projects, table, catalog, owner }: {
  projects: ProjectView[]; table: string; catalog: Catalog;
  owner?: { onEdit: (p: ProjectView) => void; onDelete: (p: ProjectView) => void };
}) {
  const look = tableLook(table, catalog);
  // After the first paint, rows that were not there before drop in and glow (a saved project, not a page load).
  const body = useRef<HTMLTableSectionElement>(null);
  const seen = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = new Set(projects.map((p) => p.id));
    if (!prev || !body.current) return;
    rowArrival(Array.from(body.current.querySelectorAll<HTMLElement>("tr[data-id]")).filter((r) => !prev.has(r.dataset.id!)));
  }, [projects]);
  return (
    <div className="tbl-scroll">
      <table className={`tbl tbl-${look.base}`} style={look.style}>
        <thead style={look.headStyle}>
          <tr>
            <th className="c-num">No.</th><th className="c-name">Project</th><th className="c-when">Timeline</th>
            <th className="c-desc">Description</th><th>Documents</th><th>Status</th>
            {owner && <th className="c-act"><span className="pcv-sr">Actions</span></th>}
          </tr>
        </thead>
        <tbody ref={body}>
          {projects.map((p, i) => (
            <tr key={p.id} data-id={p.id}>
              <td className="c-num">{String(i + 1).padStart(2, "0")}</td>
              <td className="c-name">{p.name}</td>
              <td className="c-when" data-label="Timeline">{p.timeline || "Not added"}</td>
              <td className="c-desc" data-label="Description"><span>{p.description || "No description yet."}</span></td>
              <td data-label="Documents">
                <div className="tbl-chips">
                  {p.documents.map((d) => (
                    <a key={d.id} className="tbl-doc" href={`/d/${d.id}`} target="_blank" rel="noopener">
                      <i>{d.kind === "file" ? <FileIcon /> : <LinkIcon w={2} />}</i>{d.name}
                    </a>
                  ))}
                  {owner
                    ? <button type="button" className="tbl-attach" onClick={() => owner.onEdit(p)}>+ attach</button>
                    : p.documents.length === 0 && <span className="tbl-none">None</span>}
                </div>
              </td>
              <td data-label="Status">
                {p.status === "done"
                  ? <span className="cv-done"><TickIcon />Completed</span>
                  : <span className="cv-wip"><ClockIcon />In progress</span>}
              </td>
              {owner && (
                <td className="c-act">
                  <button type="button" className="cv-icon-btn" aria-label={`Edit ${p.name}`} onClick={() => owner.onEdit(p)}><PencilIcon /></button>
                  <button type="button" className="cv-icon-btn" aria-label={`Delete ${p.name}`} onClick={() => owner.onDelete(p)}><TrashIcon /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
