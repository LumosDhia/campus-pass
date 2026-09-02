import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusPass — Student Affairs Portal",
  description: "Enroll students, issue campus credentials, log verified achievements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
