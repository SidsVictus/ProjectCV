import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { ViewerPage } from "@/components/cv/ViewerPage";
import { getCatalog } from "@/lib/catalog-server";
import { pageStats, profileFields, publicPortfolio } from "@/lib/portfolio";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pf = await publicPortfolio((await params).slug);
  if (pf?.status !== "ok") return { title: "Project CV", robots: { index: false } };
  return { title: `${pf.profile.full_name} · Project CV`, description: pf.profile.headline };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const pf = await publicPortfolio(slug);
  if (!pf) notFound();
  if (pf.status === "unavailable") {
    return (
      <AuthScreen label="Page unavailable" title="This page is unavailable." sub="The owner's account is turned off, so their portfolio cannot be viewed right now." legal="Project CV">
        <div className="pcv-auth__actions"><Link className="pcv-btn pcv-btn--primary" href="/">Create one for yourself</Link></div>
      </AuthScreen>
    );
  }
  const p = pf.profile;
  return <ViewerPage slug={slug} profile={profileFields(p)} projects={pf.projects} stats={await pageStats(slug)} catalog={await getCatalog()} isOwner={pf.is_owner}
    style={{ wallpaper: p.wallpaper, table: p.table_style, ink: p.ink, glass: p.glass, line: p.line }} />;
}
