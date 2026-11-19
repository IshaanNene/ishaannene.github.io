"use client";
/**
 * WorldCamera — constrained orbit/pan/zoom (camera-controls) with limits that
 * keep the camera above the world. DestinationController animates focus
 * transitions; WorldNavigation adds keyboard control.
 */
import { CameraControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type CameraControlsImpl from "camera-controls";
import { DESTINATIONS, DESTINATION_MAP, OVERVIEW, focusPose } from "@/config/world";
import { useWorld } from "./store";

const BOUNDS = new THREE.Box3(new THREE.Vector3(-42, -6, -40), new THREE.Vector3(42, 14, 38));

export function WorldCamera() {
  const ref = useRef<CameraControlsImpl>(null);
  const setControls = useWorld((s) => s.setControls);
  const setCam = useWorld((s) => s.setCam);
  const tick = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    setControls(c);
    c.setBoundary(BOUNDS);
    c.boundaryFriction = 0.2;
    c.setLookAt(...OVERVIEW.position, ...OVERVIEW.target, false);
    // cinematic intro: drift in from further out
    c.dollyTo(c.distance * 1.35, false);
    c.dollyTo(c.distance / 1.35, true);
    return () => setControls(null);
  }, [setControls]);

  useFrame(({ camera }) => {
    // hard floor: never below the archipelago's underside
    if (camera.position.y < -4) camera.position.y = -4;
    if (++tick.current % 6 === 0) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      setCam({ x: camera.position.x, z: camera.position.z, yaw: Math.atan2(dir.x, dir.z) });
    }
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={7}
      maxDistance={120}
      minPolarAngle={0.12}
      maxPolarAngle={1.32}
      smoothTime={0.55}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
      truckSpeed={1.4}
      dollyToCursor
      infinityDolly={false}
    />
  );
}

export function DestinationController() {
  const selected = useWorld((s) => s.selected);
  const controls = useWorld((s) => s.controls);
  const first = useRef(true);
  useEffect(() => {
    if (!controls) return;
    if (first.current && !selected) {
      first.current = false;
      return;
    }
    first.current = false;
    if (selected) {
      const pose = focusPose(DESTINATION_MAP[selected]);
      const wide = window.innerWidth >= 768;
      // portrait screens see far less horizontally: pull back so the whole island fits
      const aspect = window.innerWidth / window.innerHeight;
      const k = wide ? 1 : Math.min(1.65, Math.max(1, 0.85 / aspect));
      const [px, py, pz] = pose.position;
      const [tx, ty, tz] = pose.target;
      const pos: [number, number, number] = [tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k];
      const dist = Math.hypot(pos[0] - tx, pos[1] - ty, pos[2] - tz);
      controls.setLookAt(...pos, tx, ty, tz, true);
      // keep the island clear of the contextual panel (right on desktop, bottom on mobile)
      if (wide) controls.setFocalOffset(dist * 0.17, 0, 0, true);
      else controls.setFocalOffset(0, dist * 0.11, 0, true);
    } else {
      controls.setLookAt(...OVERVIEW.position, ...OVERVIEW.target, true);
      controls.setFocalOffset(0, 0, 0, true);
    }
  }, [selected, controls]);
  return null;
}

export function WorldNavigation() {
  const select = useWorld((s) => s.select);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { controls, selected } = useWorld.getState();
      const d = DESTINATIONS.find((x) => x.key === e.key);
      if (d) {
        select(d.id);
        return;
      }
      if (!controls) return;
      switch (e.key) {
        case "Escape":
        case "0":
          select(null);
          break;
        case "ArrowLeft":
          controls.rotate(-0.25, 0, true);
          break;
        case "ArrowRight":
          controls.rotate(0.25, 0, true);
          break;
        case "ArrowUp":
          controls.rotate(0, -0.12, true);
          break;
        case "ArrowDown":
          controls.rotate(0, 0.12, true);
          break;
        case "+":
        case "=":
          controls.dolly(6, true);
          break;
        case "-":
          controls.dolly(-6, true);
          break;
        case "Enter":
          if (selected) window.location.href = DESTINATION_MAP[selected].route;
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);
  return null;
}
