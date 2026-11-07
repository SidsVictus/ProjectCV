import { SiteLoading } from "@/components/loading/SiteLoading";

// The fallback for every page in the site without a loading screen of its own (terms, read-only, legal, sign out).
export default function Loading() { return <SiteLoading variant="card" />; }
