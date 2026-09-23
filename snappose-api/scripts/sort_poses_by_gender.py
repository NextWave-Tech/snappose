"""Sắp xếp lại file ảnh local trong poses/{category}/ vào 2 thư mục con nam/ và nu/,
dựa theo cột Pose.gender đã gán (xem scripts/label_gender.py).

Chỉ động vào file trên đĩa (raw source), KHÔNG đụng tới MinIO/DB — photo_url/
skeleton_url trong DB đã trỏ thẳng vào MinIO nên không bị ảnh hưởng gì.

Run:
  python -m scripts.sort_poses_by_gender
"""
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models import Category, Pose

CONTENT_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
NAME_RE = re.compile(r"^(.+?)[-_](photo|skeleton)$", re.IGNORECASE)


def run(poses_dir: Path) -> None:
    db = SessionLocal()
    try:
        for cat_dir in sorted(poses_dir.iterdir()):
            if not cat_dir.is_dir():
                continue
            slug = cat_dir.name
            cat = db.query(Category).filter(Category.slug == slug).first()
            if not cat:
                continue

            gender_by_name = {p.name: p.gender for p in db.query(Pose).filter(Pose.category_id == cat.id)}

            # Chỉ xét file nằm TRỰC TIẾP trong category dir (chưa được gom)
            pairs: dict[str, list[Path]] = defaultdict(list)
            for f in cat_dir.iterdir():
                if not f.is_file() or f.suffix.lower() not in CONTENT_EXTS:
                    continue
                m = NAME_RE.match(f.stem)
                if not m:
                    continue
                prefix = m.group(1)
                pairs[prefix].append(f)

            if not pairs:
                continue

            print(f"\n=== {slug}: {len(pairs)} pose cần sắp xếp ===")
            moved = 0
            for prefix, files in sorted(pairs.items()):
                pose_name = f"Pose {prefix}"
                gender = gender_by_name.get(pose_name)
                if gender not in ("nam", "nu"):
                    print(f"  BỎ QUA {pose_name}: chưa có nhãn gender hợp lệ ({gender!r})")
                    continue
                target_dir = cat_dir / gender
                target_dir.mkdir(exist_ok=True)
                for f in files:
                    dest = target_dir / f.name
                    f.rename(dest)
                    print(f"  {slug}/{f.name} -> {slug}/{gender}/{f.name}")
                moved += 1
            print(f"  Đã sắp xếp {moved}/{len(pairs)} pose.")
    finally:
        db.close()

    print("\nXong. Chạy lại: python -m scripts.seed (để xác nhận vẫn quét đúng, không tạo trùng)")


if __name__ == "__main__":
    run(Path("poses"))
