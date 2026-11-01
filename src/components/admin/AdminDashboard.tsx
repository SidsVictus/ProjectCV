"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { deleteAccount, invite, liveNow, logAction, saveAccount } from "@/app/actions/admin";
import { toPcvData, type Snapshot } from "@/lib/admin/pcvData";
import { createClient } from "@/lib/supabase/client";
import markup from "@/legacy/admin/markup";

declare global {
  interface Window { THREE?: typeof THREE; PCV_DATA?: unknown; PCV_API?: unknown; PCV_BOOTED?: boolean }
}

/**
 * Runs the Super Admin dashboard as supplied: its markup, then charts.js, scenes.js and app.js,
 * with three r128 from npm as the THREE global and real data in PCV_DATA (DECISIONS.md D1, D2).
 */
export function AdminDashboard({ snapshot }: { snapshot: Snapshot }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.PCV_BOOTED) return; // the scripts wire the DOM once per page load
    window.PCV_BOOTED = true;
    const supabase = createClient();
    window.THREE = THREE;
    window.PCV_DATA = toPcvData(snapshot);
    window.PCV_API = {
      saveAccount, deleteAccount, invite, liveNow, log: logAction,
      subscribe(cb: (ev: { kind: string; user_id: string; detail: string; at: string }) => void) {
        supabase.channel("admin_live")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, (msg) => cb(msg.new as never))
          .subscribe();
      },
    };
    (async () => {
      await import("@/legacy/admin/charts.js");
      await import("@/legacy/admin/scenes.js");
      await import("@/legacy/admin/app.js");
    })();
  }, [snapshot]);
  return <div ref={root} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />;
}
