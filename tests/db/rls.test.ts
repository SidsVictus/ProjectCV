import { describe, expect, it, beforeAll } from "vitest";
import { anon, ipHash, makeUser, service, visitorKey, type TestUser } from "./helpers";

let a: TestUser; // owner
let b: TestUser; // another owner

beforeAll(async () => {
  a = await makeUser({ name: "Asha Owner" });
  b = await makeUser({ name: "Bala Other" });
});

async function addProject(u: TestUser, name = "Robot") {
  const r = await u.client.from("projects").insert({ owner_id: u.id, name }).select().single();
  if (r.error) throw r.error;
  return r.data as { id: string };
}

describe("profiles", () => {
  it("are created on signup as editors, with a slug from the name", async () => {
    const { data } = await a.client.from("profiles").select("role,status,slug,email").single();
    expect(data).toMatchObject({ role: "editor", status: "active", email: a.email });
    expect(data!.slug).toMatch(/^asha-owner(-\d+)?$/);
  });

  it("allowlisted emails become super admins", async () => {
    const s = await makeUser({ superAdmin: true });
    const { data } = await s.client.from("profiles").select("role").eq("id", s.id).single();
    expect(data!.role).toBe("super_admin");
  });

  it("only show your own row", async () => {
    const { data } = await a.client.from("profiles").select("id");
    expect(data!.map((r) => r.id)).toEqual([a.id]);
  });

  it("cannot be read by anonymous visitors", async () => {
    const { data, error } = await anon().from("profiles").select("id");
    expect(error ?? data!.length === 0).toBeTruthy();
  });

  it("let owners edit page fields but never role, status, slug or terms", async () => {
    const ok = await a.client.from("profiles").update({ headline: "Builder", wallpaper: "deco" }).eq("id", a.id);
    expect(ok.error).toBeNull();
    for (const patch of [{ role: "super_admin" }, { status: "active" }, { slug: "taken" }, { terms_accepted_at: null }, { email: "x@y.z" }]) {
      const r = await a.client.from("profiles").update(patch).eq("id", a.id);
      expect(r.error, JSON.stringify(patch)).not.toBeNull();
    }
  });

  it("cannot be edited by someone else", async () => {
    const r = await b.client.from("profiles").update({ headline: "hacked" }).eq("id", a.id).select();
    expect(r.data ?? []).toHaveLength(0);
  });

  it("keep their slug when the name changes, and slugs stay unique", async () => {
    const before = (await a.client.from("profiles").select("slug").single()).data!.slug;
    await a.client.from("profiles").update({ full_name: "Asha Renamed" }).eq("id", a.id);
    const after = (await a.client.from("profiles").select("slug").single()).data!.slug;
    expect(after).toBe(before);
    const twin = await makeUser({ name: "Asha Owner" });
    const t = (await twin.client.from("profiles").select("slug").single()).data!.slug;
    expect(t).not.toBe(before);
  });
});

describe("projects", () => {
  it("need accepted terms", async () => {
    const fresh = await makeUser({ terms: false });
    const r = await fresh.client.from("projects").insert({ owner_id: fresh.id, name: "X" });
    expect(r.error).not.toBeNull();
    await fresh.client.rpc("accept_terms");
    const r2 = await fresh.client.from("projects").insert({ owner_id: fresh.id, name: "X" });
    expect(r2.error).toBeNull();
  });

  it("are private to their owner", async () => {
    const p = await addProject(a);
    expect((await b.client.from("projects").select().eq("id", p.id)).data).toHaveLength(0);
    expect((await b.client.from("projects").update({ name: "mine" }).eq("id", p.id).select()).data).toHaveLength(0);
    expect((await b.client.from("projects").delete().eq("id", p.id).select()).data).toHaveLength(0);
    expect((await a.client.from("projects").select("name").eq("id", p.id).single()).data!.name).toBe("Robot");
  });

  it("cannot be created for another owner", async () => {
    const r = await b.client.from("projects").insert({ owner_id: a.id, name: "Spoof" });
    expect(r.error).not.toBeNull();
  });

  it("reject an empty name", async () => {
    const r = await a.client.from("projects").insert({ owner_id: a.id, name: "   " });
    expect(r.error).not.toBeNull();
  });

  it("are refused for on hold accounts and viewer accounts", async () => {
    const held = await makeUser();
    const viewer = await makeUser();
    await service().from("profiles").update({ status: "on_hold" }).eq("id", held.id);
    await service().from("profiles").update({ role: "viewer" }).eq("id", viewer.id);
    expect((await held.client.from("projects").insert({ owner_id: held.id, name: "X" })).error).not.toBeNull();
    expect((await viewer.client.from("projects").insert({ owner_id: viewer.id, name: "X" })).error).not.toBeNull();
  });
});

