"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteObjects, headObject, presignUpload } from "@/lib/r2";
import { linkSchema, profileSchema, projectSchema, styleSchema, uploadSchema } from "@/lib/validation";
import { domainOf } from "@/lib/cv";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC = "Something went wrong. Please try again.";
const fail = (error: string): Result<never> => ({ ok: false, error });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? GENERIC;

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function acceptTerms(): Promise<Result> {
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { error } = await supabase.rpc("accept_terms");
  if (error) { console.error("accept_terms", error.message); return fail(GENERIC); }
  return { ok: true, data: null };
}

export async function saveProfile(input: unknown): Promise<Result<{ slug: string | null }>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { data, error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id).select("slug").single();
  if (error) { console.error("saveProfile", error.message); return fail(GENERIC); }
  revalidatePath("/portfolio");
  return { ok: true, data: { slug: data.slug } };
}

export async function saveStyle(input: unknown): Promise<Result> {
  const parsed = styleSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) { console.error("saveStyle", error.message); return fail(GENERIC); }
  return { ok: true, data: null };
}

const saveProjectInput = z.object({
  id: z.uuid().nullable(),
  project: projectSchema,
  addLinks: z.array(z.string()).max(50),
  removeDocs: z.array(z.uuid()).max(200),
});

/** Creates or updates a project, adds pasted links and removes the documents the owner took off. */
export async function saveProject(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = saveProjectInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const links: string[] = [];
  for (const l of parsed.data.addLinks) {
    const r = linkSchema.safeParse(l);
    if (!r.success) return fail(firstIssue(r.error));
    links.push(r.data);
  }
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { id, project, removeDocs } = parsed.data;

  const saved = id
    ? await supabase.from("projects").update(project).eq("id", id).select("id").single()
    : await supabase.from("projects").insert({ ...project, owner_id: user.id }).select("id").single();
  if (saved.error || !saved.data) { console.error("saveProject", saved.error?.message); return fail(GENERIC); }
  const projectId = saved.data.id as string;

  if (links.length) {
    const { error } = await supabase.from("documents").insert(
      links.map((url) => ({ project_id: projectId, owner_id: user.id, kind: "link", name: domainOf(url), url, ready: true })));
    if (error) { console.error("saveProject links", error.message); return fail(GENERIC); }
  }
  if (removeDocs.length) {
    const r = await removeDocuments(supabase, removeDocs, projectId);
    if (!r.ok) return r;
  }
  revalidatePath("/portfolio");
  return { ok: true, data: { id: projectId } };
}

async function removeDocuments(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[], projectId: string): Promise<Result> {
  const { data, error } = await supabase.from("documents").delete().in("id", ids).eq("project_id", projectId).select("object_key");
  if (error) { console.error("removeDocuments", error.message); return fail(GENERIC); }
  await cleanUp((data ?? []).map((d) => d.object_key).filter(Boolean) as string[]);
  return { ok: true, data: null };
}

/** Storage clean up after the rows are gone. A failure leaves an orphan object, which is logged. */
async function cleanUp(keys: string[]) {
  if (!keys.length) return;
  try { await deleteObjects(keys); } catch (e) { console.error("R2 cleanup failed for", keys.length, "objects", (e as Error).message); }
}

export async function deleteProject(id: unknown): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail(GENERIC);
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const docs = await supabase.from("documents").select("object_key").eq("project_id", parsed.data);
  const { data, error } = await supabase.from("projects").delete().eq("id", parsed.data).select("id");
  if (error || !data?.length) { console.error("deleteProject", error?.message); return fail(GENERIC); }
  await cleanUp((docs.data ?? []).map((d) => d.object_key).filter(Boolean) as string[]);
  revalidatePath("/portfolio");
  return { ok: true, data: null };
}

/** Step 1 of an upload: a pending document and a 5 minute presigned PUT for its server-made key. */
export async function startUpload(input: unknown): Promise<Result<{ id: string; url: string }>> {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.path[0] === "mime"
    ? "That file type is not supported. Use a PDF, image, slides, document, video or zip." : firstIssue(parsed.error));
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { data, error } = await supabase.rpc("create_file_document",
    { p_project: parsed.data.projectId, p_name: parsed.data.name, p_mime: parsed.data.mime });
  if (error || !data) { console.error("startUpload", error?.message); return fail(GENERIC); }
  try {
    return { ok: true, data: { id: data.id, url: await presignUpload(data.object_key, parsed.data.mime) } };
  } catch (e) {
    console.error("presignUpload", (e as Error).message);
    await supabase.from("documents").delete().eq("id", data.id);
    return fail("Uploads are not available right now. Please try again later.");
  }
}

/** Step 2: the server checks the object really landed, with the declared type, before showing it. */
export async function finishUpload(id: unknown): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail(GENERIC);
  const { supabase, user } = await session();
  if (!user) return fail("Please sign in again.");
  const { data: doc } = await supabase.from("documents").select("object_key,mime,ready").eq("id", parsed.data).single();
  if (!doc?.object_key) return fail(GENERIC);
  const head = await headObject(doc.object_key);
  if (!head || head.size === 0 || head.type !== doc.mime) {
    await supabase.from("documents").delete().eq("id", parsed.data);
    if (head) await cleanUp([doc.object_key]);
    return fail("That upload did not finish. Please try again.");
  }
  const { error } = await supabase.rpc("mark_document_ready", { p_id: parsed.data, p_size: head.size });
  if (error) { console.error("finishUpload", error.message); return fail(GENERIC); }
  revalidatePath("/portfolio");
  return { ok: true, data: null };
}

export async function heartbeat(id: string | null): Promise<string | null> {
  const parsed = z.uuid().nullable().safeParse(id);
  const { supabase, user } = await session();
  if (!user || !parsed.success) return null;
  const { data } = await supabase.rpc("heartbeat_edit_session", { p_id: parsed.data });
  return (data as string) ?? null;
}
