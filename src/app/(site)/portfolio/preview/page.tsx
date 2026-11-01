import { ViewerPage } from "@/components/cv/ViewerPage";
import { requireProfile } from "@/lib/auth";
import { ownerProjects, pageStats, profileFields } from "@/lib/portfolio";

export const metadata = { title: "Preview · Project CV" };

export default async function Preview() {
  const p = await requireProfile(["/portfolio"]);
  const [projects, stats] = await Promise.all([ownerProjects(p.id), pageStats(p.slug!)]);
  return <ViewerPage previewing slug={p.slug!} profile={profileFields(p)} projects={projects} stats={stats}
    style={{ wallpaper: p.wallpaper, table: p.table_style, ink: p.ink, glass: p.glass, line: p.line }} />;
}
