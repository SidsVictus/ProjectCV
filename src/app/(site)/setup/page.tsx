import { SetupForm } from "@/components/auth/SetupForm";
import { nextPath, requireProfile } from "@/lib/auth";

export default async function Setup() {
  const p = await requireProfile(["/setup", "/portfolio"]);
  const { full_name, headline, org, grad_year, location, about, linkedin, github, website } = p;
  return (
    <SetupForm editing={nextPath(p) === "/portfolio"} wallpaper={p.wallpaper} colours={{ ink: p.ink, glass: p.glass, line: p.line }}
      initial={{ full_name, headline, org, grad_year, location, about, linkedin, github, website }} />
  );
}
