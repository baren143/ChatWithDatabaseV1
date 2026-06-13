import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = "https://chat-with-db.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ChatWithDB — Talk to Your Documents & Databases Using AI",
    template: "%s | ChatWithDB",
  },
  description:
    "Upload PDFs, CSVs, and Excel files or query databases using natural language. Get instant AI-powered answers with precise citations. RAG-powered document chat.",
  keywords: [
    "AI document chat",
    "chat with database",
    "RAG chatbot",
    "natural language SQL",
    "AI-powered document search",
    "chat with CSV",
    "vector search database",
    "AI data analysis",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ChatWithDB",
    title: "ChatWithDB — Talk to Your Documents & Databases Using AI",
    description:
      "Upload PDFs, CSVs, and Excel files or query databases using natural language. Get instant AI-powered answers with precise citations.",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ChatWithDB - AI-powered document and database chat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatWithDB — Talk to Your Documents & Databases Using AI",
    description:
      "Upload PDFs, CSVs, and Excel files or query databases using natural language. Get instant AI-powered answers with precise citations.",
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "", // Add your Google Search Console verification code
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={plusJakartaSans.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
