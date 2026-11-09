import { expect, test } from "@playwright/test";
import { createUser, readyEditor, service, signIn } from "./helpers";

test("first sign in: terms, setup with validation, empty portfolio", async ({ page, context }) => {
  const u = await createUser("");
  await signIn(context, u);
  await page.goto("/");
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByText(`Signed in as ${u.email}`)).toBeVisible();
  const accept = page.getByRole("button", { name: "Accept and continue" });
  await expect(accept).toBeDisabled();
  await page.getByRole("checkbox").check();
  await accept.click();

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Almost there · About you" })).toBeVisible();
  await page.getByRole("button", { name: "Create my page" }).click();
  await expect(page.getByText("Add your name and a headline to continue.")).toBeVisible();
  await page.getByPlaceholder("Your name as you want it shown").fill("Kavya Menon");
  await page.getByPlaceholder("e.g. B.Tech Data Science student").fill("Electronics student");
  await page.getByPlaceholder("e.g. MVSR Engineering College").fill("CBIT");
  await expect(page.locator(".cv-pane .cv-name")).toHaveText("Kavya Menon"); // live preview
  await page.getByRole("button", { name: "Create my page" }).click();

  await expect(page).toHaveURL(/\/portfolio$/);
  await expect(page.getByText("Your first project goes here.")).toBeVisible();
  await expect(page.locator(".cv-meta")).toContainText("CBIT");
  await expect(page.locator(".cv-meta")).toContainText("0 projects");
});

