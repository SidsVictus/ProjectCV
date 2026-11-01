import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string; email: string; role: "super_admin" | "editor" | "viewer"; status: "active" | "on_hold" | "disabled";
  terms_accepted_at: string | null; full_name: string; headline: string; org: string; grad_year: string;
  location: string; about: string; linkedin: string; github: string; website: string; slug: string | null;
  wallpaper: string; table_style: string; ink: string; glass: string; line: string;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

/** Where a signed-in person belongs right now. */
export function nextPath(p: Profile): string {
  if (p.status !== "active") return `/auth/blocked?status=${p.status}`;
  if (!p.terms_accepted_at) return "/terms";
  if (p.role === "viewer") return "/read-only";
  if (!p.full_name.trim() || !p.headline.trim()) return "/setup";
  return "/portfolio";
}

/** Server-side gate for editor pages. `allow` lists the paths this page may show for. */
export async function requireProfile(allow: string[]): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/");
  const next = nextPath(p);
  if (!allow.includes(next)) redirect(next);
  return p;
}
