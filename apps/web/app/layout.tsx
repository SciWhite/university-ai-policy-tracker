import "./globals.css";

export const metadata = {
  title: "University AI Policy Tracker",
  description:
    "Source-backed university AI policy changes, historical snapshots, and public reports."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
