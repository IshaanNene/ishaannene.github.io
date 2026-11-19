import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { SITE } from "@/config/site";
import { DESTINATIONS } from "@/config/world";
import { getContentRegistry } from "@/lib/content/registry";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE.name} — Archipelago`, template: `%s — ${SITE.name}` },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  openGraph: { title: SITE.name, description: SITE.description, type: "website" },
};

export const viewport: Viewport = { themeColor: "#171717", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const index = getContentRegistry().map((e) => ({ title: e.title, href: e.href, category: e.category, excerpt: e.excerpt }));
  const destinations = DESTINATIONS.map((d) => ({ id: d.id, title: d.title, route: d.route, kicker: d.kicker, key: d.key }));
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        {children}
        <CommandPalette entries={index} destinations={destinations} />
      </body>
    </html>
  );
}
