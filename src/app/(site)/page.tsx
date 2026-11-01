import { redirect } from "next/navigation";
import { AuthScreen, LegalLine } from "@/components/auth/AuthScreen";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { getProfile, nextPath } from "@/lib/auth";

const BLOCKED: Record<string, string> = {
  on_hold: "Your account is on hold, so you cannot sign in for now. Your page is still live for anyone with your link.",
  disabled: "Your account has been disabled, so you cannot sign in.",
  failed: "That sign in did not finish. Please try again.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const p = await getProfile();
  if (p) redirect(nextPath(p));
  const { blocked } = await searchParams;
  return (
    <AuthScreen label="Sign in" title={<>Built it?<br />Show it off.</>}
      sub={blocked && BLOCKED[blocked] ? BLOCKED[blocked] : "Add every project you have built, from code to circuits to canvas, attach the proof, and share your page with anyone."}
      legal={<LegalLine />}>
      <div className="pcv-auth__actions"><GoogleButton /></div>
    </AuthScreen>
  );
}
