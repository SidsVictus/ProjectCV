// Turns admin_snapshot() into the window.PCV_DATA shape the Super Admin dashboard reads.
// Every number comes from the database, and so do the wallpapers, table styles and colour
// swatches (public.catalog, managed from section 05).
import type { Catalog } from "@/lib/catalog";
import { TABLES, hexRgb } from "@/lib/cv";
import { WALLPAPER_CSS } from "./wallpaperCss";

type Range3 = { "7": number; "30": number; "90": number };
export type SnapshotUser = {
  id: string; name: string; email: string; org: string; slug: string | null;
  role: "super_admin" | "editor" | "viewer"; status: "active" | "on_hold" | "disabled";
  status_days: number; signup_day: number; last_active_day: number;
  wallpaper: string; table_style: string; ink: string; glass: string;
  projects: number; documents: number; links: number; visitors: number; avg_view_sec: number;
  files_opened: number; edit_min: number; sessions: number; visitors_r: Range3; files_r: Range3;
};
export type Snapshot = {
  me: string; me_id: string; now: string; live_now: number; users: SnapshotUser[];
  daily: Record<"signups" | "page_views" | "visitors" | "active_editors" | "projects_added" | "docs_uploaded" | "links_attached" | "edit_minutes" | "files_opened" | "view_seconds", number[]>;
  cohorts: { start: string; size: number; values: (number | null)[] }[];
  retention: { d1: number; d7: number; d30: number; prev: { d1: number; d7: number; d30: number } };
  heat: number[][];
  files: { name: string; opens: { all: number; "7": number; "30": number; "90": number } }[];
  audit: { who: string; text: string; minutes: number }[];
  feed: { kind: string; user_id: string; detail: string; at: string }[];
};

const ROLE = { super_admin: "Super admin", editor: "Editor", viewer: "Viewer" } as const;
const STATUS = { active: "Active", on_hold: "On hold", disabled: "Disabled" } as const;
export const ROLE_ID = { "Super admin": "super_admin", Editor: "editor", Viewer: "viewer" } as const;
export const STATUS_ID = { Active: "active", "On hold": "on_hold", Disabled: "disabled" } as const;
const MAX_COLLEGES = 10;

/** Colleges come from the free-text "College or organisation" field: the 10 largest, then "Other". */
export function groupColleges(users: { org: string }[]) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const u of users) {
    const k = norm(u.org);
    if (!k) continue;
    const g = groups.get(k) ?? { count: 0, spellings: new Map() };
    g.count++; g.spellings.set(u.org.trim(), (g.spellings.get(u.org.trim()) ?? 0) + 1);
    groups.set(k, g);
  }
  const top = [...groups.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, MAX_COLLEGES);
  const list = top.map(([key, g]) => {
    const name = [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { key, name, short: name.length <= 12 ? name : name.split(" ")[0] };
  });
  const index = new Map(list.map((c, i) => [c.key, i]));
  const colleges = list.map(({ name, short }) => ({ name, short })).concat({ name: "Other organisations", short: "Other" });
  return { colleges, indexOf: (org: string) => index.get(norm(org)) ?? colleges.length - 1 };
}

/** Deterministic random numbers for star placement only (layout, not data). */
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgbaHalf = (hex: string) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},0.5)`; };

export function toPcvData(s: Snapshot, cat: Catalog) {
  const { colleges, indexOf } = groupColleges(s.users);
  const WALL = cat.wallpapers.map((w) => ({
    id: w.id, name: w.name, hidden: w.hidden, custom: w.custom,
    css: w.custom ? `url("/w/${w.id}") center / cover no-repeat #8a8170` : WALLPAPER_CSS[w.id] ?? "#8a8170",
  }));
  const TABLE_STYLES = cat.tables.map((t) => ({ id: t.id, name: t.name, hidden: t.hidden, base: t.base, colours: t.colours }));
  const TEXT_COLOURS: { name: string; hex: string; hidden?: boolean }[] = [...cat.ink.map(({ name, hex, hidden }) => ({ name, hex, hidden })), { name: "Custom", hex: "#8e9c4e" }];
  const GLASS_COLOURS: { name: string; hex: string; solid: string; hidden?: boolean }[] = [...cat.glass.map(({ name, hex, hidden }) => ({ name, hex: rgbaHalf(hex), solid: hex, hidden })), { name: "Custom", hex: rgbaHalf("#8e9c4e"), solid: "#8e9c4e" }];
  const LINE_COLOURS = cat.line.map(({ name, hex, hidden }) => ({ name, hex, hidden }));
  const TABLE_BASES = TABLES.map((t) => ({ id: t.id, name: t.name }));
  const idx = <T,>(list: readonly T[], pred: (x: T) => boolean) => { const i = list.findIndex(pred); return i < 0 ? list.length - 1 : i; };
  const lower = (h: string) => h.toLowerCase();

  const users = s.users.map((u) => ({
    id: u.id, name: u.name, email: u.email, college: indexOf(u.org), role: ROLE[u.role], status: STATUS[u.status],
    projects: u.projects, documents: u.documents, links: u.links, visitors: u.visitors, visitorsR: u.visitors_r,
    filesR: u.files_r, avgViewSec: Number(u.avg_view_sec), filesOpened: u.files_opened, signupDay: u.signup_day,
    lastActive: u.last_active_day, statusDays: u.status_days, editMin: Number(u.edit_min), sessions: u.sessions,
    wallpaper: Math.max(0, WALL.findIndex((w) => w.id === u.wallpaper)),
    tableStyle: Math.max(0, TABLE_STYLES.findIndex((t) => t.id === u.table_style)),
    textColour: idx(TEXT_COLOURS, (c) => lower(c.hex) === lower(u.ink)),
    glassColour: idx(GLASS_COLOURS, (c) => lower(c.solid) === lower(u.glass)),
  }));

  const d = s.daily;
  return {
    DAYS: 365, COLLEGES: colleges, WALLPAPERS: WALL, TABLE_STYLES, TEXT_COLOURS, GLASS_COLOURS, LINE_COLOURS, TABLE_BASES,
    FILES: s.files,
    AUDIT: s.audit.map((a) => ({ who: a.who, text: a.text, when: a.minutes })),
    users,
    daily: {
      signups: d.signups, pageViews: d.page_views, visitorsDaily: d.visitors, activeEditors: d.active_editors,
      projectsAdded: d.projects_added, docsUploaded: d.docs_uploaded, linksAttached: d.links_attached,
      editMinutes: d.edit_minutes, filesOpened: d.files_opened, viewSeconds: d.view_seconds,
    },
    cohorts: s.cohorts.map((c) => ({
      label: new Date(c.start + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      size: c.size, values: c.values,
    })),
    heat: s.heat, retention: s.retention, now: new Date(s.now),
    me: s.me, meId: s.me_id, liveNow: s.live_now, feed: s.feed,
    rnd: seeded(20261101),
  };
}

export type PcvData = ReturnType<typeof toPcvData>;
