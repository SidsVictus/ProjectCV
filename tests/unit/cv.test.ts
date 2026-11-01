import { describe, expect, it } from "vitest";
import { contrast, cvVars, domainOf, hexRgb, paneAlpha, profileView } from "@/lib/cv";
import { groupColleges, toPcvData, type Snapshot } from "@/lib/admin/pcvData";
import { linkSchema, profileSchema, styleSchema, uploadSchema } from "@/lib/validation";

const blank = { full_name: "", headline: "", org: "", grad_year: "", location: "", about: "", linkedin: "", github: "", website: "" };

describe("readability rule", () => {
  it("defaults reach 7:1 at the design's 66% opacity", () => {
    expect(paneAlpha("#141414", "#ffffff")).toBe(0.66);
  });
  it("every text tier on the chosen pane reaches 7:1 over black and white wallpapers", () => {
    const a = paneAlpha("#1d2a44", "#e9dcc4")!;
    for (const wall of [[0, 0, 0], [255, 255, 255]]) {
      const bg = hexRgb("#e9dcc4").map((v, i) => v * a + wall[i] * (1 - a));
      expect(contrast(hexRgb("#1d2a44"), bg)).toBeGreaterThanOrEqual(7);
    }
  });
  it("returns null when text and glass are too close, and the pane falls back to 90%", () => {
    expect(paneAlpha("#ffffff", "#f4ecdc")).toBeNull();
    expect(cvVars({ ink: "#ffffff", glass: "#f4ecdc", line: "#8a8a8a" })["--cv-pane"]).toBe("rgba(244, 236, 220, 0.9)");
  });
  it("light text gets dark on-ink and a dark halo", () => {
    expect(cvVars({ ink: "#ffffff", glass: "#0b0b14", line: "#ffffff" })["--cv-on-ink"]).toBe("#111111");
  });
});

describe("profile view", () => {
  it("builds the details line with middle-dot parts and a project count", () => {
    const v = profileView({ ...blank, full_name: "A", org: "CBIT", grad_year: "2028", location: "Hyderabad" }, 1);
    expect(v.meta).toEqual(["CBIT", "Class of 2028", "Hyderabad", "1 project"]);
  });
  it("normalises links to https and labels the website by its domain", () => {
    const v = profileView({ ...blank, linkedin: "https://linkedin.com/in/a/", website: "http://me.dev/work" }, null);
    expect(v.links).toEqual([{ label: "LinkedIn", href: "https://linkedin.com/in/a" }, { label: "me.dev", href: "https://me.dev/work" }]);
  });
  it("shows placeholders while the setup form is empty", () => {
    expect(profileView(blank, null)).toMatchObject({ name: "Your name", headline: "Your headline", meta: [] });
  });
  it("domainOf keeps only the host", () => expect(domainOf("https://github.com/a/b")).toBe("github.com"));
});

