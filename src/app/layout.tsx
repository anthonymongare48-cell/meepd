import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PDF Tools | meepdf",
    template: "%s | meepdf",
  },
  description: "Private browser-based PDF, document editing, conversion, and signing tools.",
  metadataBase: new URL(siteUrl || "http://localhost:3000"),
  applicationName: "meepdf",
  keywords: [
    "PDF tools",
    "edit PDF online",
    "merge PDF",
    "split PDF",
    "PDF converter",
    "OCR PDF",
    "sign PDF",
    "PDF editor",
    "Word editor",
    "spreadsheet editor",
  ],
  authors: [{ name: "meepdf" }],
  creator: "meepdf",
  publisher: "meepdf",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: siteUrl || undefined,
  },
  openGraph: {
    type: "website",
    siteName: "meepdf",
    title: "Private PDF Tools Online | meepdf",
    description: "Edit, convert, sign, organize, and protect PDFs privately in your browser.",
    images: [{ url: "/icon.svg", width: 64, height: 64, alt: "meepdf" }],
  },
  twitter: {
    card: "summary",
    title: "Private PDF Tools Online | meepdf",
    description: "Edit, convert, sign, organize, and protect PDFs privately in your browser.",
    images: ["/icon.svg"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
