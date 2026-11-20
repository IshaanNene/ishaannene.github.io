"use client";
/**
 * Ground cover scattered over every island's lawn at runtime: low leafy clumps, wildflower
 * drifts and small scanned stones (the lawn itself is the scanned grass texture; individual blade
 * cards read as little triangles from the map camera, so there are none). Positions are
 * sampled from the terrain's grass surfaces (three's MeshSurfaceSampler) and
 * tinted by the terrain's baked vertex AO, so cover thins and darkens where the
 * ground is occluded. Everything is instanced; one draw call per kind per surface.
 */
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { VEGETATION_MODEL } from "@/config/world";
import { isScanned, scannedMaterial, windUniforms } from "./materials";
import { useWorld } from "./store";
import { dequantise } from "./Vegetation";

const LAWN = new Set(["grass", "grass_dry"]);

/* ------------------------------------------------------------ shared assets */

function swayShader(name: string, amount: number) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz;
      float k = position.y * position.y;
      float gust = sin(uTime * 0.7 + ip.x * 0.35 + ip.z * 0.2) * 0.5 + 0.5;
      transformed.x += (sin(uTime * 2.3 + ip.x * 3.1 + ip.z * 1.7) * 0.6 + gust) * ${amount.toFixed(3)} * k;
      transformed.z += cos(uTime * 1.9 + ip.z * 2.7) * ${(amount * 0.6).toFixed(3)} * k;`,
    );
    void name;
  };
}

let pebble: THREE.BufferGeometry | null = null;
function pebbleGeometry() {
  if (pebble) return pebble;
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9.1 + v.y * 4.3) * Math.cos(v.z * 7.7 - v.x * 2.9);
    v.multiplyScalar(1 + n * 0.16);
    v.y = v.y * 0.62 + 0.2; // flattened, sitting slightly into the ground
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  pebble = g;
  return g;
}

let assets: {
  flower: THREE.BufferGeometry;
  flowerMat: THREE.MeshStandardMaterial;
} | null = null;

function getAssets() {
  if (assets) return assets;
  // flower: a thin stem plus a five-petal head, 1 unit tall (scaled per instance)
  const head = new THREE.CircleGeometry(0.16, 10);
  const hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i);
    const y = hp.getY(i);
    const a = Math.atan2(y, x);
    const r = Math.hypot(x, y) * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)));
    hp.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  head.rotateX(-Math.PI / 2);
  head.translate(0, 1, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.018, 1, 3, 1, true);
  stem.translate(0, 0.5, 0);
  const paint = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    g.deleteAttribute("uv");
    return g;
  };
  const flower = mergeGeometries([paint(stem.toNonIndexed(), new THREE.Color("#3d5a1c")), paint(head.toNonIndexed(), new THREE.Color("#ffffff"))]);
  const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });
  flowerMat.onBeforeCompile = swayShader("flower", 0.08);
  flowerMat.customProgramCacheKey = () => "ground-flower";
  assets = { flower, flowerMat };
  return assets;
}

/** Minimal non-indexed merge (avoids pulling BufferGeometryUtils for two parts). */
function mergeGeometries(parts: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color"]) {
    const arrays = parts.map((p) => p.attributes[name].array as Float32Array);
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const merged = new Float32Array(total);
    let o = 0;
    for (const a of arrays) {
      merged.set(a, o);
      o += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  // the stem part keeps the stem colour; the head gets the instance colour (stem is darkened by it slightly)
  return out;
}

const CLUMP_TINTS = ["#5fa334", "#6fb23c", "#4f9330", "#86b846", "#9cb848"].map((c) => new THREE.Color(c));
const FLOWER_COLOURS = ["#fbf7ea", "#f6f0d8", "#ffd23f", "#f3c623", "#b9a6e8", "#9d8fd8", "#ff8c42", "#e85d3a"].map((c) => new THREE.Color(c));

/** Copy of a (possibly quantised) geometry with plain float attributes. */
function toFloat(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color"]) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (g.index) out.setIndex(g.index.clone());
  return out;
}

function surfaceArea(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const idx = g.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let area = 0;
  const n = idx ? idx.count : p.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1);
    c.fromBufferAttribute(p, i2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/* ---------------------------------------------------------------- component */

export function GroundCover({ terrain }: { terrain: THREE.Object3D[] }) {
  const quality = useWorld((s) => s.quality);
  const veg = useGLTF(VEGETATION_MODEL, false, true);
  useLayoutEffect(() => {
    const { flower, flowerMat } = getAssets();
    const firstMesh = (name: string) => {
      let found: THREE.Mesh | null = null;
      veg.scene.getObjectByName(name)?.traverse((o) => {
        if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
      });
      return found as THREE.Mesh | null;
    };
    const rockMesh = firstMesh("veg_rock");
    const clumpMesh = firstMesh("veg_bush");
    const added: { parent: THREE.Object3D; child: THREE.InstancedMesh }[] = [];
    const scale = quality === "high" ? 1 : 0.4;
    const surfaces: { mesh: THREE.Mesh; host: THREE.Object3D }[] = [];
    for (const node of terrain)
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && LAWN.has((m.material as THREE.Material).name)) surfaces.push({ mesh: m, host: node.parent ?? node });
      });
    let seed = 1;
    for (const { mesh, host } of surfaces) {
      // meshopt-quantised GLBs keep positions in a scaled node space (the terrain node carries a
      // ~10x scale); bake mesh→island-root into the samples and attach instances to the root
      host.updateWorldMatrix(true, false);
      mesh.updateWorldMatrix(true, false);
      const rel = host.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
      const baked = toFloat(mesh.geometry);
      baked.applyMatrix4(rel);
      const surf = new THREE.Mesh(baked, mesh.material);
      const dry = (mesh.material as THREE.Material).name === "grass_dry";
      const area = surfaceArea(baked);
      const sampler = new MeshSurfaceSampler(surf).build();
      const rnd = rand(seed++ * 7919 + Math.round(area * 13));
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      const c = new THREE.Color();
      const q = new THREE.Quaternion();
      const tilt = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const s = new THREE.Vector3();
      const m = new THREE.Matrix4();
      const hasAO = !!baked.attributes.color;

      const scatter = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number, place: (i: number, ao: number) => [number, number, number, THREE.Color | null] | null, castShadow = false) => {
        if (count < 1) return;
        const im = new THREE.InstancedMesh(geo, mat, count);
        let k = 0;
        for (let i = 0; i < count * 1.6 && k < count; i++) {
          if (hasAO) sampler.sample(p, n, c);
          else sampler.sample(p, n);
          const ao = hasAO ? (c.r + c.g + c.b) / 3 : 1;
          const r = place(k, ao);
          if (!r) continue;
          const [h, w, yaw] = r;
          n.lerp(up, 0.7).normalize();
          q.setFromUnitVectors(up, n);
          tilt.setFromAxisAngle(up, yaw);
          q.multiply(tilt);
          s.set(w, h, w);
          m.compose(p, q, s);
          im.setMatrixAt(k, m);
          if (r[3]) im.setColorAt(k, r[3]);
          k++;
        }
        im.count = k;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = castShadow;
        im.receiveShadow = true;
        im.raycast = () => {};
        im.frustumCulled = true;
        im.computeBoundingSphere();
        host.add(im);
        added.push({ parent: host, child: im });
      };

      const tmpC = new THREE.Color();
      if (!dry) {
        // wildflowers grow in loose drifts: a low-frequency mask over the lawn
        scatter(flower, flowerMat, Math.round(area * 4.5 * scale), (_, ao) => {
          const drift = Math.sin(p.x * 0.55 + seed) * Math.cos(p.z * 0.45 - seed * 0.7);
          if (drift < 0.15 || ao < 0.6 || rnd() > 0.85) return null;
          const h = 0.14 + rnd() * 0.16;
          const fc = FLOWER_COLOURS[Math.floor((drift * 3.7 + rnd() * 1.4) * 2) % FLOWER_COLOURS.length];
          return [h, h * (0.9 + rnd() * 0.5), rnd() * Math.PI * 2, tmpC.copy(fc)];
        });
      }
      if (clumpMesh) {
        // low leafy clumps (the scanned leaf-card mound, shrunk): real 3D tufts across the lawn,
        // gathered in loose patches; tinted per instance like the trees
        const cmat = scannedMaterial(clumpMesh.material as THREE.Material, !!clumpMesh.geometry.attributes.color);
        veg.scene.updateMatrixWorld(true);
        const clumpGeo = dequantise(clumpMesh.geometry).applyMatrix4(clumpMesh.matrixWorld);
        scatter(clumpGeo, cmat, Math.round(area * (dry ? 0.5 : 1.1) * scale), (_, ao) => {
          const patch = Math.sin(p.x * 0.9 - seed * 1.3) * Math.cos(p.z * 0.8 + seed);
          if (patch < -0.1 || rnd() > 0.5 + ao * 0.4) return null;
          const sz = 0.28 + rnd() ** 1.5 * 0.42;
          tmpC.copy(CLUMP_TINTS[Math.floor(rnd() * CLUMP_TINTS.length)]).multiplyScalar(0.85 + ao * 0.3);
          return [sz * 0.75, sz, rnd() * Math.PI * 2, tmpC];
        });
      }
      if (rockMesh) {
        // pebbles are a few centimetres across: a lumpy 80-triangle stone wearing the scanned rock
        // texture reads the same as the 2.8k-triangle scan and costs ~35x less
        const rm = rockMesh as THREE.Mesh;
        const rmat = isScanned(rm.material as THREE.Material) ? scannedMaterial(rm.material as THREE.Material, false) : (rm.material as THREE.Material);
        scatter(pebbleGeometry(), rmat, Math.round(area * 0.18 * scale), () => {
          const sz = 0.1 + rnd() ** 2 * 0.28;
          return [sz, sz, rnd() * Math.PI * 2, null];
        });
      }
    }
    return () => {
      for (const { parent, child } of added) {
        parent.remove(child);
        child.dispose();
      }
    };
  }, [terrain, quality, veg]);
  return null;
}

useGLTF.preload(VEGETATION_MODEL, false, true);
