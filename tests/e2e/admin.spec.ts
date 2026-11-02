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

  // removed cards stay removed; the empty "Needs a look" message reads on one line
  await expect(page.locator("#feed, #heatmap")).toHaveCount(0);
  const empty = page.locator("#attention li").first();
  if (await empty.textContent().then((t) => t?.includes("Nothing needs a look"))) expect((await empty.boundingBox())!.height).toBeLessThan(90);

  // export downloads a CSV of the chosen range
  const download = page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  expect((await download).suggestedFilename()).toBe("projectcv-report-30-days.csv");

  expect(errors).toEqual([]);
  await anon.close(); await owner.close();
});

test("super admins add and hide wallpapers, tables and colours; owners pick them", async ({ page, context, browser }) => {
  const tag = Date.now().toString(36);
  const admin = await createUser("Cora Curator", { superAdmin: true });
  await service().from("profiles").update({ terms_accepted_at: new Date().toISOString(), headline: "Curates styles" }).eq("id", admin.id);
  await signIn(context, admin);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await page.locator("#manageCatalogBtn").click();
  const dlg = page.locator("#catalogDialog");
  await expect(dlg.locator(".cat-item", { hasText: "Oak grain" })).toBeVisible(); // built-ins come from the database
  const before = await dlg.locator(".cat-item").count();

  // a wallpaper: uploaded straight to storage, checked by the server, then live
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await dlg.locator("#cName").fill(`Sunset ${tag}`);
  await dlg.locator("#cFile").setInputFiles({ name: "sunset.png", mimeType: "image/png", buffer: png });
  await dlg.getByRole("button", { name: "Upload wallpaper" }).click();
  await expect(page.locator("#toast")).toContainText(`Sunset ${tag} was added`);
  await expect(dlg.locator(".cat-item")).toHaveCount(before + 1);
  const wall = (await service().from("catalog").select("id").eq("name", `Sunset ${tag}`).single()).data!.id as string;

  // a table style and a colour
  await dlg.getByRole("button", { name: "Tables" }).click();
  await dlg.locator("#cName").fill(`Gold ${tag}`);
  await dlg.locator("#cBase").selectOption("spot");
  await dlg.getByRole("button", { name: "Add table style" }).click();
  await expect(page.locator("#toast")).toContainText(`Gold ${tag} was added`);
  await dlg.getByRole("button", { name: "Colours" }).click();
  await dlg.locator("#cKind").selectOption("ink");
  await dlg.locator("#cName").fill(`Honey ${tag}`);
  await dlg.locator("#cHex").fill("#7a4f10");
  await dlg.getByRole("button", { name: "Add colour" }).click();
  await expect(page.locator("#toast")).toContainText(`Honey ${tag} was added`);
  await expect(page.locator("#auditLog")).toContainText(`added the text colour Honey ${tag}`);

  // hiding the colour takes it out of pickers
  await dlg.locator(".cat-item", { hasText: `Honey ${tag}` }).getByRole("button", { name: "Hide" }).click();
  await expect(dlg.locator(".cat-item", { hasText: `Honey ${tag}` })).toContainText("Hidden");
  expect(errors).toEqual([]);

  // an owner sees the new wallpaper and table, not the hidden colour, and can use them
  const owner = await readyEditor(`Picker ${tag}`);
  const oc = await browser.newContext();
  await signIn(oc, owner);
  const o = await oc.newPage();
  await o.goto("/portfolio");
  await o.getByRole("button", { name: "Choose a table style" }).click();
  const gold = o.locator(".spool-item", { hasText: `Gold ${tag}` });
  await o.locator('[data-wheel="tables"]').evaluate((el) => { el.scrollTop = el.scrollHeight; }); // newest is last
  await expect(gold).toHaveClass(/is-on/);
  await o.locator('[data-wheel="tables"]').press("Enter");
  await expect(o.locator("table.tbl.tbl-spot")).toBeVisible();
  await o.getByRole("button", { name: "Edit Colors" }).click();
  await expect(o.getByRole("radio", { name: `Honey ${tag}` })).toHaveCount(0);
  await o.getByRole("button", { name: "Done" }).click();
  await o.getByRole("button", { name: "Change wallpaper" }).click();
  const sunset = o.getByRole("option", { name: `Sunset ${tag}` });
  await o.locator('[data-wheel="walls"]').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect(sunset).toHaveAttribute("aria-selected", "true");
  await o.getByRole("button", { name: "Apply" }).click();
  await expect.poll(async () => (await service().from("profiles").select("wallpaper,table_style").eq("id", owner.id).single()).data)
    .toMatchObject({ wallpaper: wall });

  // the public page paints it, and the image link resolves to the stored bytes
  const v = await (await browser.newContext()).newPage();
  await v.goto(`/p/${owner.slug}`);
  await expect(v.locator(".wp").first()).toHaveAttribute("style", new RegExp(`/w/${wall}`));
  const img = await v.request.get(`/w/${wall}`);
  expect(img.status()).toBe(200);
  expect(Buffer.from(await img.body()).equals(png)).toBe(true);
  await oc.close();
});
