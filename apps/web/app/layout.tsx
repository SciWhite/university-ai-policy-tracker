import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "University AI Policy Tracker",
  description:
    "Source-backed university AI policy changes, historical snapshots, and public reports."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
