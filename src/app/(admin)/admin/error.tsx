"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function AdminError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <ErrorScreen mood="oops" retry={retry ?? reset} digest={error?.digest} />;
}