describe("documents", () => {
  it("links can be added to your own project only", async () => {
    const p = await addProject(a);
    const ok = await a.client.from("documents").insert({ project_id: p.id, owner_id: a.id, kind: "link", name: "github.com", url: "https://github.com/x", ready: true });
    expect(ok.error).toBeNull();
    const spoof = await b.client.from("documents").insert({ project_id: p.id, owner_id: b.id, kind: "link", name: "x", url: "https://x.y", ready: true });
    expect(spoof.error).not.toBeNull();
    const bad = await a.client.from("documents").insert({ project_id: p.id, owner_id: a.id, kind: "link", name: "x", url: "javascript:alert(1)", ready: true });
    expect(bad.error).not.toBeNull();
  });

  it("files cannot be inserted directly (no client chosen storage keys)", async () => {
    const p = await addProject(a);
    const r = await a.client.from("documents").insert({ project_id: p.id, owner_id: a.id, kind: "file", name: "x.pdf", ready: true });
    expect(r.error).not.toBeNull();
  });

  it("create_file_document makes a key in the owner's namespace and validates type and ownership", async () => {
    const p = await addProject(a);
    const ok = await a.client.rpc("create_file_document", { p_project: p.id, p_name: "Certificate.pdf", p_mime: "application/pdf", p_size: 10 });
    expect(ok.error).toBeNull();
    expect(ok.data.object_key).toMatch(new RegExp(`^users/${a.id}/projects/${p.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(ok.data.ready).toBe(false);
    expect((await a.client.rpc("create_file_document", { p_project: p.id, p_name: "x", p_mime: "text/html", p_size: 10 })).error).not.toBeNull();
    expect((await b.client.rpc("create_file_document", { p_project: p.id, p_name: "x", p_mime: "application/pdf", p_size: 10 })).error).not.toBeNull();
    expect((await b.client.rpc("mark_document_ready", { p_id: ok.data.id, p_size: 10 })).error).not.toBeNull();
    expect((await a.client.rpc("mark_document_ready", { p_id: ok.data.id, p_size: 10 })).error).toBeNull();
  });
});

describe("storage quota", () => {
  it("allows 100 MB per file and 1 GB per account, counting pending uploads", async () => {
    const u = await makeUser();
    const p = (await u.client.from("projects").insert({ owner_id: u.id, name: "Big" }).select().single()).data!;
    const mb = 1024 * 1024;
    const reserve = (size: number) => u.client.rpc("create_file_document", { p_project: p.id, p_name: "f.pdf", p_mime: "application/pdf", p_size: size });
    expect((await reserve(100 * mb + 1)).error).not.toBeNull();
    expect((await reserve(0)).error).not.toBeNull();
    for (let i = 0; i < 10; i++) expect((await reserve(100 * mb)).error).toBeNull(); // 1000 MB used
    const over = await reserve(25 * mb);
    expect(over.error?.code).toBe("53400");
    expect((await reserve(24 * mb)).error).toBeNull(); // exactly 1024 MB
  });

  it("an upload must be exactly the reserved size", async () => {
    const u = await makeUser();
    const p = (await u.client.from("projects").insert({ owner_id: u.id, name: "Exact" }).select().single()).data!;
    const doc = (await u.client.rpc("create_file_document", { p_project: p.id, p_name: "f.pdf", p_mime: "application/pdf", p_size: 1000 })).data;
    expect((await u.client.rpc("mark_document_ready", { p_id: doc.id, p_size: 999999 })).error).not.toBeNull();
    expect((await u.client.rpc("mark_document_ready", { p_id: doc.id, p_size: 1000 })).error).toBeNull();
  });
});

describe("public page", () => {
  it("shows public fields only, no email, and ready documents only", async () => {
    const owner = await makeUser({ name: "Public Person" });
    const p = await addProject(owner, "Shown");
    await owner.client.rpc("create_file_document", { p_project: p.id, p_name: "pending.pdf", p_mime: "application/pdf", p_size: 10 });
    await owner.client.from("documents").insert({ project_id: p.id, owner_id: owner.id, kind: "link", name: "demo", url: "https://demo.example", ready: true });
    const slug = (await owner.client.from("profiles").select("slug").single()).data!.slug;
    const { data } = await anon().rpc("get_public_portfolio", { p_slug: slug });
    expect(data.status).toBe("ok");
    expect(JSON.stringify(data)).not.toContain(owner.email);
    expect(data.projects[0].documents.map((d: { name: string }) => d.name)).toEqual(["demo"]);
  });

  it("on hold pages stay visible; disabled pages are unavailable", async () => {
    const owner = await makeUser({ name: "Status Person" });
    const slug = (await owner.client.from("profiles").select("slug").single()).data!.slug;
    await service().from("profiles").update({ status: "on_hold" }).eq("id", owner.id);
    expect((await anon().rpc("get_public_portfolio", { p_slug: slug })).data.status).toBe("ok");
    await service().from("profiles").update({ status: "disabled" }).eq("id", owner.id);
    expect((await anon().rpc("get_public_portfolio", { p_slug: slug })).data).toEqual({ status: "unavailable" });
    expect((await service().rpc("record_visit", { p_slug: slug, p_visitor: visitorKey(), p_ip_hash: ipHash(), p_viewer: null })).data).toBeNull();
  });

  it("counts visitors once per 30 minutes, never the owner, and reports stats", async () => {
    const owner = await makeUser({ name: "Stats Person" });
    const p = await addProject(owner);
    const doc = (await owner.client.from("documents").insert({ project_id: p.id, owner_id: owner.id, kind: "link", name: "cert", url: "https://c.example", ready: true }).select().single()).data!;
    const slug = (await owner.client.from("profiles").select("slug").single()).data!.slug;
    const v1 = visitorKey(), v2 = visitorKey();
    const visit = (visitor: string, viewer: string | null = null, ip = ipHash()) =>
      service().rpc("record_visit", { p_slug: slug, p_visitor: visitor, p_ip_hash: ip, p_viewer: viewer });
    const id1 = (await visit(v1)).data;
    expect((await visit(v1)).data).toBe(id1);
    await visit(v2);
    expect((await visit(visitorKey(), owner.id)).data).toBeNull(); // the owner is never counted
    await service().rpc("open_document", { p_id: doc.id, p_visitor: v1, p_ip_hash: ipHash(), p_viewer: null });
    await service().rpc("open_document", { p_id: doc.id, p_visitor: v1, p_ip_hash: ipHash(), p_viewer: owner.id });
    const s = (await anon().rpc("portfolio_stats", { p_slug: slug, p_range: "7d" })).data;
    expect(s.visitors).toBe(2);
    expect(s.files_opened).toBe(1);
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[6][1]).toBe(2);
    expect(s.files).toEqual([["cert", 1]]);
    expect((await anon().rpc("portfolio_stats", { p_slug: slug, p_range: "30d" })).data.buckets).toHaveLength(4);
    expect((await anon().rpc("portfolio_stats", { p_slug: slug, p_range: "all" })).data.buckets.length).toBeGreaterThan(0);
    expect((await visit("bad key!")).error).not.toBeNull();
  });

  it("browsers cannot call the counting functions at all", async () => {
    const args = { p_slug: "x", p_visitor: visitorKey(), p_ip_hash: ipHash(), p_viewer: null };
    expect((await anon().rpc("record_visit", args)).error).not.toBeNull();
    expect((await a.client.rpc("record_visit", args)).error).not.toBeNull();
    const open = { p_id: "00000000-0000-4000-8000-000000000000", p_visitor: visitorKey(), p_ip_hash: ipHash(), p_viewer: null };
    expect((await anon().rpc("open_document", open)).error).not.toBeNull();
    expect((await anon().rpc("touch_visit", { p_id: open.p_id, p_visitor: open.p_visitor })).error).not.toBeNull();
  });

  it("one network counts at most 3 visits per page per day and 3 opens per file per hour", async () => {
    const owner = await makeUser({ name: "Limit Person" });
    const slug = (await owner.client.from("profiles").select("slug").single()).data!.slug;
    const ip = ipHash();
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push((await service().rpc("record_visit", { p_slug: slug, p_visitor: visitorKey(), p_ip_hash: ip, p_viewer: null })).data);
    expect(ids.filter(Boolean)).toHaveLength(3);
    expect((await service().rpc("record_visit", { p_slug: slug, p_visitor: visitorKey(), p_ip_hash: ipHash(), p_viewer: null })).data).not.toBeNull();
    const p = (await owner.client.from("projects").insert({ owner_id: owner.id, name: "P" }).select().single()).data!;
    const doc = (await owner.client.from("documents").insert({ project_id: p.id, owner_id: owner.id, kind: "link", name: "x", url: "https://x.example", ready: true }).select().single()).data!;
    for (let i = 0; i < 5; i++) {
      const r = await service().rpc("open_document", { p_id: doc.id, p_visitor: visitorKey(), p_ip_hash: ip, p_viewer: null });
      expect(r.data.url).toBe("https://x.example"); // the document always opens
    }
    expect((await service().rpc("portfolio_stats", { p_slug: slug, p_range: "7d" })).data).toMatchObject({ visitors: 4, files_opened: 3 });
  });

  it("analytics tables are not readable directly", async () => {
    for (const t of ["page_visits", "file_opens", "edit_sessions", "activity", "audit_log", "admin_allowlist"]) {
      const r = await a.client.from(t).select("*").limit(1);
      expect(r.error ?? r.data!.length === 0, t).toBeTruthy();
    }
  });
});

describe("super admin", () => {
  it("is the only role that can read the snapshot or change accounts", async () => {
    expect((await a.client.rpc("admin_snapshot")).error).not.toBeNull();
    expect((await anon().rpc("admin_snapshot")).error).not.toBeNull();
    expect((await a.client.rpc("admin_set_status", { p_user: b.id, p_status: "disabled" })).error).not.toBeNull();
    expect((await a.client.rpc("admin_delete_account", { p_user: b.id })).error).not.toBeNull();
  });

  it("snapshot has the dashboard's shape", async () => {
    const s = await makeUser({ superAdmin: true, name: "Sam Admin" });
    await s.client.rpc("heartbeat_edit_session", { p_id: null });
    const { data, error } = await s.client.rpc("admin_snapshot");
    expect(error).toBeNull();
    expect(data.me).toBe("Sam Admin");
    expect(data.daily.signups).toHaveLength(365);
    expect(data.daily.signups[0]).toBeGreaterThan(0);
    expect(data.cohorts).toHaveLength(12);
    expect(data.cohorts[11].values[1]).toBeNull(); // the newest cohort has no week 1 yet
    expect(data.cohorts[11].values[0]).toBe(100); // this week has signups
    const empty = data.cohorts.find((c: { size: number }) => c.size === 0);
    if (empty) expect(empty.values.every((v: number | null) => v === null)).toBe(true);
    expect(data.heat).toHaveLength(7);
    expect(data.heat[0]).toHaveLength(24);
    expect(data.live_now).toBeGreaterThanOrEqual(1);
    expect(data.users.find((u: { id: string }) => u.id === a.id)).toMatchObject({ role: "editor", status: "active" });
  });

  it("changes status and role with an audit row, never on themselves", async () => {
    const s = await makeUser({ superAdmin: true, name: "Ravi Admin" });
    const target = await makeUser({ name: "Meera Target" });
    expect((await s.client.rpc("admin_set_status", { p_user: s.id, p_status: "on_hold" })).error).not.toBeNull();
    expect((await s.client.rpc("admin_set_role", { p_user: s.id, p_role: "editor" })).error).not.toBeNull();
    expect((await s.client.rpc("admin_set_status", { p_user: target.id, p_status: "on_hold" })).error).toBeNull();
    expect((await s.client.rpc("admin_set_role", { p_user: target.id, p_role: "viewer" })).error).toBeNull();
    const log = (await s.client.from("audit_log").select("actor_name,text").order("at", { ascending: false }).limit(2)).data!;
    expect(log.map((l) => l.text)).toEqual(["changed Meera Target from Editor to Viewer", "put Meera Target on hold"]);
    expect(log[0].actor_name).toBe("Ravi Admin");
    expect((await a.client.from("audit_log").select("id")).data).toHaveLength(0);
  });

  it("deletes an account everywhere and returns its storage keys", async () => {
    const s = await makeUser({ superAdmin: true });
    const victim = await makeUser({ name: "Gone Soon" });
    const p = await addProject(victim);
    const f = (await victim.client.rpc("create_file_document", { p_project: p.id, p_name: "a.pdf", p_mime: "application/pdf", p_size: 10 })).data;
    const { data, error } = await s.client.rpc("admin_delete_account", { p_user: victim.id });
    expect(error).toBeNull();
    expect(data).toEqual([f.object_key]);
    expect((await service().from("projects").select("id").eq("owner_id", victim.id)).data).toHaveLength(0);
    expect((await service().auth.admin.getUserById(victim.id)).data.user).toBeNull();
    expect((await s.client.rpc("admin_delete_account", { p_user: s.id })).error).not.toBeNull();
  });
});
