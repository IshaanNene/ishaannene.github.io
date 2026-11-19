"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useState, type ReactNode } from "react";
import { DESTINATIONS, type DestinationId } from "@/config/world";
import { useWorld } from "@/three/store";
import type { ContentSummary } from "@/lib/content/schema";
import { SiteHeader } from "./ui/SiteHeader";
import { CameraButtons, DestinationPanel, Loader, MiniMap, StatusLine } from "./ui/WorldHUD";

const World = dynamic(() => import("@/three/World"), { ssr: false });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class WorldErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[world] renderer crashed", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Accessible, WebGL-free navigation of the same destinations. */
export function WorldFallback({ reason }: { reason: string }) {
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-cream pt-20">
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <p className="mono-label mb-4 text-ink/60">{reason}</p>
        <h1 className="mb-8 text-5xl font-bold tracking-tight">The archipelago</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {DESTINATIONS.map((d) => (
            <Link key={d.id} href={d.route} className="nb-panel block p-4 hover:bg-lime">
              <span className="mono-label text-ink/50">
                {d.key} · {d.kicker}
              </span>
              <span className="mt-1 block text-2xl font-bold">{d.title}</span>
              <span className="mt-1 block text-sm text-ink/70">{d.tagline}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeExperience({ entries }: { entries: ContentSummary[] }) {
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  // deep link: /?focus=<destination> flies to that island once the world is ready
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("focus");
    if (!f || !DESTINATIONS.some((d) => d.id === f)) return;
    const go = () => setTimeout(() => useWorld.getState().select(f as DestinationId), 400);
    if (useWorld.getState().ready) return void go();
    return useWorld.subscribe((s, p) => {
      if (s.ready && !p.ready) go();
    });
  }, []);
  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-[#e9b896]">
      <h1 className="sr-only">Ishaan Nene — an explorable 3D archipelago portfolio</h1>
      {gl === false ? (
        <WorldFallback reason="WebGL is unavailable in this browser — here is the map as a list." />
      ) : gl ? (
        <WorldErrorBoundary fallback={<WorldFallback reason="The 3D renderer hit a problem — here is the map as a list." />}>
          <div className="absolute inset-0">
            <World entries={entries} />
          </div>
          <Loader />
        </WorldErrorBoundary>
      ) : null}
      <SiteHeader overlay />
      {gl && (
        <>
          <DestinationPanel entries={entries} />
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-end gap-3">
            <MiniMap />
            <StatusLine entries={entries} />
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 z-10 hidden md:block">
            <CameraButtons />
          </div>
          <div className="pointer-events-none absolute top-[60px] right-3 z-10 md:hidden">
            <CameraButtons />
          </div>
        </>
      )}
      <noscript>
        <div className="absolute inset-0 bg-cream p-8">
          {DESTINATIONS.map((d) => (
            <a key={d.id} href={d.route} className="block text-2xl underline">
              {d.title}
            </a>
          ))}
        </div>
      </noscript>
    </main>
  );
}
