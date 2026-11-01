import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const service = () => createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
export const anon = () => createClient(url(), anonKey(), opts);
export const visitorKey = () => randomBytes(18).toString("base64url");
/** A random 64-hex value, shaped like the server's HMAC of an IP. */
export const ipHash = () => randomBytes(32).toString("hex");

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** A real auth user (password sign in is a test-only path; the site itself offers Google only). */
export async function makeUser(opts2: { name?: string; superAdmin?: boolean; terms?: boolean } = {}): Promise<TestUser> {
  const email = `t${randomBytes(6).toString("hex")}@example.test`;
  const password = randomBytes(12).toString("hex");
  const admin = service();
  if (opts2.superAdmin) await admin.from("admin_allowlist").insert({ email });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: opts2.name ?? "Test person" },
  });
  if (error) throw error;
  const client = createClient(url(), anonKey(), opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  if (opts2.terms !== false) {
    const t = await client.rpc("accept_terms");
    if (t.error) throw t.error;
  }
  return { id: data.user.id, email, client };
}
