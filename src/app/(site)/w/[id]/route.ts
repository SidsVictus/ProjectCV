import { NextResponse, type NextRequest } from "next/server";
import { presignWallpaper } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

// A custom wallpaper image: redirects to a signed R2 link that stays the same all day, so browsers cache it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^w-[a-z0-9]{1,30}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await (await createClient()).from("catalog").select("object_key")
    .eq("kind", "wallpaper").eq("id", id).eq("ready", true).maybeSingle();
  if (!data?.object_key) return new NextResponse("Not found", { status: 404 });
  try {
    const res = NextResponse.redirect(await presignWallpaper(data.object_key), 302);
    res.headers.set("Cache-Control", "public, max-age=3600");
    return res;
  } catch (e) {
    console.error("presignWallpaper", (e as Error).message);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
