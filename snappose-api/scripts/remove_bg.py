"""Xoá nền ảnh skeleton, lưu PNG trong suốt.

Tự nhận diện loại nền:
  - Nền đen  → dùng luminance làm alpha (nhanh, sắc nét)
  - Nền khác → dùng rembg AI

Run: python -m scripts.remove_bg              # ghi đè ảnh gốc
     python -m scripts.remove_bg --preview    # lưu *_preview.png để kiểm tra
     python -m scripts.remove_bg --skip ca-phe/01-skeleton.png
"""
import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image


def is_dark_bg(arr: np.ndarray, sample_size: int = 200) -> bool:
    """Lấy mẫu góc ảnh — nếu trung bình sáng < 30 là nền tối."""
    h, w = arr.shape[:2]
    corners = np.concatenate([
        arr[:sample_size, :sample_size],
        arr[:sample_size, w - sample_size:],
        arr[h - sample_size:, :sample_size],
        arr[h - sample_size:, w - sample_size:],
    ])
    return corners[:, :, :3].mean() < 30


def remove_dark_bg(arr: np.ndarray) -> np.ndarray:
    """Nền đen: luminance → alpha."""
    r, g, b = arr[:, :, 0].astype(float), arr[:, :, 1].astype(float), arr[:, :, 2].astype(float)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    arr[:, :, 3] = np.clip(lum, 0, 255).astype(np.uint8)
    return arr


def remove_other_bg(data: bytes) -> bytes:
    """Nền màu khác: dùng rembg AI."""
    from rembg import remove, new_session
    if not hasattr(remove_other_bg, "_session"):
        print("    (load AI model...)")
        remove_other_bg._session = new_session("u2net")
    return remove(data, session=remove_other_bg._session)


def process(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)

    if is_dark_bg(arr):
        print(f"  [đen→lum] {path.name}")
        arr = remove_dark_bg(arr)
        Image.fromarray(arr, "RGBA").save(path.with_suffix(".png"))
    else:
        print(f"  [AI rembg] {path.name}")
        result = remove_other_bg(path.read_bytes())
        path.with_suffix(".png").write_bytes(result)


def run(poses_dir: Path, preview: bool, skip: list[str]) -> None:
    skeletons = [
        f for f in poses_dir.rglob("*skeleton*")
        if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
        and "_preview" not in f.stem
        and "demo" not in str(f)
    ]

    skip_set = set(s.replace("\\", "/") for s in skip)

    print(f"Tìm thấy {len(skeletons)} skeleton...")
    for f in skeletons:
        rel = str(f.relative_to(poses_dir)).replace("\\", "/")
        if rel in skip_set:
            print(f"  [SKIP]     {f.name}")
            continue
        target = f.with_stem(f.stem + "_preview") if preview else f
        if preview:
            shutil.copy(f, target)
        process(target)

    print(f"\nXong! Chạy lại seed:")
    print("  python -m scripts.seed --reset")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--poses-dir", default="poses")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--skip", nargs="*", default=[], help="Đường dẫn relative cần bỏ qua, vd: ca-phe/01-skeleton.png")
    args = parser.parse_args()
    run(Path(args.poses_dir), preview=args.preview, skip=args.skip)
