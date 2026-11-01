import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { presignDownload } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ipHash, visitorKey } from "@/lib/visitor";

// Opens a document: the database checks it is viewable and counts the open; files get a 5 minute link.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Not found", { status: 404 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  const { data } = await createAdminClient().rpc("open_document", {
    p_id: id.data, p_visitor: await visitorKey(true), p_ip_hash: await ipHash(), p_viewer: user?.id ?? null,
  });
  const doc = data as { kind: "file" | "link"; url: string | null; object_key: string | null; name: string } | null;
  if (!doc) return new NextResponse("This document is not available.", { status: 404 });
  if (doc.kind === "link" && doc.url && /^https?:\/\//i.test(doc.url)) return NextResponse.redirect(doc.url, 302);
  if (doc.kind === "file" && doc.object_key) {
    try {
      return NextResponse.redirect(await presignDownload(doc.object_key, doc.name), 302);
    } catch (e) {
      console.error("presignDownload", (e as Error).message);
      return new NextResponse("This document cannot be opened right now.", { status: 503 });
    }
  }
  return new NextResponse("This document is not available.", { status: 404 });
}
