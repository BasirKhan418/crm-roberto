import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { Toaster } from "@/components/ui/sonner";
import "driver.js/dist/driver.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteName = "CRM Roberto";
const defaultTitle = "CRM Roberto | Executive CRM Platform";
const defaultDescription =
  "CRM Roberto helps teams manage clients, suppliers, notes, follow-ups, and operational context in one place.";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | CRM Roberto",
  },
  description: defaultDescription,
  applicationName: siteName,
  referrer: "origin-when-cross-origin",
  keywords: [
    "CRM",
    "client management",
    "supplier management",
    "follow-up tracking",
    "business notes",
    "executive crm",
  ],
  authors: [{ name: "CRM Roberto Team" }],
  creator: "CRM Roberto Team",
  publisher: "CRM Roberto",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      fr: "/",
    },
  },
  category: "business",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["fr_FR"],
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CRM Roberto - Executive CRM Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${roboto.variable} h-full min-h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden">
        <AppProviders>
          {children}
          <Toaster position="top-right" richColors />
        </AppProviders>
      </body>
    </html>
  );
}
