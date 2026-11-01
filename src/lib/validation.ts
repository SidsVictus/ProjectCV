import { z } from "zod";
import { TABLES, WALLPAPERS } from "./cv";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "./r2-rules";

const text = (max: number) => z.string().trim().max(max);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i).transform((s) => s.toLowerCase());

export const profileSchema = z.object({
  full_name: text(80).min(1, "Add your name and a headline to continue."),
  headline: text(120).min(1, "Add your name and a headline to continue."),
  org: text(120),
  grad_year: z.string().trim().regex(/^(\d{4})?$/, "Use a four digit year, like 2028."),
  location: text(80),
  about: text(160),
  linkedin: text(200),
  github: text(200),
  website: text(200),
});

export const styleSchema = z.object({
  wallpaper: z.enum(WALLPAPERS.map((w) => w.id) as [string, ...string[]]).optional(),
  table_style: z.enum(TABLES.map((t) => t.id) as [string, ...string[]]).optional(),
  ink: hex.optional(),
  glass: hex.optional(),
  line: hex.optional(),
});

export const projectSchema = z.object({
  name: text(120).min(1, "Give your project a name so viewers know what it is."),
  timeline: text(60),
  description: text(2000),
  status: z.enum(["done", "wip"]),
});

/** A pasted link; "github.com/me" becomes "https://github.com/me". */
export const linkSchema = z.string().trim().min(1).max(2000)
  .transform((s) => (/^https?:\/\//i.test(s) ? s : "https://" + s))
  .refine((s) => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes("."); } catch { return false; } },
    "That does not look like a link. Try something like drive.google.com/...");

export const uploadSchema = z.object({
  projectId: z.uuid(),
  name: text(200).min(1),
  mime: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_BYTES, "That file is over 5 GB, the most one upload can hold."),
});

export const statusSchema = z.enum(["active", "on_hold", "disabled"]);
export const roleSchema = z.enum(["super_admin", "editor", "viewer"]);

export const inviteSchema = z.object({
  name: text(80).min(1),
  email: z.email().transform((s) => s.toLowerCase()),
  role: roleSchema,
});
