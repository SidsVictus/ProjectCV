import Link from "next/link";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default function NotFound() {
  return (
    <AuthScreen label="Not found" title="Nothing here." sub="This link does not lead to a page. Check it with the person who sent it." legal="Project CV">
      <div className="pcv-auth__actions"><Link className="pcv-btn pcv-btn--primary" href="/">Create one for yourself</Link></div>
    </AuthScreen>
  );
}
