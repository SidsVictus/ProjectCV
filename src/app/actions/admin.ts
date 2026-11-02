"use server";

import { z } from "zod";
import { ROLE_ID, STATUS_ID } from "@/lib/admin/pcvData";
import { deleteObjects, headObject, presignUpload } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/cv";
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
  if (r.error) {
    // Undo the half-made account so a retry with the same email works.
    await createAdminClient().auth.admin.deleteUser(data.user.id).catch(() => null);
    return { ok: false, error: explain(r.error.message) };
  }
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

/* ---------- Catalogue: wallpapers, table styles and colours ---------- */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((v) => v.toLowerCase());
const itemName = z.string().trim().min(1, "Give it a name.").max(40, "Keep the name under 40 characters.");
const WALLPAPER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_WALLPAPER_BYTES = 8 * 1024 * 1024;

function catalogError(message: string | undefined): string {
  if (message?.includes("keep at least one")) return "Keep at least one visible, so people always have a choice.";
  if (message?.includes("duplicate key")) return "That one is already there.";
  return explain(message);
}

export async function catalogAddTable(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = z.object({
    name: itemName, base: z.enum(TABLES.map((t) => t.id) as [string, ...string[]]), header: hex, rule: hex, band: hex,
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const { name, base, header, rule, band } = parsed.data;
  const { data, error } = await (await createClient()).rpc("admin_catalog_add_table",
    { p_name: name, p_base: base, p_header: header, p_rule: rule, p_band: band });
  if (error || !data) return { ok: false, error: catalogError(error?.message) };
  return { ok: true, data: { id: data as string } };
}

export async function catalogAddColour(input: unknown): Promise<Result> {
  const parsed = z.object({ kind: z.enum(["ink", "glass", "line"]), name: itemName, hex }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const { error } = await (await createClient()).rpc("admin_catalog_add_colour",
    { p_kind: parsed.data.kind, p_name: parsed.data.name, p_hex: parsed.data.hex });
  return error ? { ok: false, error: catalogError(error.message) } : { ok: true, data: null };
}

export async function catalogSetHidden(input: unknown): Promise<Result> {
  const parsed = z.object({
    kind: z.enum(["wallpaper", "table", "ink", "glass", "line"]), id: z.string().regex(/^[a-z0-9#-]{1,40}$/), hidden: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { error } = await (await createClient()).rpc("admin_catalog_set_hidden",
    { p_kind: parsed.data.kind, p_id: parsed.data.id, p_hidden: parsed.data.hidden });
  return error ? { ok: false, error: catalogError(error.message) } : { ok: true, data: null };
}

/** Step 1 of a wallpaper upload: reserve it and get a 5 minute upload link for exactly this file. */
export async function catalogStartWallpaper(input: unknown): Promise<Result<{ id: string; url: string }>> {
  const parsed = z.object({
    name: itemName, mime: z.enum(WALLPAPER_TYPES),
    size: z.number().int().positive().max(MAX_WALLPAPER_BYTES, "Wallpapers can be up to 8 MB."),
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.path[0] === "mime" ? "Use a JPG, PNG or WebP image." : parsed.error.issues[0]?.message ?? GENERIC };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_catalog_start_wallpaper",
    { p_name: parsed.data.name, p_mime: parsed.data.mime, p_size: parsed.data.size });
  if (error || !data) return { ok: false, error: catalogError(error?.message) };
  const { id, object_key } = data as { id: string; object_key: string };
  try {
    return { ok: true, data: { id, url: await presignUpload(object_key, parsed.data.mime, parsed.data.size) } };
  } catch (e) {
    console.error("catalog presignUpload", (e as Error).message);
    await supabase.rpc("admin_catalog_abort", { p_id: id });
    return { ok: false, error: "Uploads are not available right now. Please try again later." };
  }
}

/** Step 2: the image must have landed at exactly the reserved size and type, then it goes live. */
export async function catalogFinishWallpaper(id: unknown): Promise<Result> {
  const parsed = z.string().regex(/^w-[a-z0-9]{1,30}$/).safeParse(id);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const { data: row } = await supabase.from("catalog").select("object_key,mime,size_bytes")
    .eq("kind", "wallpaper").eq("id", parsed.data).eq("ready", false).maybeSingle();
  if (!row?.object_key) return { ok: false, error: GENERIC };
  const head = await headObject(row.object_key);
  if (!head || head.size !== row.size_bytes || head.type !== row.mime) {
    await supabase.rpc("admin_catalog_abort", { p_id: parsed.data });
    if (head) await deleteObjects([row.object_key]).catch(() => null);
    return { ok: false, error: "That upload did not finish. Please try again." };
  }
  const { error } = await supabase.rpc("admin_catalog_ready", { p_id: parsed.data, p_size: head.size });
  return error ? { ok: false, error: catalogError(error.message) } : { ok: true, data: null };
}
