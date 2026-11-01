import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { Snapshot } from "@/lib/admin/pcvData";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const p = await getProfile();
  if (!p) redirect("/");
  if (p.role !== "super_admin" || p.status !== "active") redirect("/portfolio");
  const { data, error } = await (await createClient()).rpc("admin_snapshot");
  if (error || !data) throw new Error("The dashboard could not load its numbers.");
  return <AdminDashboard snapshot={data as Snapshot} />;
}
