import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrabsMcChaffey Mohs Recon Dojo",
  description: "Interactive facial Mohs reconstruction drills"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
