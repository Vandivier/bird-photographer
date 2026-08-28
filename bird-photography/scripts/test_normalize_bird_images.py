"""Tests for normalize_bird_images.py.

Run with:
    uv run --with pytest,pillow,numpy,scipy python -m pytest bird-photography/scripts
"""

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import normalize_bird_images as nbi


def make_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def subject_on_background(bg_color, subject_color, size=200, box=(60, 60, 140, 140)):
    """An opaque image: solid background with a rectangular subject."""
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., :3] = bg_color
    arr[..., 3] = 255
    x0, y0, x1, y1 = box
    arr[y0:y1, x0:x1, :3] = subject_color
    return make_image(arr)


class TestRemoveBackground:
    def test_white_background_removed(self):
        img = subject_on_background((255, 255, 255), (80, 50, 30))
        out = np.asarray(nbi.remove_background(img, tolerance=30))
        assert out[0, 0, 3] == 0  # corner transparent
        assert out[100, 100, 3] == 255  # subject opaque

    def test_gradient_sky_removed(self):
        # Vertical gradient like the eagle photo's sky.
        size = 200
        arr = np.zeros((size, size, 4), dtype=np.uint8)
        t = np.linspace(0, 1, size)[:, None]
        sky = (1 - t) * np.array([110, 150, 210]) + t * np.array([175, 200, 235])
        arr[..., :3] = sky[:, None, :]
        arr[..., 3] = 255
        arr[60:140, 60:140, :3] = (40, 35, 30)  # dark bird
        out = np.asarray(nbi.remove_background(make_image(arr), tolerance=30))
        assert out[0, 0, 3] == 0 and out[-1, -1, 3] == 0
        assert out[100, 100, 3] == 255

    def test_enclosed_light_region_kept(self):
        # A white belly inside a dark bird must not be treated as background.
        img = subject_on_background((255, 255, 255), (80, 50, 30))
        arr = np.asarray(img).copy()
        arr[90:110, 90:110, :3] = (250, 250, 250)
        out = np.asarray(nbi.remove_background(make_image(arr), tolerance=30))
        assert out[100, 100, 3] == 255

    def test_pale_subject_on_white_not_eaten(self):
        # Off-white goose on a white background: the flat-background tolerance
        # must stay tight enough that flood fill cannot leak through the edge.
        img = subject_on_background((255, 255, 255), (232, 230, 226))
        out = np.asarray(nbi.remove_background(img, tolerance=30))
        assert out[100, 100, 3] == 255
        assert out[0, 0, 3] == 0

    def test_subject_touching_border_does_not_poison_seeds(self):
        # A perch running off the bottom edge (like the eagle's branch) must
        # not cause the subject's colors to be seeded as background.
        img = subject_on_background((255, 255, 255), (120, 90, 60))
        arr = np.asarray(img).copy()
        arr[140:, 95:105, :3] = (120, 90, 60)  # branch to bottom edge
        out = np.asarray(nbi.remove_background(make_image(arr), tolerance=30))
        assert out[100, 100, 3] == 255  # subject kept
        assert out[199, 100, 3] == 255  # branch kept
        assert out[0, 0, 3] == 0  # background removed

    def test_already_transparent_image_untouched(self):
        arr = np.zeros((100, 100, 4), dtype=np.uint8)
        arr[40:60, 40:60] = (200, 100, 50, 255)
        out = np.asarray(nbi.remove_background(make_image(arr), tolerance=30))
        np.testing.assert_array_equal(out, arr)


class TestNormalize:
    def test_output_size_and_mode(self):
        arr = np.zeros((300, 300, 4), dtype=np.uint8)
        arr[60:140, 60:140] = (200, 100, 50, 255)
        out = nbi.normalize(make_image(arr), size=1000)
        assert out.size == (1000, 1000)
        assert out.mode == "RGBA"

    def test_small_image_not_upscaled(self):
        arr = np.zeros((50, 30, 4), dtype=np.uint8)
        arr[10:40, 5:25] = (200, 100, 50, 255)
        out = nbi.normalize(make_image(arr), size=1000)
        alpha = np.asarray(out)[..., 3]
        ys, xs = np.nonzero(alpha)
        # Content keeps its original pixel dimensions (30x20 subject box).
        assert ys.max() - ys.min() + 1 == 30
        assert xs.max() - xs.min() + 1 == 20

    def test_oversized_image_downscaled_to_fit(self):
        arr = np.zeros((1500, 2400, 4), dtype=np.uint8)
        arr[...] = (200, 100, 50, 255)
        out = nbi.normalize(make_image(arr), size=1000)
        alpha = np.asarray(out)[..., 3]
        ys, xs = np.nonzero(alpha > 0)
        assert xs.max() - xs.min() + 1 == 1000
        assert ys.max() - ys.min() + 1 <= 1000

    def test_content_centered(self):
        arr = np.zeros((100, 100, 4), dtype=np.uint8)
        arr[10:30, 70:90] = (200, 100, 50, 255)  # off-center subject
        out = nbi.normalize(make_image(arr), size=1000)
        alpha = np.asarray(out)[..., 3]
        ys, xs = np.nonzero(alpha)
        cy = (ys.min() + ys.max()) / 2
        cx = (xs.min() + xs.max()) / 2
        assert abs(cy - 499.5) <= 1 and abs(cx - 499.5) <= 1


class TestEndToEnd:
    def test_cli_processes_directory(self, tmp_path, monkeypatch):
        src = tmp_path / "in"
        out_dir = tmp_path / "out"
        src.mkdir()
        subject_on_background((255, 255, 255), (80, 50, 30)).convert("RGB").save(
            src / "bird.jpg"
        )
        monkeypatch.setattr(
            sys, "argv",
            ["prog", "--dir", str(src), "--out", str(out_dir), "--size", "500"],
        )
        assert nbi.main() == 0
        result = Image.open(out_dir / "bird.png")
        assert result.size == (500, 500)
        assert result.mode == "RGBA"
        assert (src / "bird.jpg").exists()  # originals kept when --out differs

    def test_in_place_replaces_non_png(self, tmp_path, monkeypatch):
        subject_on_background((255, 255, 255), (80, 50, 30)).convert("RGB").save(
            tmp_path / "bird.jpg"
        )
        monkeypatch.setattr(sys, "argv", ["prog", "--dir", str(tmp_path)])
        assert nbi.main() == 0
        assert not (tmp_path / "bird.jpg").exists()
        assert (tmp_path / "bird.png").exists()

    def test_empty_directory_errors(self, tmp_path, monkeypatch):
        monkeypatch.setattr(sys, "argv", ["prog", "--dir", str(tmp_path)])
        assert nbi.main() == 1
