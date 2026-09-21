"""Đổi tên ảnh thô (kiểu `anh-2.jpg` + `anh-2-khung.jpg`) sang đúng quy ước
`{prefix}-photo.*` + `{prefix}-skeleton.*`, rồi tách nền đen cho ảnh skeleton
thành PNG trong suốt (tái dùng logic của scripts/remove_bg.py).

Chỉ xử lý cặp file có dạng: {name}.{ext} + {name}-khung.{ext}
(name không được kết thúc bằng "-khung" và không phải đã đúng chuẩn sẵn).

Run:
  python -m scripts.import_raw_poses
  python -m scripts.import_raw_poses --poses-dir poses
"""
import argparse
import re
from pathlib import Path

from scripts.remove_bg import is_dark_bg, remove_dark_bg
from PIL import Image
import numpy as np

RAW_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALREADY_OK_RE = re.compile(r"^\d+[-_](photo|skeleton)$", re.IGNORECASE)


def find_raw_pairs(cat_dir: Path) -> list[tuple[Path, Path]]:
    """Tìm cặp (photo_thô, khung_thô) chưa đúng chuẩn trong 1 category folder."""
    pairs = []
    for f in sorted(cat_dir.iterdir()):
        if not f.is_file() or f.suffix.lower() not in RAW_EXTS:
            continue
        stem = f.stem
        if stem.endswith("-khung") or stem.endswith("_khung"):
            continue
        if ALREADY_OK_RE.match(stem):
            continue  # đã đúng chuẩn rồi, bỏ qua
        khung_candidates = [
            cat_dir / f"{stem}-khung{f.suffix}",
            cat_dir / f"{stem}_khung{f.suffix}",
        ]
        khung = next((k for k in khung_candidates if k.exists()), None)
        if khung is None:
            print(f"  WARNING: {f.name} không có file khung tương ứng, bỏ qua")
            continue
        pairs.append((f, khung))
    return pairs


def next_prefix(cat_dir: Path) -> int:
    used = []
    for f in cat_dir.iterdir():
        m = re.match(r"^(\d+)[-_](photo|skeleton)$", f.stem, re.IGNORECASE)
        if m:
            used.append(int(m.group(1)))
    return (max(used) + 1) if used else 1


def convert_skeleton_to_transparent(path: Path) -> Path:
    """Nền đen -> alpha bằng luminance (giống remove_bg.py). Trả về path PNG mới, xoá file gốc."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    if is_dark_bg(arr):
        arr = remove_dark_bg(arr)
        png_path = path.with_suffix(".png")
        Image.fromarray(arr, "RGBA").save(png_path)
        print(f"  [đen->trong suốt] {path.name} -> {png_path.name}")
    else:
        from scripts.remove_bg import remove_other_bg
        png_path = path.with_suffix(".png")
        png_path.write_bytes(remove_other_bg(path.read_bytes()))
        print(f"  [AI rembg] {path.name} -> {png_path.name}")
    path.unlink()  # xoá file .jpg gốc (nền đen), chỉ giữ .png trong suốt
    return png_path


def run(poses_dir: Path) -> None:
    if not poses_dir.exists():
        print(f"Không tìm thấy: {poses_dir}")
        return

    for cat_dir in sorted(poses_dir.iterdir()):
        if not cat_dir.is_dir():
            continue
        pairs = find_raw_pairs(cat_dir)
        if not pairs:
            continue

        print(f"\n=== {cat_dir.name}: {len(pairs)} cặp ảnh thô ===")
        prefix = next_prefix(cat_dir)
        for photo_raw, khung_raw in pairs:
            new_prefix = f"{prefix:02d}"
            new_photo = cat_dir / f"{new_prefix}-photo{photo_raw.suffix.lower()}"
            new_khung = cat_dir / f"{new_prefix}-skeleton{khung_raw.suffix.lower()}"

            photo_raw.rename(new_photo)
            khung_raw.rename(new_khung)
            print(f"  {photo_raw.name} -> {new_photo.name}")
            print(f"  {khung_raw.name} -> {new_khung.name}")

            convert_skeleton_to_transparent(new_khung)
            prefix += 1

    print("\nXong. Chạy tiếp: python -m scripts.seed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--poses-dir", default="poses")
    args = parser.parse_args()
    run(Path(args.poses_dir))
