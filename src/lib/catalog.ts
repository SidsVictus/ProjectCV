// The catalogue of wallpapers, table styles and colour swatches (public.catalog), as the site uses it.
// Built-in wallpapers and tables are designed in CSS (.wp-<id>, .tbl-<id>); custom wallpapers are
// uploaded images served from /w/<id>; custom tables are a built-in design with their own colours.

import { TABLES, lum, rgba } from "./cv";

export type Wallpaper = { id: string; name: string; hidden: boolean; custom: boolean };
export type TableStyle = {
  id: string; name: string; desc: string; hidden: boolean;
  base: string; colours: { header: string; rule: string; band: string } | null;
};
export type Swatch = { name: string; hex: string; hidden: boolean };
export type Catalog = { wallpapers: Wallpaper[]; tables: TableStyle[]; ink: Swatch[]; glass: Swatch[]; line: Swatch[] };

export type CatalogRow = {
  kind: "wallpaper" | "table" | "ink" | "glass" | "line"; id: string; name: string; builtin: boolean; hidden: boolean;
  ready: boolean; base: string | null; header: string | null; rule: string | null; band: string | null; hex: string | null;
};

export const CATALOG_COLUMNS = "kind,id,name,builtin,hidden,ready,base,header,rule,band,hex";

export function toCatalog(rows: CatalogRow[]): Catalog {
  const ready = rows.filter((r) => r.ready);
  const of = (k: CatalogRow["kind"]) => ready.filter((r) => r.kind === k);
  const desc = (id: string) => TABLES.find((t) => t.id === id)?.desc ?? "";
  return {
    wallpapers: of("wallpaper").map((r) => ({ id: r.id, name: r.name, hidden: r.hidden, custom: !r.builtin })),
    tables: of("table").map((r) => r.builtin
      ? { id: r.id, name: r.name, desc: desc(r.id), hidden: r.hidden, base: r.id, colours: null }
      : { id: r.id, name: r.name, desc: `${TABLES.find((t) => t.id === r.base)?.name ?? "Custom"} in its own colours.`, hidden: r.hidden,
          base: r.base!, colours: { header: r.header!, rule: r.rule!, band: r.band! } }),
    ink: of("ink").map((r) => ({ name: r.name, hex: r.hex!, hidden: r.hidden })),
    glass: of("glass").map((r) => ({ name: r.name, hex: r.hex!, hidden: r.hidden })),
    line: of("line").map((r) => ({ name: r.name, hex: r.hex!, hidden: r.hidden })),
  };
}

/** What a picker offers: everything not hidden, plus the one in use even if it was hidden since. */
export const offered = <T extends { hidden: boolean }>(list: T[], isCurrent: (x: T) => boolean) =>
  list.filter((x) => !x.hidden || isCurrent(x));

/** Class and style that paint a wallpaper. Unknown ids get the plain .wp background. */
export function wallpaperLook(id: string, cat: Catalog, extra = ""): { className: string; style: React.CSSProperties } {
  const w = cat.wallpapers.find((x) => x.id === id);
  const className = `wp ${extra} ${w && !w.custom ? `wp-${id}` : ""}`.replace(/\s+/g, " ").trim();
  return { className, style: w?.custom ? { backgroundImage: `url("/w/${encodeURIComponent(id)}")` } : {} };
}

/** Class and colour overrides for a table style. Custom tables keep their base design's layout. */
export function tableLook(id: string, cat: Catalog) {
  const t = cat.tables.find((x) => x.id === id) ?? cat.tables.find((x) => x.id === "ledger");
  const c = t?.colours;
  return {
    base: t?.base ?? "ledger",
    style: (c ? { "--cv-line": rgba(c.rule, 0.9), "--cv-tint": rgba(c.band, 0.3) } : {}) as React.CSSProperties,
    headStyle: (c ? { "--cv-ink": c.header, "--cv-on-ink": lum(c.header) < 0.4 ? "#ffffff" : "#111111" } : {}) as React.CSSProperties,
  };
}
