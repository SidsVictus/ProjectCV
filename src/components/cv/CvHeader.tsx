import { profileView, type ProfileFields } from "@/lib/cv";
import { LinkIcon } from "./icons";

/** Name, headline, details line, about line and link chips, all on the pane (DESIGN.md section 9). */
export function CvHeader({ profile, count, nameAs = "h1", nameSize, staticLinks }: {
  profile: ProfileFields; count: number | null; nameAs?: "h1" | "h2"; nameSize?: number; staticLinks?: boolean;
}) {
  const pf = profileView(profile, count);
  const Name = nameAs;
  return (
    <div className="cv-head" style={nameSize ? { maxWidth: "100%", paddingBottom: 8 } : undefined}>
      <Name className="cv-name" style={nameSize ? { fontSize: nameSize } : undefined}>{pf.name}</Name>
      <p className="cv-headline">{pf.headline}</p>
      <p className="cv-meta">{pf.meta.map((m) => <span key={m}>{m}</span>)}</p>
      {pf.about && <p className="cv-about">{pf.about}</p>}
      {pf.links.length > 0 && (
        <div className="cv-links">
          {pf.links.map((l) => staticLinks
            ? <span key={l.label} className="cv-link">{l.label}</span>
            : <a key={l.label} className="cv-link" href={l.href} target="_blank" rel="noopener noreferrer"><LinkIcon />{l.label}</a>)}
        </div>
      )}
    </div>
  );
}
