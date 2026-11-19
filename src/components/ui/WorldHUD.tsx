"use client";
/** Home overlay: destination panel, mini-map, camera controls, status line, loader. */
import { useProgress } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";
import { DESTINATIONS, DESTINATION_MAP, WORLD_MANIFEST, type DestinationId } from "@/config/world";
import type { ContentSummary } from "@/lib/content/schema";
import { useWorld } from "@/three/store";

export function DestinationPanel({ entries }: { entries: ContentSummary[] }) {
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const d = selected ? DESTINATION_MAP[selected] : null;
  const items = useMemo(() => (d?.contentCategory ? entries.filter((e) => e.category === d.contentCategory).slice(0, 4) : []), [d, entries]);
  const idx = d ? DESTINATIONS.findIndex((x) => x.id === d.id) : -1;
  const step = (n: number) => select(DESTINATIONS[(idx + n + DESTINATIONS.length) % DESTINATIONS.length].id);
  return (
    <AnimatePresence>
      {d && (
        <motion.aside
          key={d.id}
          className="nb-panel pointer-events-auto absolute right-3 bottom-3 left-3 z-20 max-h-[40vh] overflow-y-auto md:top-20 md:bottom-auto md:left-auto md:w-[360px] md:max-h-[calc(100vh-7rem)]"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          aria-live="polite"
        >
          <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
            <span className="mono-label">
              {String(idx + 1).padStart(2, "0")} / {String(DESTINATIONS.length).padStart(2, "0")} — {d.kicker}
            </span>
            <button className="mono-label hover:bg-lime px-1" onClick={() => select(null)} aria-label="Back to overview">
              ✕
            </button>
          </div>
          <div className="px-4 pt-4 pb-3">
            <div className="mb-2 h-2 w-16" style={{ background: d.accent, border: "2px solid #171717" }} />
            <h2 className="text-4xl leading-none font-bold tracking-tight">{d.title}</h2>
            <p className="mt-3 text-[15px] leading-snug">{d.tagline}</p>
            <p className="mt-2 text-sm text-ink/65">{d.description}</p>
          </div>
          {items.length > 0 && (
            <div className="border-t-2 border-ink px-4 py-3">
              <p className="mono-label mb-2 text-ink/60">On this island · click the objects</p>
              <ul className="space-y-1">
                {items.map((e) => (
                  <li key={e.slug}>
                    <Link href={e.href} className="group flex items-baseline justify-between gap-3 py-0.5">
                      <span className="truncate text-sm font-medium group-hover:bg-lime">{e.title}</span>
                      <span className="mono-label shrink-0 text-ink/45">{e.visual.material}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2 border-t-2 border-ink px-4 py-3">
            <Link href={d.route} className="nb-btn nb-btn--dark flex-1 justify-center">
              Enter {d.title} →
            </Link>
            <button className="nb-btn" onClick={() => step(-1)} aria-label="Previous destination">
              ←
            </button>
            <button className="nb-btn" onClick={() => step(1)} aria-label="Next destination">
              →
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function MiniMap() {
  const cam = useWorld((s) => s.cam);
  const selected = useWorld((s) => s.selected);
  const hovered = useWorld((s) => s.hovered);
  const select = useWorld((s) => s.select);
  const setHovered = useWorld((s) => s.setHovered);
  // world x ∈ [-42, 42], z ∈ [-40, 38] → svg
  const S = 1.9;
  const tx = (x: number) => 86 + x * S;
  const tz = (z: number) => 80 + z * S;
  return (
    <div className="nb-panel pointer-events-auto hidden w-[188px] md:block" aria-label="Mini-map">
      <div className="flex items-center justify-between border-b-2 border-ink px-2 py-1">
        <span className="mono-label">Map</span>
        <span className="mono-label text-ink/50">N↑</span>
      </div>
      <svg viewBox="0 0 172 164" className="block w-full bg-[#e9e0cf]">
        <defs>
          <pattern id="mm-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#171717" strokeOpacity="0.07" />
          </pattern>
        </defs>
        <rect width="172" height="164" fill="url(#mm-grid)" />
        {WORLD_MANIFEST.bridges.map((b) => (
          <line key={b.id} x1={tx(b.a[0])} y1={tz(b.a[2])} x2={tx(b.b[0])} y2={tz(b.b[2])} stroke="#171717" strokeWidth="1.6" strokeDasharray="3 2" />
        ))}
        {DESTINATIONS.map((d) => {
          const m = WORLD_MANIFEST.islands[d.id];
          const pts = m.outline.map(([x, z]) => `${tx(d.position[0] + x)},${tz(d.position[2] + z)}`).join(" ");
          const on = selected === d.id || hovered === d.id;
          return (
            <g key={d.id} className="cursor-pointer" onClick={() => select(d.id)} onMouseEnter={() => setHovered(d.id)} onMouseLeave={() => setHovered(null)}>
              <polygon points={pts} fill={on ? "#DFFF00" : "#8BC9A5"} stroke="#171717" strokeWidth="1.5" />
              <text x={tx(d.position[0])} y={tz(d.position[2]) + 3} textAnchor="middle" fontSize="8" fontFamily="var(--font-mono)" fill="#171717" fontWeight="700">
                {d.key}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${Math.max(4, Math.min(168, tx(cam.x)))} ${Math.max(4, Math.min(160, tz(cam.z)))}) rotate(${(-cam.yaw * 180) / Math.PI + 180})`}>
          <path d="M0 -7 L5 5 L0 2 L-5 5 Z" fill="#FF7043" stroke="#171717" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

export function CameraButtons() {
  const controls = useWorld((s) => s.controls);
  const select = useWorld((s) => s.select);
  const btn = "nb-btn h-9 w-9 justify-center !p-0 text-base";
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5" role="group" aria-label="Camera controls">
      <button className={btn} onClick={() => controls?.dolly(6, true)} aria-label="Zoom in">
        +
      </button>
      <button className={btn} onClick={() => controls?.dolly(-6, true)} aria-label="Zoom out">
        −
      </button>
      <button className={btn} onClick={() => controls?.rotate(-Math.PI / 6, 0, true)} aria-label="Rotate left">
        ↺
      </button>
      <button className={btn} onClick={() => controls?.rotate(Math.PI / 6, 0, true)} aria-label="Rotate right">
        ↻
      </button>
      <button className={`${btn} nb-btn--dark`} onClick={() => select(null)} aria-label="Reset to overview" title="Overview (Esc)">
        ◎
      </button>
    </div>
  );
}

export function StatusLine({ entries }: { entries: ContentSummary[] }) {
  const hc = useWorld((s) => s.hoveredContent);
  const hovered = useWorld((s) => s.hovered);
  const selected = useWorld((s) => s.selected);
  let text: React.ReactNode = (
    <>
      <b>Drag</b> to orbit · <b>Right-drag</b> to pan · <b>Scroll</b> to zoom · <b>Click</b> an island · <span className="nb-kbd">1–7</span> jump
    </>
  );
  if (hc) {
    const [cat, slug] = hc.split("/");
    const e = entries.find((x) => x.category === cat && x.slug === slug);
    text = (
      <>
        <span className="bg-lime px-1 font-bold">{e?.title ?? slug}</span> — {e?.visual.material ?? cat} · {e?.visual.objectType ?? "sign"} · click to open
      </>
    );
  } else if (hovered && hovered !== selected) {
    text = (
      <>
        <b>{DESTINATION_MAP[hovered as DestinationId].title}</b> — {DESTINATION_MAP[hovered as DestinationId].tagline} Click to fly in.
      </>
    );
  }
  return <div className="nb-panel pointer-events-none hidden max-w-[640px] truncate px-3 py-1.5 font-mono text-[11px] md:block">{text}</div>;
}

export function Loader() {
  const { progress, active } = useProgress();
  const ready = useWorld((s) => s.ready);
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink text-cream" exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
          <div className="w-[min(420px,80vw)]">
            <div className="mono-label mb-3 flex justify-between text-cream/60">
              <span>Raising the archipelago</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 border-2 border-cream">
              <div className="h-full bg-lime transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mono-label mt-3 text-cream/40">{active ? "Loading terrain, architecture and materials" : "Composing light"}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
