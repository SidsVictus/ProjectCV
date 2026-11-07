"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error/ErrorScreen";

// The last safety net: the site's layout itself failed. It replaces the whole document, so it brings its own styles.
export default function GlobalError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en">
      <head><title>Something went wrong · Project CV</title></head>
      <body><ErrorScreen mood="oops" plain retry={retry ?? reset} digest={error?.digest} /></body>
    </html>
  );
}
