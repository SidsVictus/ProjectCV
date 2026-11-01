import { ClockIcon, FileIcon, LinkIcon, PencilIcon, TickIcon, TrashIcon } from "./icons";

export type DocView = { id: string; kind: "file" | "link"; name: string };
export type ProjectView = {
  id: string; name: string; timeline: string; description: string; status: "done" | "wip"; documents: DocView[];
};

/** The projects table, markup as in ProjectCV-Table-Styles/demo.html. Owner adds "+ attach" and Actions. */
export function ProjectsTable({ projects, table, owner }: {
  projects: ProjectView[]; table: string;
  owner?: { onEdit: (p: ProjectView) => void; onDelete: (p: ProjectView) => void };
}) {
  return (
    <div className="tbl-scroll">
      <table className={`tbl tbl-${table}`}>
        <thead>
          <tr>
            <th className="c-num">No.</th><th className="c-name">Project</th><th className="c-when">Timeline</th>
            <th className="c-desc">Description</th><th>Documents</th><th>Status</th>
            {owner && <th className="c-act"><span className="pcv-sr">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr key={p.id}>
              <td className="c-num">{String(i + 1).padStart(2, "0")}</td>
              <td className="c-name">{p.name}</td>
              <td className="c-when">{p.timeline || "Not added"}</td>
              <td className="c-desc"><span>{p.description || "No description yet."}</span></td>
              <td>
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
              <td>
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
