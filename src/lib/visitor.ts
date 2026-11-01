import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

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
