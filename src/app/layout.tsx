import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import BackToTopButton from "@/components/BackToTopButton";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Liminal HQ | Independent Digital Studio",
  description: "Digital tools for the spaces in between. An independent studio building local-first applications.",
  openGraph: {
    title: "Liminal HQ | Independent Digital Studio",
    description: "Digital tools for the spaces in between. An independent studio building local-first applications.",
    url: siteUrl,
    siteName: "Liminal HQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Liminal HQ | Independent Digital Studio",
    description: "Digital tools for the spaces in between. An independent studio building local-first applications.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <div className="ambient-light"></div>
        {children}
        <BackToTopButton />
      </body>
    </html>
  );
}
