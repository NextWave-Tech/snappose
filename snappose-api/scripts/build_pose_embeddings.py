"""Build CLIP embeddings for poses in the database.

Incremental by default: only computes embeddings for poses where embedding IS NULL.
Run:
  python -m scripts.build_pose_embeddings           # only poses without embedding
  python -m scripts.build_pose_embeddings --all      # recompute all
"""
import argparse
import io
import os
import sys
from io import BytesIO

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.clip_engine import embed_image
from app.config import settings
from app.database import SessionLocal
from app.models import Pose
from app.storage import _client


def _fetch_pose_image(url: str) -> Image.Image:
    """Fetch pose image from MinIO or HTTP URL."""
    # MinIO stored URL format: /snappose/poses/...
    clean_url = url.lstrip("/")
    parts = clean_url.split("/", 1)
    if len(parts) == 2 and parts[0] == settings.minio_bucket:
        bucket = parts[0]
        object_name = parts[1]
        client = _client()
        resp = client.get_object(bucket, object_name)
        try:
            data = resp.read()
            return Image.open(BytesIO(data)).convert("RGB")
        finally:
            resp.close()
            resp.release_conn()

    # Fallback to HTTP download
    import httpx
    with httpx.Client(timeout=30.0) as http_client:
        r = http_client.get(url)
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")


def run(recompute_all: bool = False) -> None:
    db = SessionLocal()
    try:
        query = db.query(Pose).filter(Pose.is_active.is_(True))
        if not recompute_all:
            query = query.filter(Pose.embedding.is_(None))

        poses = query.order_by(Pose.category_id, Pose.sort_order).all()
        if not poses:
            print("No poses need embedding calculation.")
            return

        print(f"Calculating embeddings for {len(poses)} pose(s)...")
        success_count = 0
        for i, pose in enumerate(poses, 1):
            print(f"  [{i}/{len(poses)}] Pose id={pose.id} ({pose.name}) - {pose.photo_url}...", end=" ", flush=True)
            try:
                img = _fetch_pose_image(pose.photo_url)
                vec = embed_image(img)
                pose.embedding = vec
                db.commit()
                print("OK")
                success_count += 1
            except Exception as e:
                print(f"FAILED ({e})")
                db.rollback()

        print(f"\nDone: {success_count}/{len(poses)} embeddings successfully computed.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build CLIP embeddings for poses")
    parser.add_argument("--all", action="store_true", help="Recompute embeddings for all poses")
    args = parser.parse_args()
    run(recompute_all=args.all)
