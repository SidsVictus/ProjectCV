import { notFound } from "next/navigation";

// Any address that matches no page (including ones under /admin) lands here and gets the site's own 404 page, with a
// real 404 status. This is an ordinary route, so the page is rendered and scripted like every other page; the
// framework's separate "global" 404 skips the security policy's script nonce and could not run the character.
export const dynamic = "force-dynamic";

export default function Missing(): never {
  notFound();
}
