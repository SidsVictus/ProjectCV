import { expect, test } from "@playwright/test";
import { createUser, readyEditor, service, signIn } from "./helpers";

// The Content-Security-Policy is set, uses a fresh nonce, and nothing on any screen is blocked by it.
test("CSP: present with a per-request nonce and no violations on any screen", async ({ page, context }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));

  const first = await page.request.get("/");
  const second = await page.request.get("/");
  const csp = first.headers()["content-security-policy"];
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).not.toBe(second.headers()["content-security-policy"]); // nonce changes per request

  const admin = await createUser("Csp Admin", { superAdmin: true });
  await service().from("profiles").update({ terms_accepted_at: new Date().toISOString(), headline: "Ops" }).eq("id", admin.id);
  const owner = await readyEditor("Csp Owner");
  await service().from("projects").insert({ owner_id: owner.id, name: "Kite", timeline: "2026" });

  await page.goto("/"); await page.waitForTimeout(800);
  await page.goto(`/p/${owner.slug}`);
  await page.locator(".eye-btn").click();
  await expect(page.locator(".whosaw .stream canvas")).toBeVisible();
  await page.waitForTimeout(1500);

  await signIn(context, admin);
  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Choose a table style" }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.goto("/admin");
  await expect(page.locator("#kpis .kpi")).toHaveCount(6);
  await page.waitForTimeout(2500); // three.js scenes and the Realtime socket start

  expect(problems).toEqual([]);
});
