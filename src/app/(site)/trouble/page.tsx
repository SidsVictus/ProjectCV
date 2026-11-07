// Where a document link lands when storage is down: it fails on purpose, so the site's error page (with Try again) shows.
export const dynamic = "force-dynamic";

export default function Trouble(): never {
  throw new Error("Document storage is not available right now");
}
