import { expect, test } from "@playwright/test";
import { createUser, readyEditor, service, signIn } from "./helpers";

test("super admin dashboard: real numbers, access changes, add and delete", async ({ page, context, browser }) => {
  const NAME = `Ravi ${Date.now().toString(36)}`;
  const admin = await createUser("Asha Admin", { superAdmin: true });
  await service().from("profiles").update({ terms_accepted_at: new Date().toISOString(), headline: "Runs Project CV" }).eq("id", admin.id);
  const target = await readyEditor(NAME, { org: "VNR VJIET" });
  await signIn(context, admin);

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await expect(page.locator(".head__sub")).toContainText("Asha.");
  await expect(page.locator("#meAvatar")).toHaveText("A");
  await expect(page.locator("body")).not.toContainText("sample data");
  await expect(page.locator("body")).not.toContainText("Sunday night after 9 pm"); // prototype-only insight text
  await expect(page.locator("#skyTotal")).not.toHaveText("0");
  const total = (await service().from("profiles").select("id", { count: "exact", head: true })).count!;
  await expect(page.locator("#skyTotal")).toHaveText(total.toLocaleString("en-IN"));
  await expect(page.locator("#sky canvas, canvas#sky").first()).toBeVisible();
  await expect(page.locator("#kpis .kpi")).toHaveCount(6);
  await expect(page.locator("body")).not.toContainText("NaN");

  // find the target in the users table and put them on hold
  await page.locator("#userSearch").fill(`${NAME}`);
  const row = page.locator("#usersTable tbody tr", { hasText: `${NAME}` });
  await expect(row).toContainText("VNR VJIET");
  await row.getByRole("button", { name: "Manage" }).click();
  await page.locator('#dStatus button[data-v="On hold"]').click();
  await expect(page.locator("#dStatusText")).toContainText("share link still works");
  await page.locator("#dSave").click();
  await expect(page.locator("#toast")).toContainText(`${NAME} is now on hold`);
  await expect(page.locator("#auditLog")).toContainText(`put ${NAME} on hold`);
  expect((await service().from("profiles").select("status").eq("id", target.id).single()).data!.status).toBe("on_hold");

  // on hold: the page stays public; the owner cannot use the site
  const anon = await browser.newContext();
  const a = await anon.newPage();
  await a.goto(`/p/${target.slug}`);
  await expect(a.locator(".cv-name")).toHaveText(`${NAME}`);
  const owner = await browser.newContext();
  await signIn(owner, target);
  const o = await owner.newPage();
  await o.goto("/portfolio");
  await expect(o).toHaveURL(/\?blocked=on_hold$/);
  await expect(o.locator(".dome-card__sub")).toContainText("Your account is on hold");

  // disabled: the public page becomes unavailable
  await row.getByRole("button", { name: "Manage" }).click();
  await page.locator('#dStatus button[data-v="Disabled"]').click();
  await page.locator("#dSave").click();
  await expect(page.locator("#auditLog")).toContainText(`disabled ${NAME}`);
  await a.reload();
  await expect(a.getByRole("heading", { name: "This page is unavailable." })).toBeVisible();

  // role change
  await row.getByRole("button", { name: "Manage" }).click();
  await page.locator("#dRoles label", { hasText: "Opens read-only pages" }).click();
  await page.locator("#dSave").click();
  await expect(page.locator("#auditLog")).toContainText(`changed ${NAME} from Editor to Viewer`);

  // an admin cannot change themselves (database refuses)
  await page.locator("#userSearch").fill(admin.email);
  await page.locator("#usersTable tbody tr", { hasText: admin.email }).getByRole("button", { name: "Manage" }).click();
  await page.locator('#dStatus button[data-v="On hold"]').click();
  await page.locator("#dSave").click();
  await expect(page.locator("#toast")).toContainText("You cannot change your own account here.");
  expect((await service().from("profiles").select("status").eq("id", admin.id).single()).data!.status).toBe("active");
  await page.keyboard.press("Escape");

  // add user creates a real account they can sign in to with Google
  const email = `new-${Date.now()}@example.test`;
  await page.locator("#addUserBtn").click();
  await page.locator("#aName").fill("Neha New");
  await page.locator("#aEmail").fill(email);
  await page.locator("#aConfirm").click();
  await expect(page.locator("#toast")).toContainText(`They can sign in with Google using ${email}`);
  await expect(page.locator("#auditLog")).toContainText("added Neha New as an Editor");
  expect((await service().from("profiles").select("role").eq("email", email).single()).data!.role).toBe("editor");

  // delete the target account everywhere
  await page.locator("#userSearch").fill(`${NAME}`);
  await row.getByRole("button", { name: "Manage" }).click();
  await page.locator("#dDelete").click();
  await page.locator("#cConfirm").click();
  await expect(page.locator("#toast")).toContainText(`${NAME}'s account was deleted.`);
  await expect(page.locator("#usersTable")).not.toContainText(`${NAME}`);
  expect((await service().auth.admin.getUserById(target.id)).data.user).toBeNull();
  await a.reload();
  await expect(a.getByRole("heading", { name: "Nothing here." })).toBeVisible();

  // live feed: a new project elsewhere shows up without a reload
  const live = await readyEditor("Live Builder");
  await page.reload();
  await expect(page.locator("#feed")).toBeVisible();
  await service().from("projects").insert({ owner_id: live.id, name: "Weather balloon" });
  await expect(page.locator("#feed")).toContainText("Live Builder added Weather balloon", { timeout: 15_000 });

  // export downloads a CSV of the chosen range
  const download = page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  expect((await download).suggestedFilename()).toBe("projectcv-report-30-days.csv");

  expect(errors).toEqual([]);
  await anon.close(); await owner.close();
});
