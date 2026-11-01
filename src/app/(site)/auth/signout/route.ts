import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const slug = user ? (await supabase.from("profiles").select("slug").eq("id", user.id).single()).data?.slug : null;
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(slug ? `/signed-out?page=${encodeURIComponent(slug)}` : "/signed-out", request.url), 303);
}
