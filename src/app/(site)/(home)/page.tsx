/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { LegalLine } from "@/components/auth/AuthScreen";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SigninMotion } from "@/components/auth/SigninMotion";
import { getProfile, nextPath } from "@/lib/auth";
import "./signin.css";

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
    <main className="dome-signin" aria-label="Sign in">
      {/* The dome turns slowly on the page centre; its right half passes behind the glass panel. */}
      <SigninMotion />
      <div className="dome" aria-hidden="true"><div className="dome__disc" /></div>
      <section className="dome-panel">
        <div className="dome-card">
          <span className="dome-card__mark"><img src="/brand/logo-mark-filled.png" alt="Project CV" /></span>
          <h1 className="dome-card__title">Let your work<br />speak for you.</h1>
          {blocked && BLOCKED[blocked] && <p className="dome-card__sub" role="alert">{BLOCKED[blocked]}</p>}
          <div className="dome-card__rule"><span>Sign in to continue</span></div>
          <GoogleButton variant="pill" />
          <p className="dome-card__legal"><LegalLine /></p>
        </div>
      </section>
    </main>
  );
}
