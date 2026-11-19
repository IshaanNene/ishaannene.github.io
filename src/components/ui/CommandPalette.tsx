"use client";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorld } from "@/three/store";
import type { DestinationId } from "@/config/world";

interface Item {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
}

export function CommandPalette({
  entries,
  destinations,
}: {
  entries: { title: string; href: string; category: string; excerpt: string }[];
  destinations: { id: string; title: string; route: string; kicker: string; key: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const path = usePathname();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const onHome = path === "/";
    const list: Item[] = [];
    for (const d of destinations) {
      if (onHome)
        list.push({ id: `fly-${d.id}`, label: `Fly to ${d.title}`, hint: d.kicker, group: "World", run: () => useWorld.getState().select(d.id as DestinationId) });
      list.push({ id: `go-${d.id}`, label: `Open ${d.title}`, hint: d.route, group: "Pages", run: () => router.push(d.route) });
    }
    if (onHome) list.unshift({ id: "reset", label: "Back to overview", hint: "Esc", group: "World", run: () => useWorld.getState().select(null) });
    else list.unshift({ id: "home", label: "Return to the archipelago", hint: "/", group: "World", run: () => router.push("/") });
    for (const e of entries) list.push({ id: e.href, label: e.title, hint: e.category, group: "Content", run: () => router.push(e.href) });
    return list;
  }, [destinations, entries, path, router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items
      .map((it) => {
        const hay = `${it.label} ${it.hint} ${it.group}`.toLowerCase();
        let score = hay.includes(s) ? 10 - hay.indexOf(s) / 50 : 0;
        if (!score) {
          // subsequence fuzzy match
          let i = 0;
          for (const ch of hay) if (ch === s[i]) i++;
          score = i === s.length ? 1 : 0;
        }
        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
  }, [items, q]);

  const run = (it: Item | undefined) => {
    if (!it) return;
    setOpen(false);
    it.run();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div
            role="dialog"
            aria-label="Command palette"
            className="nb-panel w-full max-w-xl overflow-hidden"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b-2 border-ink px-4 py-3">
              <span className="mono-label text-ink/60">⌘K</span>
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(filtered.length - 1, a + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === "Enter") run(filtered[active]);
                }}
                placeholder="Search destinations, essays, projects…"
                className="w-full bg-transparent text-lg outline-none placeholder:text-ink/40"
                aria-label="Search"
              />
            </div>
            <ul className="max-h-[52vh] overflow-y-auto py-1" role="listbox">
              {filtered.length === 0 && <li className="px-4 py-6 text-center text-ink/50">No matches.</li>}
              {filtered.map((it, i) => (
                <li
                  key={it.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(it)}
                  className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2 ${i === active ? "bg-lime" : ""}`}
                >
                  <span className="truncate font-medium">{it.label}</span>
                  <span className="mono-label shrink-0 text-ink/55">
                    {it.group} · {it.hint}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
