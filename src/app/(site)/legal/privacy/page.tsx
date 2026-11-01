import { H, LegalPage } from "@/components/auth/LegalPage";

export const metadata = { title: "Privacy policy · Project CV" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="1 November 2026">
      <p>This page says what Project CV stores, why, and who can see it.</p>
      <H>What we store</H>
      <p>From Google: your name and email address. From you: the details, projects, links and files you add, and your page style. When you edit: when your editing sessions start and end. When someone opens a page: a random visitor code kept in a cookie on their device, when they visited, how long the page stayed open and which documents they opened. We do not store visitors&apos; names, emails or IP addresses.</p>
      <H>Who can see it</H>
      <p>Anyone with your link sees your page, your documents and its visitor counts. Your email is never shown on your page. Project CV administrators can see account details and platform wide statistics to run the service.</p>
      <H>Where it lives</H>
      <p>Account data is stored with Supabase and files with Cloudflare R2. Files are private and open only through short lived links from your page.</p>
      <H>Your choices</H>
      <p>You can edit or delete any project or document at any time. To delete your whole account, contact a Project CV administrator.</p>
    </LegalPage>
  );
}
