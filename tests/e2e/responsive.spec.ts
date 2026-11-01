import { expect, test } from "@playwright/test";
import { readyEditor, service, signIn } from "./helpers";

// @mobile runs at 390px wide as well as desktop.
test("no horizontal scroll on the owner and public pages @mobile", async ({ page, context }) => {
  const u = await readyEditor("Phone Person", { org: "Osmania University", about: "Builds small robots and the apps that drive them." });
  await service().from("projects").insert({ owner_id: u.id, name: "Rover", timeline: "Jan to Mar 2026", description: "A six wheeled rover with a phone as its brain.", status: "done" });
  await signIn(context, u);
  for (const path of ["/portfolio", `/p/${u.slug}`, "/setup"]) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("sign in screen renders its five things @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Project CV" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Built it\?/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms & Conditions" })).toBeVisible();
});
