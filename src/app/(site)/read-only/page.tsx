import { AuthScreen, LegalLine } from "@/components/auth/AuthScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireProfile } from "@/lib/auth";

export default async function ReadOnly() {
  await requireProfile(["/read-only"]);
  return (
    <AuthScreen label="View only account" title="You can view pages." sub="Your account is set to view only, so you cannot make a portfolio. Open any Project CV link you are sent to see that page." legal={<LegalLine />}>
      <div className="pcv-auth__actions"><SignOutButton className="pcv-btn pcv-btn--secondary" /></div>
    </AuthScreen>
  );
}
