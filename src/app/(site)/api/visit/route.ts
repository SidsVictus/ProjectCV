import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ipHash, visitorKey } from "@/lib/visitor";

const body = z.union([z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) }), z.object({ ping: z.uuid() })]);

// Counting runs only here, on the server: the database functions are not callable from browsers.
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const admin = createAdminClient();
  if ("slug" in parsed.data) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    const { data } = await admin.rpc("record_visit", {
      p_slug: parsed.data.slug, p_visitor: await visitorKey(true), p_ip_hash: await ipHash(), p_viewer: user?.id ?? null,
    });
    return NextResponse.json({ id: data ?? null });
  }
  const key = await visitorKey(false);
  if (key) await admin.rpc("touch_visit", { p_id: parsed.data.ping, p_visitor: key });
  return NextResponse.json({ ok: true });
}
