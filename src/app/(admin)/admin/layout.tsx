import type { Metadata, Viewport } from "next";
import "@/legacy/admin/styles.css";

export const metadata: Metadata = { title: "Admin dashboard · Project CV", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#020105" };

// Its own root layout: the dashboard's stylesheet must not meet the portfolio styles (DECISIONS.md D1).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
