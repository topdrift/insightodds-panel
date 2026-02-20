import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthGuard from "@/components/layout/AuthGuard";
import { ToastContainer } from "@/components/ui/toast";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "InsightOdds - Cricket Betting Panel",
  description: "InsightOdds Whitelabel Cricket Betting Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} font-sans antialiased min-h-screen`}
        style={{ background: 'var(--gradient-bg)', backgroundAttachment: 'fixed' }}
      >
        <AuthGuard>
          {children}
        </AuthGuard>
        <ToastContainer />
      </body>
    </html>
  );
}
