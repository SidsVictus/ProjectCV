import { ViewerPage } from "@/components/cv/ViewerPage";
import { requireProfile } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog-server";
import { ownerProjects, pageStats, profileFields } from "@/lib/portfolio";

export const metadata = { title: "Preview · Project CV" };

export default async function Preview() {
  const p = await requireProfile(["/portfolio"]);
  const [projects, stats, catalog] = await Promise.all([ownerProjects(p.id), pageStats(p.slug!), getCatalog()]);
  return <ViewerPage previewing slug={p.slug!} profile={profileFields(p)} projects={projects} stats={stats} catalog={catalog}
    style={{ wallpaper: p.wallpaper, table: p.table_style, ink: p.ink, glass: p.glass, line: p.line }} />;
}
