import "server-only";

import { cache } from "react";
import { CATALOG_COLUMNS, toCatalog, type Catalog, type CatalogRow } from "./catalog";
import { createClient } from "./supabase/server";

/** The catalogue for this request, in the admins' order. */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const { data, error } = await (await createClient()).from("catalog").select(CATALOG_COLUMNS).order("sort");
  if (error || !data) throw new Error("The style catalogue could not load.");
  return toCatalog(data as CatalogRow[]);
});
