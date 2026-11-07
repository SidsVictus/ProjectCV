import { type NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => redirectTo(path);
  if (!code) return to("/?blocked=failed");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/?blocked=failed");
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).single();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return to(`/?blocked=${profile?.status ?? "failed"}`);
  }
  return to("/");
}
