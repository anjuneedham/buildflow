import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "BuildFlow — Run your construction business. Showcase your work. Win more jobs.", template: "%s · BuildFlow" },
  description: "BuildFlow helps construction professionals manage customers and projects, and gives them a public profile where customers can discover and hire them.",
  applicationName: "BuildFlow",
  openGraph: { type: "website", siteName: "BuildFlow", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "BuildFlow", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#1c2127",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
