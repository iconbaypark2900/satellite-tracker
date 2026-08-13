/**
 * Root Layout — wraps all pages with providers, fonts, and global styles.
 *
 * Providers:
 * - Zustand (via provider wrapper for SSR compatibility)
 * - SWR (for data fetching)
 * - Theme (dark mode default)
 */

import "@/app/globals.css";

import { Inter, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { TLE_CACHE_TTL } from "@/lib/constants";

// Fonts
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://satellite-tracker.vercel.app"
  ),
  title: "🛰️ Satellite Tracker — Real-time 3D Orbital Visualization",
  description:
    "Track satellites in real-time with SGP4 orbital mechanics. Built with Next.js 15, Three.js, and satellite.js.",
  keywords: [
    "satellite tracker",
    "SGP4",
    "orbital mechanics",
    "Three.js",
    "Next.js",
    "Celestrak",
    "ISS tracker",
    "Starlink",
    "GPS",
  ],
  openGraph: {
    title: "🛰️ Satellite Tracker",
    description: "Real-time 3D satellite tracking with SGP4 orbital mechanics.",
    type: "website",
    url: "https://satellite-tracker.vercel.app",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// SWR global config — revalidate TLEs every 5 minutes
const swrOptions = {
  refreshInterval: TLE_CACHE_TTL * 1000,
  revalidateOnFocus: false,
  dedupingInterval: 30000,
  errorRetryInterval: 5000,
  errorRetryCount: 3,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans bg-space text-text-primary overflow-hidden">
        <SWRConfig value={swrOptions}>
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
