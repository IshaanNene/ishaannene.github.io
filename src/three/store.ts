"use client";
import { create } from "zustand";
import type CameraControlsImpl from "camera-controls";
import type { DestinationId } from "@/config/world";

export type Quality = "high" | "low";

interface WorldState {
  hovered: DestinationId | null;
  selected: DestinationId | null;
  hoveredContent: string | null;
  quality: Quality;
  ready: boolean;
  controls: CameraControlsImpl | null;
  /** camera ground position + yaw for the mini-map */
  cam: { x: number; z: number; yaw: number };
  setHovered: (id: DestinationId | null) => void;
  select: (id: DestinationId | null) => void;
  setHoveredContent: (id: string | null) => void;
  setQuality: (q: Quality) => void;
  setReady: (r: boolean) => void;
  setControls: (c: CameraControlsImpl | null) => void;
  setCam: (c: { x: number; z: number; yaw: number }) => void;
}

export const useWorld = create<WorldState>((set) => ({
  hovered: null,
  selected: null,
  hoveredContent: null,
  quality: "high",
  ready: false,
  controls: null,
  cam: { x: 0, z: 60, yaw: 0 },
  setHovered: (hovered) => set({ hovered }),
  select: (selected) => set({ selected }),
  setHoveredContent: (hoveredContent) => set({ hoveredContent }),
  setQuality: (quality) => set({ quality }),
  setReady: (ready) => set({ ready }),
  setControls: (controls) => set({ controls }),
  setCam: (cam) => set({ cam }),
}));
