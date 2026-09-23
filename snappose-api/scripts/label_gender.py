"""Auto-gán nhãn giới tính (nam/nu) cho pose bằng CLIP zero-shot text-image similarity.

Không cần tải lại ảnh — dùng luôn embedding ảnh đã tính sẵn (Pose.embedding) so với
embedding của vài câu prompt mô tả nam/nữ (cùng không gian vector CLIP).

Incremental mặc định: chỉ gán cho pose chưa có gender.
Run:
  python -m scripts.label_gender            # chỉ pose chưa gán
  python -m scripts.label_gender --all       # gán lại toàn bộ
"""
import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.clip_engine import embed_text
from app.database import SessionLocal
from app.models import Pose

PROMPTS_NAM = [
    "a photo of a man",
    "a photo of a male person",
    "a photo of a boy",
]
PROMPTS_NU = [
    "a photo of a woman",
    "a photo of a female person",
    "a photo of a girl",
]

LOW_CONFIDENCE_MARGIN = 0.02  # dưới ngưỡng này -> cần người soát lại


def _anchor_vector(prompts: list[str]) -> np.ndarray:
    vecs = np.array([embed_text(p) for p in prompts], dtype=np.float32)
    mean = vecs.mean(axis=0)
    return mean / np.linalg.norm(mean)


def run(relabel_all: bool = False) -> None:
    print("Đang tính vector anchor cho 'nam' và 'nu'...")
    nam_vec = _anchor_vector(PROMPTS_NAM)
    nu_vec = _anchor_vector(PROMPTS_NU)

    db = SessionLocal()
    try:
        query = db.query(Pose).filter(Pose.is_active.is_(True), Pose.embedding.isnot(None))
        if not relabel_all:
            query = query.filter(Pose.gender.is_(None))
        poses = query.order_by(Pose.category_id, Pose.sort_order).all()

        if not poses:
            print("Không có pose nào cần gán nhãn.")
            return

        print(f"Đang gán nhãn cho {len(poses)} pose...\n")
        results = []
        for pose in poses:
            emb = np.array(pose.embedding, dtype=np.float32)
            score_nam = float(np.dot(emb, nam_vec))
            score_nu = float(np.dot(emb, nu_vec))
            margin = abs(score_nam - score_nu)
            label = "nam" if score_nam > score_nu else "nu"
            pose.gender = label
            results.append((pose, label, margin, score_nam, score_nu))
        db.commit()

        results.sort(key=lambda r: r[2])  # margin tăng dần -> ít chắc chắn nhất lên đầu

        low_conf = [r for r in results if r[2] < LOW_CONFIDENCE_MARGIN]
        print(f"Xong: {len(results)}/{len(results)} pose đã gán nhãn.")
        print(f"Phân bố: nam={sum(1 for r in results if r[1]=='nam')}, nu={sum(1 for r in results if r[1]=='nu')}")

        if low_conf:
            print(f"\n⚠️  {len(low_conf)} pose có độ tin cậy thấp (margin < {LOW_CONFIDENCE_MARGIN}) — nên soát lại tay:")
            for pose, label, margin, s_nam, s_nu in low_conf:
                print(f"  id={pose.id:<4} {pose.category_name:<12} {pose.name:<10} -> {label:<3} "
                      f"(nam={s_nam:.4f} nu={s_nu:.4f} margin={margin:.4f})  {pose.photo_url}")
        else:
            print("\nKhông có pose nào ở ngưỡng tin cậy thấp.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-label pose gender via CLIP zero-shot")
    parser.add_argument("--all", action="store_true", help="Gán lại nhãn cho toàn bộ pose")
    args = parser.parse_args()
    run(relabel_all=args.all)
