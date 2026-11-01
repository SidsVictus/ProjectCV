import "server-only";

import { headers } from "next/headers";
import type { ProjectView } from "@/components/cv/ProjectsTable";
import type { Stats } from "@/components/stats/PageStats";
import type { Profile } from "./auth";
import { createClient } from "./supabase/server";

/** The owner's own projects with their ready documents, oldest first (RLS: own rows only). */
export async function ownerProjects(ownerId: string): Promise<ProjectView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects")
    .select("id,name,timeline,description,status,documents(id,kind,name,ready,created_at)")
    .eq("owner_id", ownerId).order("created_at");
  if (error) throw new Error("Could not load projects: " + error.message);
  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, timeline: p.timeline, description: p.description, status: p.status,
    documents: (p.documents ?? []).filter((d) => d.ready).sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((d) => ({ id: d.id, kind: d.kind, name: d.name })),
  }));
}

export async function pageStats(slug: string, range: "7d" | "30d" | "all" = "7d"): Promise<Stats | null> {
  const { data } = await (await createClient()).rpc("portfolio_stats", { p_slug: slug, p_range: range });
  return (data as Stats) ?? null;
}

export type PublicPortfolio =
  | { status: "unavailable" }
  | { status: "ok"; is_owner: boolean; profile: Profile; projects: (ProjectView & { documents: ProjectView["documents"] })[] };

export async function publicPortfolio(slug: string): Promise<PublicPortfolio | null> {
  const { data } = await (await createClient()).rpc("get_public_portfolio", { p_slug: slug });
  return (data as PublicPortfolio) ?? null;
}

/** The site's public origin: NEXT_PUBLIC_SITE_URL in production, else this request's host. */
export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export const profileFields = (p: Profile) => ({
  full_name: p.full_name, headline: p.headline, org: p.org, grad_year: p.grad_year, location: p.location,
  about: p.about, linkedin: p.linkedin, github: p.github, website: p.website,
});
