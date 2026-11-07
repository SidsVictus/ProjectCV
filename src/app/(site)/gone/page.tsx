import { notFound } from "next/navigation";

// Where a broken document link lands: the real 404 page, with a real 404 status. Rendered on request: a page that is
// built ahead of time would get the framework's plain 404 instead of the site's own.
export const dynamic = "force-dynamic";

export default function Gone(): never {
  notFound();
}
