import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

const NAME = "pcv_vk";

/** A random, httpOnly visitor code: counts unique visitors without storing who they are. */
export async function visitorKey(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(NAME)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  if (!create) return null;
  const key = randomBytes(18).toString("base64url");
  jar.set(NAME, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return key;
}

/**
 * A one-way hash of the caller's IP, used only to limit how often one network is counted.
 * Netlify sets x-nf-client-connection-ip itself; the others are fallbacks for other hosts and local runs.
 */
export async function ipHash(): Promise<string> {
  const secret = process.env.VISITOR_HASH_SECRET;
  if (!secret) throw new Error("Missing required environment variable: VISITOR_HASH_SECRET");
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex");
}
