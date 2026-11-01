import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/bundle.css";
import "@/styles/prototype.css";
import "@/styles/tables.css";

export const metadata: Metadata = {
  title: "Project CV",
  description: "Add every project you have built, attach the proof, and share your page with anyone.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#020105" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Google's sign-in button uses Roboto Medium, as Google's brand rules require. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap" rel="stylesheet" />
        {children}
      </body>
    </html>
  );
}
