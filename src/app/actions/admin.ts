"use server";

import { z } from "zod";
import { ROLE_ID, STATUS_ID } from "@/lib/admin/pcvData";
import { deleteObjects } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema } from "@/lib/validation";
import type { Result } from "./portfolio";

// Every function below is checked again inside the database (require_super_admin), so a
// non-admin calling these actions directly gets a refusal from Postgres, not just from here.
const GENERIC = "That did not save. Please try again.";
const statusLabel = z.enum(Object.keys(STATUS_ID) as [keyof typeof STATUS_ID]);
const roleLabel = z.enum(Object.keys(ROLE_ID) as [keyof typeof ROLE_ID]);

function explain(message: string | undefined): string {
  if (message?.includes("own account")) return "You cannot change your own account here.";
  if (message?.includes("super admin only")) return "Only super admins can do that.";
  return GENERIC;
}

export async function saveAccount(userId: unknown, status: unknown, role: unknown): Promise<Result> {
  const id = z.uuid().safeParse(userId), st = statusLabel.nullable().safeParse(status), ro = roleLabel.nullable().safeParse(role);
  if (!id.success || !st.success || !ro.success) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  if (st.data) {
    const { error } = await supabase.rpc("admin_set_status", { p_user: id.data, p_status: STATUS_ID[st.data] });
    if (error) return { ok: false, error: explain(error.message) };
  }
  if (ro.data) {
    const { error } = await supabase.rpc("admin_set_role", { p_user: id.data, p_role: ROLE_ID[ro.data] });
    if (error) return { ok: false, error: explain(error.message) };
  }
  return { ok: true, data: null };
}

export async function deleteAccount(userId: unknown): Promise<Result> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: GENERIC };
  const { data, error } = await (await createClient()).rpc("admin_delete_account", { p_user: id.data });
  if (error) return { ok: false, error: explain(error.message) };
  const keys = (data as string[]) ?? [];
  if (keys.length) {
    try { await deleteObjects(keys); } catch (e) { console.error("R2 cleanup after account delete failed for", keys.length, "objects", (e as Error).message); }
  }
  return { ok: true, data: null };
}

export async function invite(name: unknown, email: unknown, role: unknown): Promise<Result<{ id: string }>> {
  const ro = roleLabel.safeParse(role);
  const parsed = inviteSchema.safeParse({ name, email, role: ro.success ? ROLE_ID[ro.data] : "" });
  if (!parsed.success) return { ok: false, error: "Add a name and a valid email to continue." };
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_super_admin");
  if (!isAdmin) return { ok: false, error: "Only super admins can do that." };
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: parsed.data.email, email_confirm: true, user_metadata: { full_name: parsed.data.name },
  });
  if (error || !data.user) {
    return { ok: false, error: /already|exists|registered/i.test(error?.message ?? "") ? "That email already has an account." : GENERIC };
  }
  const r = await supabase.rpc("admin_invited", { p_user: data.user.id, p_role: parsed.data.role });
  if (r.error) return { ok: false, error: explain(r.error.message) };
  return { ok: true, data: { id: data.user.id } };
}

export async function liveNow(): Promise<number | null> {
  const { data } = await (await createClient()).rpc("admin_live_now");
  return typeof data === "number" ? data : null;
}

export async function logAction(text: unknown): Promise<void> {
  const t = z.string().min(1).max(200).safeParse(text);
  if (t.success) await (await createClient()).rpc("admin_log", { p_text: t.data });
}
