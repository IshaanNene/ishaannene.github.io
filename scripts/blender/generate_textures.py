"""
Procedural, perfectly tileable PBR detail maps (normal + roughness) for the
runtime material library. FFT-filtered noise is periodic by construction, so
every map tiles seamlessly.

    .venv-blender/bin/python scripts/blender/generate_textures.py
Outputs public/textures/<surface>/{normal,roughness}.webp
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "textures")
N = 512
rng = np.random.default_rng(7)

fy = np.fft.fftfreq(N)[:, None]
fx = np.fft.fftfreq(N)[None, :]


def noise(beta=2.0, sx=1.0, sy=1.0, lo=0.0):
    """Power-law noise; sx/sy stretch anisotropically (wood grain, brushed metal)."""
    f = np.sqrt((fx * sx) ** 2 + (fy * sy) ** 2)
    f[0, 0] = 1
    spec = (rng.normal(size=(N, N)) + 1j * rng.normal(size=(N, N))) / f ** (beta / 2)
    spec[f < lo] = 0
    spec[0, 0] = 0
    n = np.real(np.fft.ifft2(spec))
    return (n - n.min()) / (n.max() - n.min())


def cells(count, seed):
    """Tileable Voronoi-ish cracks / stones (F2-F1)."""
    r = np.random.default_rng(seed)
    pts = r.random((count, 2)) * N
    yy, xx = np.mgrid[0:N, 0:N]
    d1 = np.full((N, N), 1e9)
    d2 = np.full((N, N), 1e9)
    for px, py in pts:
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d = np.hypot(xx - px - ox, yy - py - oy)
                m = d < d1
                d2 = np.where(m, d1, np.minimum(d2, d))
                d1 = np.where(m, d, d1)
    e = d2 - d1
    return np.clip(e / e.max(), 0, 1)


def to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save(name, height, rough, strength):
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    Image.fromarray(to_normal(height, strength), "RGB").save(os.path.join(d, "normal.webp"), quality=88)
    r = (np.clip(rough, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(r, "L").save(os.path.join(d, "roughness.webp"), quality=88)
    print("texture", name)


def main():
    c = cells(48, 1)
    stone_h = 0.55 * noise(2.2) + 0.25 * noise(1.4) + 0.35 * np.sqrt(c)
    save("stone", stone_h, 0.75 + 0.25 * noise(1.8), 18)

    blades = noise(1.2, sx=0.25, sy=1.0)
    save("grass", 0.6 * blades + 0.4 * noise(2.0), 0.85 + 0.15 * noise(1.5), 10)

    grain = noise(2.0, sx=0.06, sy=1.0)
    rings = np.sin(grain * 40) * 0.5 + 0.5
    save("wood", 0.7 * rings + 0.3 * noise(2.4), 0.6 + 0.3 * rings, 6)

    pits = (noise(0.6) > 0.82).astype(float)
    conc = 0.8 * noise(2.6) - 0.35 * pits
    save("concrete", conc, 0.72 + 0.22 * noise(2.0) + 0.1 * pits, 9)

    brushed = noise(1.6, sx=1.0, sy=0.02)
    save("metal", 0.5 * brushed + 0.1 * noise(2.5), 0.3 + 0.25 * brushed, 3)

    save("sand", noise(1.0) * 0.6 + noise(2.6) * 0.4, 0.9 + 0.1 * noise(1.0), 6)

    # paving: grid of slabs with bevelled joints
    yy, xx = np.mgrid[0:N, 0:N] / N
    gx = np.abs(((xx * 4) % 1) - 0.5) * 2
    gy = np.abs(((yy * 4 + (np.floor(xx * 4) % 2) * 0.5) % 1) - 0.5) * 2
    joints = np.clip((1 - np.maximum(gx, gy)) * 18, 0, 1)
    save("paving", joints * 0.8 + 0.2 * noise(2.4), 0.7 + 0.2 * (1 - joints) + 0.1 * noise(2.0), 10)

    # water: soft rolling waves for animated normal offsets
    save("water", noise(3.0), np.full((N, N), 0.05), 22)

    # foliage: leafy clumps
    save("foliage", 0.6 * cells(90, 3) + 0.4 * noise(1.6), 0.75 + 0.2 * noise(1.5), 8)

    # cloud sprite (soft puff with noisy edge) used by the runtime cloud system
    M = 256
    yy, xx = (np.mgrid[0:M, 0:M] - M / 2) / (M / 2)
    r = np.sqrt(xx ** 2 + yy ** 2)
    n = np.array(Image.fromarray((noise(1.8) * 255).astype(np.uint8)).resize((M, M))) / 255.0
    a = np.clip(1 - r * (1.0 + 0.55 * (n - 0.5)), 0, 1) ** 1.6
    rgba = np.dstack([np.full((M, M), 255), np.full((M, M), 255), np.full((M, M), 255), (a * 255)]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, "cloud.png"))
    print("texture cloud")


if __name__ == "__main__":
    main()
