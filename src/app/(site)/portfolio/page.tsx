import { PortfolioEditor } from "@/components/cv/PortfolioEditor";
import { requireProfile } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog-server";
import { ownerProjects, pageStats, profileFields, siteOrigin } from "@/lib/portfolio";

export const metadata = { title: "My portfolio · Project CV" };

export default async function Portfolio() {
  const p = await requireProfile(["/portfolio"]);
  const slug = p.slug!;
  const [projects, stats, origin, catalog] = await Promise.all([ownerProjects(p.id), pageStats(slug), siteOrigin(), getCatalog()]);
  return (
    <PortfolioEditor profile={profileFields(p)} projects={projects} slug={slug} stats={stats} catalog={catalog}
      shareUrl={`${origin}/p/${slug}`} superAdmin={p.role === "super_admin"}
      style={{ wallpaper: p.wallpaper, table: p.table_style, ink: p.ink, glass: p.glass, line: p.line }} />
  );
}
