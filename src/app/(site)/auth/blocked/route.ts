import { type NextRequest } from "next/server";
import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// A session whose account was put on hold or disabled after sign in: end it.
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") === "disabled" ? "disabled" : "on_hold";
  await (await createClient()).auth.signOut();
  return redirectTo(`/?blocked=${status}`);
}