describe("validation", () => {
  it("needs a name and a headline", () => {
    expect(profileSchema.safeParse({ ...blank, headline: "x" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...blank, full_name: " A ", headline: "x" }).data?.full_name).toBe("A");
  });
  it("accepts a short year like '28, rejects over-long years and about lines", () => {
    expect(profileSchema.safeParse({ ...blank, full_name: "a", headline: "b", grad_year: "'28" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...blank, full_name: "a", headline: "b", grad_year: "x".repeat(11) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...blank, full_name: "a", headline: "b", about: "x".repeat(161) }).success).toBe(false);
  });
  it("links: adds https, refuses other schemes and hostless text", () => {
    expect(linkSchema.parse("drive.google.com/x")).toBe("https://drive.google.com/x");
    for (const bad of ["javascript:alert(1)", "ftp://x.y/z", "not a link", "http://localhost"]) {
      expect(linkSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
  it("styles: only catalogue ids and six-digit hex colours", () => {
    expect(styleSchema.safeParse({ wallpaper: "oak", ink: "#ABCDEF" }).data).toEqual({ wallpaper: "oak", ink: "#abcdef" });
    expect(styleSchema.safeParse({ wallpaper: "none" }).success).toBe(false);
    expect(styleSchema.safeParse({ ink: "red" }).success).toBe(false);
  });
  it("uploads: allowed types only, at most 5 GB", () => {
    const ok = { projectId: "6f1c7a1e-3a4b-4c5d-8e9f-0a1b2c3d4e5f", name: "a.pdf", mime: "application/pdf", size: 10 };
    expect(uploadSchema.safeParse(ok).success).toBe(true);
    expect(uploadSchema.safeParse({ ...ok, mime: "text/html" }).success).toBe(false);
    expect(uploadSchema.safeParse({ ...ok, size: 5 * 1024 ** 3 + 1 }).success).toBe(false);
    expect(uploadSchema.safeParse({ ...ok, size: 0 }).success).toBe(false);
  });
});

describe("admin data mapping", () => {
  it("groups colleges case-insensitively, keeps the commonest spelling, puts the rest in Other", () => {
    const users = [{ org: "CBIT" }, { org: "cbit " }, { org: "Cbit" }, { org: "Vasavi College of Engineering" }, { org: "" }];
    const { colleges, indexOf } = groupColleges(users);
    expect(colleges.map((c) => c.short)).toEqual(["CBIT", "Vasavi", "Other"]);
    expect(indexOf("  CBIT")).toBe(0);
    expect(indexOf("")).toBe(2);
    expect(indexOf("Unknown place")).toBe(2);
  });

  it("maps a snapshot to the dashboard's shape without inventing numbers", () => {
    const zeros = () => new Array(365).fill(0);
    const snap: Snapshot = {
      me: "Asha", me_id: "a", now: "2026-11-01T10:00:00Z", live_now: 2,
      users: [{
        id: "u1", name: "Ravi", email: "r@x.y", org: "CBIT", slug: "ravi", role: "editor", status: "on_hold", status_days: 3,
        signup_day: 5, last_active_day: 1, wallpaper: "deco", table_style: "index", ink: "#1D2A44", glass: "#123456",
        projects: 2, documents: 1, links: 1, visitors: 7, avg_view_sec: 30, files_opened: 2, edit_min: 4.5, sessions: 3,
        visitors_r: { 7: 1, 30: 5, 90: 7 }, files_r: { 7: 0, 30: 1, 90: 2 },
      }],
      daily: { signups: zeros(), page_views: zeros(), visitors: zeros(), active_editors: zeros(), projects_added: zeros(), docs_uploaded: zeros(), links_attached: zeros(), edit_minutes: zeros(), files_opened: zeros(), view_seconds: zeros() },
      cohorts: [{ start: "2026-10-26", size: 1, values: [100, null] }],
      retention: { d1: 0, d7: 0, d30: 0, prev: { d1: 0, d7: 0, d30: 0 } },
      heat: [], files: [], audit: [{ who: "Asha", text: "put Ravi on hold", minutes: 4 }], feed: [],
    };
    const d = toPcvData(snap);
    expect(d.users[0]).toMatchObject({ role: "Editor", status: "On hold", college: 0, statusDays: 3, visitorsR: { 30: 5 } });
    expect(d.WALLPAPERS[d.users[0].wallpaper].id).toBe("deco");
    expect(d.TABLE_STYLES[d.users[0].tableStyle].id).toBe("index");
    expect(d.TEXT_COLOURS[d.users[0].textColour].name).toBe("Midnight");
    expect(d.GLASS_COLOURS[d.users[0].glassColour].name).toBe("Custom");
    expect(d.AUDIT).toEqual([{ who: "Asha", text: "put Ravi on hold", when: 4 }]);
    expect(d.cohorts[0].label).toBe("26 Oct");
    expect(d.WALLPAPERS.every((w) => typeof w.css === "string" && w.css.length > 10)).toBe(true);
  });
});