test("projects, documents, styles, share, preview and the public page", async ({ page, context, browser }) => {
  const u = await readyEditor("Arjun Rao");
  await signIn(context, u);
  await page.goto("/portfolio");

  // add a project with a link and an uploaded file
  await page.getByRole("button", { name: "Add a project" }).click();
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Give your project a name so viewers know what it is.")).toBeVisible();
  await page.getByPlaceholder("e.g. Line-following robot").fill("Solar tracker");
  await page.getByPlaceholder("e.g. Jan to Mar 2026").fill("2025");
  await page.getByPlaceholder("What did you build, how, and what came of it?").fill("A panel that follows the sun.");
  await page.getByRole("button", { name: "Completed" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "Report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test report") });
  await page.getByRole("button", { name: "Paste a link" }).click();
  await page.getByLabel("Link").fill("github.com/arjun/solar");
  await page.getByRole("button", { name: "Add link" }).click();
  await page.getByRole("button", { name: "Save project" }).click();

  const row = page.locator("table.tbl tbody tr").first();
  await expect(row.locator(".c-name")).toHaveText("Solar tracker");
  await expect(row.locator(".cv-done")).toHaveText("Completed");
  await expect(row.locator(".tbl-doc")).toHaveCount(2);
  await expect(row.locator(".tbl-doc", { hasText: "Report.pdf" })).toBeVisible();
  await expect(row.locator(".tbl-doc", { hasText: "github.com" })).toBeVisible();
  await expect(page.locator(".cv-meta")).toContainText("1 project");

  // persisted: reload shows it from the database
  await page.reload();
  await expect(page.locator("table.tbl tbody tr")).toHaveCount(1);

  // table style through the spool, saved
  await page.getByRole("button", { name: "Choose a table style" }).click();
  await page.locator('[data-wheel="tables"]').press("ArrowDown");
  await page.waitForTimeout(700);
  await page.locator('[data-wheel="tables"]').press("Enter");
  await expect(page.locator("table.tbl-stripe")).toBeVisible();

  // wallpaper through the runway, saved
  await page.getByRole("button", { name: "Change wallpaper" }).click();
  await page.locator('[data-wheel="walls"]').press("ArrowRight");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Apply" }).click();

  // colours, saved on Done
  await page.getByRole("button", { name: "Edit Colors" }).click();
  await page.getByRole("radio", { name: "Midnight" }).click();
  await page.getByLabel("Glass transparency").fill("40"); // 40% see-through, so the glass is 60% solid
  await expect(page.locator(".cv-pane")).toHaveCSS("background-color", /0\.6\)$/);
  await page.getByRole("button", { name: "Done" }).click();
  await expect.poll(async () => (await service().from("profiles").select("table_style,wallpaper,ink,pane").eq("id", u.id).single()).data)
    .toEqual({ table_style: "stripe", wallpaper: "deco", ink: "#1d2a44", pane: 0.6 });

  // share dialog shows the stable link; Copy link turns into a tick and then goes back
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.locator(".pcv-share__url")).toHaveText(`localhost:3000/p/${u.slug}`);
  const copy = page.locator(".pcv-share__row .sb");
  await copy.click();
  await expect(copy).toHaveAttribute("data-state", "done");
  await expect(copy).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3000/p/${u.slug}`);
  await expect(copy).toHaveAttribute("data-state", "idle", { timeout: 6000 });
  await page.getByRole("button", { name: "Done" }).click();

  // preview: no edit controls
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("exactly as viewers do.")).toBeVisible();
  await expect(page.locator(".c-act, .cv-add, .tbl-attach")).toHaveCount(0);

  // the public page, as an anonymous visitor
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`/p/${u.slug}`);
  await expect(v.locator(".cv-name")).toHaveText("Arjun Rao");
  await expect(v.locator("td.c-name")).toHaveText("Solar tracker");
  await expect(v.locator(".c-act, .cv-add, .tbl-attach, .cv-edit")).toHaveCount(0);
  await expect(v.getByRole("link", { name: "Create one for yourself" })).toBeVisible();
  await expect(v.locator("body")).not.toContainText(u.email);

  // opening the uploaded file: authorized redirect to a short-lived signed link with the real bytes
  const fileHref = await v.locator(".tbl-doc", { hasText: "Report.pdf" }).getAttribute("href");
  const res = await v.request.get(fileHref!);
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe("%PDF-1.4 test report");
  expect(res.url()).toContain("X-Amz-Expires=300");

  // the visit and the open are counted for the owner
  await expect.poll(async () => (await service().rpc("portfolio_stats", { p_slug: u.slug, p_range: "7d" })).data, { timeout: 10_000 })
    .toMatchObject({ visitors: 1, files_opened: 1, files: [["Report.pdf", 1]] });
  await visitor.close();

  await page.goto("/portfolio");
  await page.locator(".eye-btn").click();
  const card = page.locator(".whosaw .card");
  await expect(card.getByRole("heading", { name: "Who saw your page" })).toBeVisible();
  await expect(card.locator(".big")).toHaveText("1");
  await expect(card.locator(".file")).toContainText("Report.pdf");
  await expect(card).toContainText("Your own visits are not counted.");
  await card.getByRole("button", { name: "30 days" }).click();
  await expect(card.locator(".overline").first()).toContainText("Visits per week");
  await page.keyboard.press("Escape");

  // delete the project: its documents go too, including the stored file
  const key = (await service().from("documents").select("object_key").eq("owner_id", u.id).eq("kind", "file").single()).data!.object_key;
  await page.getByRole("button", { name: "Delete Solar tracker" }).click();
  await expect(page.getByRole("alertdialog")).toContainText('"Solar tracker" and its 2 documents will be removed');
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByText("Your first project goes here.")).toBeVisible();
  expect((await service().from("documents").select("id").eq("owner_id", u.id)).data).toHaveLength(0);
  const gone = await page.request.get(`http://127.0.0.1:4569/projectcv-local/${key}`);
  expect(gone.status()).not.toBe(200);
});

test("people who are not signed in, or not admins, are kept out", async ({ page, context }) => {
  for (const path of ["/portfolio", "/setup", "/terms", "/admin", "/portfolio/preview"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/localhost:3000\/$/);
  }
  const u = await readyEditor("Not Admin");
  await signIn(context, u);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/portfolio$/);
  await page.locator(".pcv-avatar").click();
  await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);
});

