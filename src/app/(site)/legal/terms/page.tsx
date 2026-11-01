import { H, LegalPage } from "@/components/auth/LegalPage";

export const metadata = { title: "Terms and conditions · Project CV" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions" updated="1 November 2026">
      <p>Project CV lets you build one page that lists the projects you have made and share it as a read-only link. By signing in you agree to these terms.</p>
      <H>Your account</H>
      <p>You sign in with your Google account. Keep it secure; anything done while signed in to your Project CV account is your responsibility.</p>
      <H>Your page and files</H>
      <p>You own what you add. You give Project CV permission to store it and to show it to anyone who opens your link. Only add work and documents you have the right to share. Anyone with your link can view your page and open the documents you attach.</p>
      <H>Fair use</H>
      <p>Do not upload anything unlawful, harmful or that belongs to someone else without permission, and do not try to reach other people&apos;s accounts or data.</p>
      <H>Account status</H>
      <p>We may put an account on hold or disable it if these terms are broken. On hold stops sign in while keeping your page live. Disabled stops sign in and takes your page offline. An administrator can delete an account, which removes its page, projects and documents.</p>
      <H>Changes</H>
      <p>We may update these terms. If the changes matter, we will tell you the next time you sign in.</p>
    </LegalPage>
  );
}
