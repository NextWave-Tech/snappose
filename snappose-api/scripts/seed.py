"""Seed Postgres + MinIO from local poses/ directory.

Folder convention:
  poses/
    {category-slug}/
      {prefix}-photo.{jpg|png|webp}   (hoặc dùng _ thay -)
      {prefix}-skeleton.{jpg|png|webp}

  {prefix}-photo/{prefix}-skeleton cũng được phép nằm sâu hơn 1 cấp, vd đã
  gom theo giới tính bằng scripts/sort_poses_by_gender.py:
    poses/{category-slug}/nam/{prefix}-photo.ext
    poses/{category-slug}/nu/{prefix}-photo.ext

  Folder name = category slug (vd: bien, ca-phe, cafe...)
  Nếu folder name chưa có trong CATEGORY_NAMES → dùng folder name làm tên hiển thị.

Run:
  python -m scripts.seed              # incremental: chỉ thêm pose mới (theo tên), an toàn chạy lại nhiều lần
  python -m scripts.seed --reset      # drop poses + categories, seed lại từ đầu
"""
import os
import re
import sys
import argparse
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import AdminUser, Category, Pose
from app import storage

CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

CATEGORY_NAMES: dict[str, str] = {
    "ngoai-troi": "Ngoài trời",
    "ca-phe": "Cà phê",
    "bien": "Biển",
    "pho": "Phố",
    "studio": "Studio",
    "cong-vien": "Công viên",
    "nha-hang": "Nhà hàng",
    "du-lich": "Du lịch",
    "thoi-trang": "Thời trang",
    "dem": "Đêm",
    "selfie": "Selfie",
}


def scan_poses(poses_dir: Path) -> dict[str, list[dict]]:
    """Return {category_slug: [{name, photo_path, skeleton_path}, ...]} sorted by prefix."""
    result: dict[str, list[dict]] = {}

    for cat_dir in sorted(poses_dir.iterdir()):
        if not cat_dir.is_dir():
            continue
        slug = cat_dir.name
        pairs: dict[str, dict] = defaultdict(dict)

        for f in cat_dir.rglob("*"):
            if not f.is_file():
                continue
            ext = f.suffix.lower()
            if ext not in CONTENT_TYPES:
                continue
            # hỗ trợ cả dấu - và _ làm separator: 01-photo, 01_photo
            m = re.match(r'^(.+?)[-_](photo|skeleton)$', f.stem, re.IGNORECASE)
            if not m:
                print(f"  WARNING: {f.name} — tên không đúng format {{prefix}}-photo/skeleton, bỏ qua")
                continue
            prefix, kind = m.group(1), m.group(2).lower()
            if kind in ("photo", "skeleton"):
                pairs[prefix][kind] = f

        valid = []
        for prefix in sorted(pairs):
            p = pairs[prefix]
            if "photo" not in p or "skeleton" not in p:
                missing = "skeleton" if "photo" in p else "photo"
                print(f"  WARNING: {slug}/{prefix} thiếu {missing}, bỏ qua cặp này")
                continue
            valid.append({
                "name": f"Pose {prefix}",
                "photo_path": p["photo"],
                "skeleton_path": p["skeleton"],
            })

        if valid:
            result[slug] = valid

    return result


def upload_pose_images(slug: str, pose: dict) -> tuple[str, str]:
    photo_path: Path = pose["photo_path"]
    skeleton_path: Path = pose["skeleton_path"]

    photo_ext = photo_path.suffix.lower()
    skeleton_ext = skeleton_path.suffix.lower()

    photo_obj = f"poses/{slug}/{photo_path.stem}{photo_ext}"
    skeleton_obj = f"poses/{slug}/{skeleton_path.stem}{skeleton_ext}"

    photo_url = storage.upload(photo_obj, photo_path.read_bytes(), CONTENT_TYPES[photo_ext])
    skeleton_url = storage.upload(skeleton_obj, skeleton_path.read_bytes(), CONTENT_TYPES[skeleton_ext])

    return photo_url, skeleton_url


def run(poses_dir: Path, reset: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Admin user
        if db.query(AdminUser).count() == 0:
            db.add(AdminUser(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            ))
            db.commit()
            print(f"Created admin: {settings.admin_username}")

        # Reset nếu cần — drop + recreate để đảm bảo schema mới nhất
        if reset:
            db.close()
            Base.metadata.drop_all(bind=engine, tables=[Pose.__table__, Category.__table__])
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            print("Reset: đã drop + recreate bảng poses + categories")

        if not poses_dir.exists():
            print(f"Không tìm thấy thư mục poses: {poses_dir.resolve()}")
            if db.query(Category).count() == 0:
                print("Tạo categories trống (không có ảnh)")
                for i, (slug, name) in enumerate(CATEGORY_NAMES.items()):
                    db.add(Category(slug=slug, name=name, sort_order=i))
                db.commit()
            return

        # Scan ảnh
        pose_data = scan_poses(poses_dir)
        storage.ensure_bucket()

        # Merge: categories từ CATEGORY_NAMES + các folder thực tế chưa có trong dict
        all_slugs: list[tuple[str, str]] = list(CATEGORY_NAMES.items())
        for folder_slug in pose_data:
            if folder_slug not in CATEGORY_NAMES:
                all_slugs.append((folder_slug, folder_slug))  # dùng slug làm tên tạm

        # Get-or-create categories, insert CHỈ pose chưa có trong DB (an toàn chạy lại nhiều lần —
        # dùng cho việc "thêm dần" ảnh mới, không xoá/không đụng pose cũ)
        total_new = 0
        total_skipped = 0
        for i, (slug, name) in enumerate(all_slugs):
            cat = db.query(Category).filter(Category.slug == slug).first()
            if cat is None:
                cat = Category(slug=slug, name=name, sort_order=i)
                db.add(cat)
                db.flush()

            existing_names = {
                p.name for p in db.query(Pose).filter(Pose.category_id == cat.id)
            }
            next_sort = db.query(Pose).filter(Pose.category_id == cat.id).count()

            for pose in pose_data.get(slug, []):
                if pose["name"] in existing_names:
                    total_skipped += 1
                    continue
                print(f"  Uploading {slug}/{pose['name']}...", end=" ", flush=True)
                photo_url, skeleton_url = upload_pose_images(slug, pose)
                db.add(Pose(
                    category_id=cat.id,
                    name=pose["name"],
                    photo_url=photo_url,
                    skeleton_url=skeleton_url,
                    sort_order=next_sort,
                ))
                next_sort += 1
                total_new += 1
                print("OK")

        db.commit()
        print(f"\nDone: +{total_new} pose mới, bỏ qua {total_skipped} pose đã có sẵn")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Xoá data cũ và seed lại")
    parser.add_argument("--poses-dir", default="poses", help="Thư mục chứa ảnh (mặc định: poses/)")
    args = parser.parse_args()

    run(Path(args.poses_dir), reset=args.reset)
