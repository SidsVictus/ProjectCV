// Catalogues and page logic from the design system prototype (prototype/Main.dc.html).

export const TABLES = [
  { id: "ledger", name: "Ledger", desc: "Every cell ruled, a quiet header band." },
  { id: "stripe", name: "Silk stripe", desc: "Soft alternating bands, one strong rule." },
  { id: "spot", name: "Spotlight", desc: "A solid header bar, hairline rows." },
  { id: "lead", name: "Lead column", desc: "Project names held in a tinted band." },
  { id: "float", name: "Float", desc: "Each project its own rounded row." },
  { id: "frame", name: "Frame", desc: "One fine outline and lots of air." },
  { id: "index", name: "Index", desc: "Numbered rows in large italic numerals." },
  { id: "blueprint", name: "Blueprint", desc: "Dashed rules on a dotted drafting grid." },
] as const;

export const DEFAULT_COLOURS = { ink: "#141414", glass: "#ffffff", line: "#8a8a8a" };

export type TableId = (typeof TABLES)[number]["id"];
export type Colours = { ink: string; glass: string; line: string };

const READ = { targets: [7, 4.5], tiers: [1, 0.96, 0.93], minPane: 0.5, maxPane: 0.9 };

export function hexRgb(h: string): [number, number, number] {
  let s = String(h || "#000000").replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(h: string, a: number): string {
  const c = hexRgb(h);
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function luminance(c: number[]): number {
  const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

export function contrast(a: number[], b: number[]): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const lum = (h: string) => luminance(hexRgb(h));

/**
 * Readability rule (DESIGN.md section 14): the lowest pane opacity at which every text tier reaches
 * 7:1 (falling back to 4.5:1) even over a pure black or pure white wallpaper. Null when none can.
 */
export function paneAlpha(ink: string, glass: string): number | null {
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i] * (1 - t));
  const I = hexRgb(ink), G = hexRgb(glass);
  for (const target of READ.targets) {
    for (let a = READ.minPane; a <= READ.maxPane + 1e-9; a += 0.02) {
      const ok = [[0, 0, 0], [255, 255, 255]].every((w) => {
        const bg = mix(G, w, a);
        return READ.tiers.every((t) => contrast(mix(I, bg, t), bg) >= target);
      });
      if (ok) return +a.toFixed(2);
    }
  }
  return null;
}

/** The --cv-* variables for the pane, from the owner's three colours. */
export function cvVars({ ink, glass, line }: Colours): Record<string, string> {
  const darkInk = lum(ink) < 0.4;
  const a = paneAlpha(ink, glass);
  return {
    "--cv-ink": ink,
    "--cv-ink-soft": rgba(ink, READ.tiers[1]),
    "--cv-ink-faint": rgba(ink, READ.tiers[2]),
    "--cv-line": rgba(line, 0.9),
    "--cv-pane": rgba(glass, a === null ? READ.maxPane : a),
    "--cv-tint": rgba(ink, 0.06),
    "--cv-sheen": darkInk ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.04)",
    "--cv-on-ink": darkInk ? "#ffffff" : "#111111",
    "--cv-halo": darkInk ? "rgba(255, 255, 255, 0.75)" : "rgba(0, 0, 0, 0.6)",
  };
}

export type ProfileFields = {
  full_name: string; headline: string; org: string; grad_year: string; location: string; about: string;
  linkedin: string; github: string; website: string;
};

const clean = (u: string) => String(u).replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Header of the CV: name, headline, details line, about and link chips. */
export function profileView(p: ProfileFields, count: number | null) {
  const meta: string[] = [];
  if (p.org) meta.push(p.org);
  if (p.grad_year) meta.push("Class of " + p.grad_year);
  if (p.location) meta.push(p.location);
  if (count !== null) meta.push(count === 1 ? "1 project" : count + " projects");
  const links: { label: string; href: string }[] = [];
  if (p.linkedin) links.push({ label: "LinkedIn", href: "https://" + clean(p.linkedin) });
  if (p.github) links.push({ label: "GitHub", href: "https://" + clean(p.github) });
  if (p.website) links.push({ label: clean(p.website).split("/")[0], href: "https://" + clean(p.website) });
  return { name: p.full_name || "Your name", headline: p.headline || "Your headline", meta, about: p.about, links };
}

/** "github.com" from "https://github.com/me/repo". */
export const domainOf = (t: string) => String(t).replace(/^https?:\/\//, "").split("/")[0] || "link";
