import { AuthScreen, LegalLine } from "@/components/auth/AuthScreen";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default async function SignedOut({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const slug = page && /^[a-z0-9-]{1,64}$/.test(page) ? page : null;
  return (
    <AuthScreen label="Signed out" title="See you soon." sub="Your page stays live. Anyone with your link can still view it." legal={<LegalLine />}>
      <div className="pcv-auth__actions">
        <GoogleButton />
        {slug && (
          <a className="pcv-btn pcv-btn--ghost" href={`/p/${slug}`}>
            <svg className="pcv-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>View my public page
          </a>
        )}
      </div>
    </AuthScreen>
  );
}
