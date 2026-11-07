"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error/ErrorScreen";

// A page in the site failed while loading. The visitor can retry without leaving.
export default function SiteError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorScreen mood="oops" retry={retry ?? reset} digest={error?.digest} />;
}
