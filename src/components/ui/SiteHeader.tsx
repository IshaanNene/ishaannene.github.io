"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SITE } from "@/config/site";
import { DESTINATIONS } from "@/config/world";

export function openPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className={`${overlay ? "pointer-events-none absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b-2 border-ink bg-cream"}`}>
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="pointer-events-auto flex items-center gap-2" aria-label="Home — the archipelago">
          <span className="grid h-8 w-8 place-items-center bg-ink font-mono text-xs font-bold text-lime">IN</span>
          <span className={`text-sm font-bold tracking-[0.12em] ${overlay ? "bg-cream px-2 py-1 border-2 border-ink" : ""}`}>{SITE.wordmark}</span>
        </Link>
        <nav className="pointer-events-auto hidden items-center gap-1 lg:flex" aria-label="Primary">
          {DESTINATIONS.map((d) => {
            const on = path?.startsWith(d.route);
            return (
              <Link key={d.id} href={d.route} className={`mono-label border-2 px-2 py-1 transition-colors ${on ? "border-ink bg-ink text-lime" : overlay ? "border-ink bg-cream hover:bg-lime" : "border-transparent hover:border-ink hover:bg-lime"}`}>
                {d.title}
              </Link>
            );
          })}
          <button onClick={openPalette} className="nb-btn ml-2" aria-label="Open command palette">
            Search <span className="nb-kbd">⌘K</span>
          </button>
        </nav>
        <div className="pointer-events-auto flex items-center gap-2 lg:hidden">
          <button onClick={openPalette} className="nb-btn" aria-label="Search">
            ⌘K
          </button>
          <button onClick={() => setOpen(true)} className="nb-btn nb-btn--dark" aria-label="Open menu" aria-expanded={open}>
            Menu
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-ink text-cream" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
            <div className="flex items-center justify-between border-b-2 border-cream/20 px-4 py-3">
              <span className="mono-label text-lime">Destinations</span>
              <button onClick={() => setOpen(false)} className="nb-btn">
                Close
              </button>
            </div>
            <nav className="flex flex-1 flex-col overflow-y-auto" aria-label="Mobile">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-cream/15 px-4 py-4">
                <span className="text-3xl font-bold">Archipelago</span>
                <span className="mono-label text-cream/50">Map</span>
              </Link>
              {DESTINATIONS.map((d) => (
                <Link key={d.id} href={d.route} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-cream/15 px-4 py-4 active:bg-lime active:text-ink">
                  <span className="text-3xl font-bold">
                    <span className="mr-3 font-mono text-sm text-lime">{d.key}</span>
                    {d.title}
                  </span>
                  <span className="mono-label text-cream/50">{d.kicker}</span>
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
