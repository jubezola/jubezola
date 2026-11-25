import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import "./globals.css";
import { SITE, siteUrl } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});
const figtree = Figtree({ subsets: ["latin"], display: "swap", variable: "--font-figtree" });

const title = "Iguarias no Ponto · Comida caseira e take-away em Coimbra";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: SITE.name,
    title,
    description: SITE.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description: SITE.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1f1813",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" data-scroll-behavior="smooth" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
