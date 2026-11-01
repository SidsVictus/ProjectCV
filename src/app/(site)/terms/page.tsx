import { AuthScreen } from "@/components/auth/AuthScreen";
import { TermsForm } from "@/components/auth/TermsForm";
import { requireProfile } from "@/lib/auth";

export default async function Terms() {
  const p = await requireProfile(["/terms"]);
  return (
    <AuthScreen label="Accept terms" title="One last step." sub={`Signed in as ${p.email}. Please accept our terms to create your page.`} legal="You only see this once.">
      <TermsForm />
    </AuthScreen>
  );
}
