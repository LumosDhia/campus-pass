import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusPass — Student Passport",
  description: "Public student passport: enrollment status and verified achievements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
