import { SetupForm } from "@/components/auth/SetupForm";
import { nextPath, requireProfile } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog-server";

export default async function Setup() {
  const p = await requireProfile(["/setup", "/portfolio"]);
  const { full_name, headline, org, grad_year, location, about, linkedin, github, website } = p;
  return (
    <SetupForm editing={nextPath(p) === "/portfolio"} wallpaper={p.wallpaper} catalog={await getCatalog()} colours={{ ink: p.ink, glass: p.glass, line: p.line, pane: Number(p.pane ?? 0.8) }}
      initial={{ full_name, headline, org, grad_year, location, about, linkedin, github, website }} />
  );
}
