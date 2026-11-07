import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const slug = user ? (await supabase.from("profiles").select("slug").eq("id", user.id).single()).data?.slug : null;
  await supabase.auth.signOut();
  return redirectTo(slug ? `/signed-out?page=${encodeURIComponent(slug)}` : "/signed-out", 303);
}
