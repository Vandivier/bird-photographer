# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pillow>=10",
#   "numpy>=1.26",
#   "scipy>=1.11",
# ]
# ///
"""Normalize bird images into 1000x1000 transparent PNGs.

For each image in the target directory:
  1. Remove the opaque background (white, blue sky, etc.) by flood-filling
     from the image borders. Images whose borders are already mostly
     transparent are left as-is.
  2. Crop to the remaining content, downscale only if larger than the
     target size, and center on a transparent square canvas.
  3. Save as <name>.png; non-PNG originals (e.g. .jpg) are removed unless
     --keep-originals is passed.

Usage:
    uv run scripts/normalize_bird_images.py [--dir DIR] [--size N]
        [--tolerance N] [--keep-originals] [--out DIR]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}


def border_alpha_fraction(alpha: np.ndarray) -> float:
    """Fraction of border pixels that are (nearly) transparent."""
    border = np.concatenate([alpha[0], alpha[-1], alpha[1:-1, 0], alpha[1:-1, -1]])
    return float((border < 16).mean())


def corner_seeds(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, float]:
    """Background seed colors sampled from the four corner patches.

    Corners are used instead of the full border because the subject may touch
    an edge (e.g. a perch running off the bottom of the frame), which would
    poison the seed set. Returns the quantized seed colors and the spread
    between corner means — a large spread indicates a gradient background
    (like a sky) that needs a wider matching tolerance.
    """
    h, w, _ = rgb.shape
    n = max(3, round(0.03 * min(h, w)))
    patches = [rgb[:n, :n], rgb[:n, -n:], rgb[-n:, :n], rgb[-n:, -n:]]
    alphas = [alpha[:n, :n], alpha[-n:, :n], alpha[:n, -n:], alpha[-n:, -n:]]

    colors, means = [], []
    for patch, a in zip(patches, alphas):
        opaque = patch.reshape(-1, 3)[a.reshape(-1) > 128].astype(np.float32)
        if len(opaque):
            colors.append(opaque)
            means.append(opaque.mean(axis=0))
    if not colors:
        return np.empty((0, 3), dtype=np.float32), 0.0

    spread = max(
        (float(np.linalg.norm(a - b)) for a in means for b in means), default=0.0
    )
    all_colors = np.concatenate(colors)
    seeds = np.unique(all_colors // 12, axis=0) * 12 + 6
    return seeds.astype(np.float32), spread


def background_mask(rgb: np.ndarray, alpha: np.ndarray, tolerance: float) -> np.ndarray:
    """Boolean mask of background pixels, found by flood fill from the corners.

    A pixel is background-like if its color is within tolerance (Euclidean
    RGB distance) of a corner seed color; of those, only regions connected
    to the image border are treated as background. Enclosed light areas
    (a white belly, a gray pedestal) are kept because they never connect
    to the border.
    """
    h, w, _ = rgb.shape
    seeds, spread = corner_seeds(rgb, alpha)
    if seeds.size == 0:
        return np.zeros((h, w), dtype=bool)

    # A gradient background (sky) has corner colors far apart; widen the
    # tolerance to cover the colors between them. A flat background keeps
    # the tight base tolerance so it can't leak into a pale subject.
    tolerance = max(tolerance, spread / 2 + 15)

    flat = rgb.reshape(-1, 3).astype(np.float32)
    bg_like = np.zeros(flat.shape[0], dtype=bool)
    chunk = 200_000
    for start in range(0, flat.shape[0], chunk):
        block = flat[start : start + chunk]
        d2 = ((block[:, None, :] - seeds[None, :, :]) ** 2).sum(axis=2)
        bg_like[start : start + chunk] = d2.min(axis=1) <= tolerance**2
    bg_like = bg_like.reshape(h, w)

    labels, _ = ndimage.label(bg_like)
    edge_labels = np.unique(
        np.concatenate([labels[0], labels[-1], labels[1:-1, 0], labels[1:-1, -1]])
    )
    edge_labels = edge_labels[edge_labels != 0]
    return np.isin(labels, edge_labels)


def remove_background(img: Image.Image, tolerance: float) -> Image.Image:
    arr = np.asarray(img.convert("RGBA"))
    rgb, alpha = arr[..., :3], arr[..., 3]

    if border_alpha_fraction(alpha) > 0.9:
        return img.convert("RGBA")  # already transparent

    bg = background_mask(rgb, alpha, tolerance)

    # Feather the cut edge slightly to avoid a hard halo of background color.
    fg_soft = ndimage.gaussian_filter((~bg).astype(np.float32), sigma=1.0)
    new_alpha = np.minimum(alpha, (np.clip(fg_soft, 0, 1) * 255)).astype(np.uint8)
    new_alpha[bg] = 0

    out = arr.copy()
    out[..., 3] = new_alpha
    return Image.fromarray(out, "RGBA")


def normalize(img: Image.Image, size: int) -> Image.Image:
    """Crop to content, downscale if oversized, center on a transparent canvas."""
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    if img.width > size or img.height > size:
        img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public" / "bird-images",
        help="Directory of images to normalize (default: public/bird-images)",
    )
    parser.add_argument("--out", type=Path, default=None,
                        help="Output directory (default: in place)")
    parser.add_argument("--size", type=int, default=1000, help="Canvas size in px")
    parser.add_argument("--tolerance", type=float, default=30.0,
                        help="RGB distance tolerance for background matching")
    parser.add_argument("--keep-originals", action="store_true",
                        help="Keep non-PNG originals instead of deleting them")
    args = parser.parse_args()

    out_dir = args.out or args.dir
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(p for p in args.dir.iterdir() if p.suffix.lower() in SUPPORTED)
    if not images:
        print(f"No images found in {args.dir}", file=sys.stderr)
        return 1

    for path in images:
        img = Image.open(path)
        img = remove_background(img, args.tolerance)
        img = normalize(img, args.size)
        target = out_dir / (path.stem + ".png")
        img.save(target, "PNG")
        if not args.keep_originals and path.suffix.lower() != ".png" and out_dir == args.dir:
            path.unlink()
        print(f"{path.name} -> {target.relative_to(out_dir.parent)} "
              f"({img.width}x{img.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
