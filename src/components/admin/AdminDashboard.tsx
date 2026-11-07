"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  catalogAddColour, catalogAddTable, catalogFinishWallpaper, catalogSetHidden, catalogStartWallpaper,
  deleteAccount, invite, liveNow, logAction, saveAccount,
} from "@/app/actions/admin";
import type { Catalog } from "@/lib/catalog";
import { toPcvData, type Snapshot } from "@/lib/admin/pcvData";
import { createClient } from "@/lib/supabase/client";
import markup from "@/legacy/admin/markup";
import { AdminLoading } from "./AdminLoading";

declare global {
  interface Window { THREE?: typeof THREE; PCV_DATA?: unknown; PCV_API?: unknown; PCV_BOOTED?: boolean }
}

/**
 * Runs the Super Admin dashboard as supplied: its markup, then charts.js, scenes.js and app.js,
 * with three r128 from npm as the THREE global and real data in PCV_DATA (DECISIONS.md D1, D2).
 */
export function AdminDashboard({ snapshot, catalog }: { snapshot: Snapshot; catalog: Catalog }) {
  const root = useRef<HTMLDivElement>(null);
  // The loading screen covers the page until the scripts have drawn the sky and charts, then fades out.
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.PCV_BOOTED);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setGone(true), 700);
    return () => clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    if (window.PCV_BOOTED) return; // the scripts wire the DOM once per page load
    window.PCV_BOOTED = true;
    const supabase = createClient();
    window.THREE = THREE;
    window.PCV_DATA = toPcvData(snapshot, catalog);
    window.PCV_API = {
      saveAccount, deleteAccount, invite, liveNow, log: logAction,
      catalog: {
        addTable: catalogAddTable, addColour: catalogAddColour, setHidden: catalogSetHidden,
        /** Reserve, upload straight to R2, then let the server check it landed. */
        async addWallpaper(name: string, file: File) {
          const s = await catalogStartWallpaper({ name, mime: file.type, size: file.size });
          if (!s.ok) return s;
          await fetch(s.data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } }).catch(() => null);
          const f = await catalogFinishWallpaper(s.data.id);
          return f.ok ? { ok: true as const, data: { id: s.data.id } } : f;
        },
      },
      subscribe(cb: (ev: { kind: string; user_id: string; detail: string; at: string }) => void) {
        supabase.channel("admin_live")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, (msg) => cb(msg.new as never))
          .subscribe();
      },
    };
    (async () => {
      try {
        await import("@/legacy/admin/charts.js");
        await import("@/legacy/admin/scenes.js");
        await import("@/legacy/admin/app.js");
      } catch (e) {
        console.error("admin dashboard scripts", e); // show whatever drew rather than keep the loading screen forever
      } finally {
        requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
      }
    })();
  }, [snapshot, catalog]);
  return (
    <>
      <div ref={root} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />
      {!gone && <AdminLoading leaving={ready} />}
    </>
  );
}
