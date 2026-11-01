import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { visitorKey } from "@/lib/visitor";

const body = z.union([z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) }), z.object({ ping: z.uuid() })]);

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const supabase = await createClient();
  if ("slug" in parsed.data) {
    const key = await visitorKey(true);
    const { data } = await supabase.rpc("record_visit", { p_slug: parsed.data.slug, p_visitor: key });
    return NextResponse.json({ id: data ?? null });
  }
  const key = await visitorKey(false);
  if (key) await supabase.rpc("touch_visit", { p_id: parsed.data.ping, p_visitor: key });
  return NextResponse.json({ ok: true });
}
