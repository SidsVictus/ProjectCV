import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Service-role client: bypasses RLS. Used only for (1) creating the auth user for the admin
 * "Add user" action, after the caller has been checked as a super admin, and (2) calling the
 * visit and file-open counting functions, which browsers cannot call (rate limited by IP hash).
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
