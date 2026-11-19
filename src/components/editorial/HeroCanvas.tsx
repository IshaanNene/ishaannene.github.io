"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { DestinationId } from "@/config/world";
import type { ContentSummary } from "@/lib/content/schema";

const IslandHero = dynamic(() => import("@/three/IslandHero"), { ssr: false });

/** Lazy: the hero canvas mounts only when scrolled into view, and only with WebGL. */
export function HeroCanvas({ id, entries }: { id: DestinationId; entries: ContentSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [gl, setGl] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setGl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setGl(false);
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: "200px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      {show && gl ? <IslandHero id={id} entries={entries} /> : null}
      {!gl && <div className="grid h-full place-items-center font-mono text-sm">WebGL unavailable</div>}
    </div>
  );
}
