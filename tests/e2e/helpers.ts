import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const service = () => createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export type E2EUser = { id: string; email: string; password: string; name: string };

export async function createUser(name: string, opts: { superAdmin?: boolean } = {}): Promise<E2EUser> {
  const email = `e2e-${randomBytes(5).toString("hex")}@example.test`;
  const password = randomBytes(12).toString("hex");
  if (opts.superAdmin) await service().from("admin_allowlist").insert({ email });
  const { data, error } = await service().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  return { id: data.user.id, email, password, name };
}

/**
 * Signs in with a password (test-only path; the site offers Google only) through @supabase/ssr,
 * which writes the same session cookies the site's OAuth callback writes, then hands them to the browser.
 */
export async function signIn(context: BrowserContext, user: E2EUser) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/", sameSite: "Lax" as const })));
}

/** A ready editor: terms accepted and details filled in, straight to /portfolio. */
export async function readyEditor(name: string, extra: Record<string, string> = {}) {
  const u = await createUser(name);
  await service().from("profiles").update({ terms_accepted_at: new Date().toISOString(), headline: "Builder", ...extra }).eq("id", u.id);
  const { data } = await service().from("profiles").select("slug").eq("id", u.id).single();
  return { ...u, slug: data!.slug as string };
}
