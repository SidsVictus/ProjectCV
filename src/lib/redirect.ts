import { NextResponse } from "next/server";

/**
 * A redirect to a path on this same site, sent as a relative address.
 * Do not build redirects from `request.url`: behind Netlify that is the deploy's private address
 * (`<id>--site.netlify.app`), so an absolute redirect would send visitors to another domain, where the
 * session cookie does not exist, and where visitors may be asked for a Netlify login.
 */
export function redirectTo(path: string, status: 302 | 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("redirectTo only takes a path on this site");
  return new NextResponse(null, { status, headers: { Location: path } });
}