test("sign out lands on See you soon with a link to the public page", async ({ page, context }) => {
  const u = await readyEditor("Leaving Soon");
  await signIn(context, u);
  await page.goto("/portfolio");
  await page.locator(".pcv-avatar").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "See you soon." })).toBeVisible();
  await page.getByRole("link", { name: "View my public page" }).click();
  await expect(page.locator(".cv-name")).toHaveText("Leaving Soon");
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test("the sign in button shows it is working while the browser leaves for Google", async ({ page }) => {
  // Playwright holds back every page query while a navigation is pending, and the click starts one, so the
  // page reports by itself (through an exposed function) the moment its button turns busy.
  let sawBusy = false;
  await page.exposeFunction("pcvSawBusy", () => { sawBusy = true; });
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const b = document.querySelector(".gsi-pill");
      if (b?.classList.contains("is-busy") && b.getAttribute("aria-busy") === "true") (window as unknown as { pcvSawBusy: () => void }).pcvSawBusy();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  await page.goto("/");
  await page.route("**/auth/v1/authorize**", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.fulfill({ status: 200, body: "ok" }); });
  const button = page.getByRole("button", { name: "Sign in with Google" });
  // the scripts may not have loaded yet, so click again until the button responds
  await expect(async () => {
    await button.click({ noWaitAfter: true });
    await expect.poll(() => sawBusy, { timeout: 1500 }).toBe(true);
  }).toPass({ timeout: 12_000 });
});

test("broken links and site errors show the friendly pages", async ({ page }) => {
  // an address that matches nothing (global 404), a removed portfolio, and a broken document link: real 404s, one look
  for (const path of ["/definitely-not-a-page", "/admin/not-a-page", "/d/not-a-uuid"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "This page went wandering." }), path).toBeVisible();
    await expect(page.getByRole("button", { name: "Say hi to the character" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Take me to the start" })).toHaveAttribute("href", "/");
  }
  // poking the character makes it talk
  await page.getByRole("button", { name: "Say hi to the character" }).click();
  await expect(page.locator(".oops-bubble.is-on")).not.toBeEmpty();
  // a failing page shows the error page with Try again
  await page.goto("/trouble");
  await expect(page.getByRole("heading", { name: "We dropped something." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("the sign in dome stays in place while the mouse moves", async ({ page }) => {
  // The pointer motion drifts the dome a few pixels; it must never lose its position (it once slid off behind the panel).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const center = async () => page.locator(".dome").evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
  const before = await center();
  await page.waitForTimeout(800); // the scripts need a moment to attach
  for (const [x, y] of [[40, 60], [1400, 840], [300, 450], [1100, 120]]) { await page.mouse.move(x, y, { steps: 6 }); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500); // the drift eases for over a second
  const after = await center();
  expect(Math.abs(after.x - before.x)).toBeLessThan(40);
  expect(Math.abs(after.y - before.y)).toBeLessThan(40);
  expect(Math.abs(after.x - 720)).toBeLessThan(40); // still centred on the page, half behind the panel
});

test("redirects stay on this site's own address (relative), whatever address the server sees", async ({ request }) => {
  // Behind Netlify the server sees a private per-deploy address; an absolute redirect would send people to another
  // domain, where their session cookie does not exist.
  const loc = async (method: "get" | "post", path: string) => (await request[method](path, { maxRedirects: 0 })).headers()["location"];
  expect(await loc("get", "/auth/callback")).toBe("/?blocked=failed");
  expect(await loc("get", "/auth/blocked?status=disabled")).toBe("/?blocked=disabled");
  expect(await loc("post", "/auth/signout")).toBe("/signed-out");
  expect(await loc("get", "/d/not-a-uuid")).toBe("/gone");
});

test("unknown pages and links 404 plainly", async ({ page }) => {
  // a real 404 status, not a 200 with a "not found" message (a loading screen above this page would turn it into one)
  const missing = await page.goto("/p/nobody-here");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page went wandering." })).toBeVisible();
  const r = await page.request.get("/d/00000000-0000-4000-8000-000000000000");
  expect(r.status()).toBe(404);
});
