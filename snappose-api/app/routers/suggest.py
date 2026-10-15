"""AI pose suggestion: POST /api/suggest-poses (mobile, one scene per call, paged) plus the older
/api/suggest-pose & /api/match-image* endpoints used by the web app."""
import base64
import io
import random
from typing import Literal, Optional

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.clip_engine import embed_image, embed_text
from app.database import get_db
from app.models import Category, Pose
from app.schemas import EnvironmentScore, MatchImageResponse, PoseOut

router = APIRouter(prefix="/api", tags=["suggest"])

DEFAULT_BATCH_SIZE = 3
MIN_POSES_PER_SCENE = 3  # a category needs at least this many poses to be detected as the scene
SCENE_TOP_N = 3  # a category's image score = mean similarity of its N closest poses
SELFIE_SLUG = "selfie"

# Scene detection blends two signals, each turned into probabilities over the candidate scenes:
# - text: zero-shot CLIP prompts describing the *place*, so the background decides the scene;
# - image: similarity to the category's pose photos, which also carries the person/pose.
# Measured on the DB pose photos (leave-one-out), the 50/50 blend beat either signal alone:
# back camera 100% vs 95% (image only) / 97% (text only). Softmax scales match CLIP's logit
# scale for text and spread the much tighter image-image similarities.
SCENE_TEXT_WEIGHT = 0.5
SCENE_TEXT_SCALE = 100.0
SCENE_IMAGE_SCALE = 50.0

# Selfie is a framing (close-up, arm's length), not a place, so it isn't scored as a scene: a
# beach selfie would always lose to "beach". With the front camera it's decided first, as a yes/no
# question blending (text) close-up vs full-body prompts and (image) selfie poses vs the best other
# category. Measured on the DB pose photos: selfies found 34/38 (26/38 when competing as a scene)
# with 1/93 other photos wrongly called selfie. Lowering the threshold to 0.2 finds 36/38 but
# quadruples the false selfies, and the front camera isn't always a selfie.
SELFIE_THRESHOLD = 0.4
_SELFIE_PROMPTS = [
    "a close-up selfie of a person's face",
    "a selfie taken at arm's length with a phone",
    "a close-up portrait where the face fills the frame",
]
_NOT_SELFIE_PROMPTS = [
    "a full body photo of a person standing",
    "a photo of a person taken from a distance",
    "a person posing with the whole body visible in the scene",
]
_selfie_anchors: tuple[np.ndarray, np.ndarray] | None = None

# Keyed by category slug. A category without prompts gets no text score, so it can only win on
# image similarity — add prompts here when a new category gets poses.
_SCENE_PROMPTS = {
    "ca-phe": [
        "a photo taken inside a coffee shop",
        "a person sitting at a cafe table with a cup of coffee",
        "a cozy cafe interior with tables and chairs",
    ],
    "cong-vien": [
        "a photo taken in a park with trees and grass",
        "a person standing in a green park",
        "an outdoor park with a garden path and plants",
    ],
    "bien": [
        "a photo taken on a beach with sand and sea",
        "a person at the seaside with ocean waves",
        "a tropical beach with blue water and sky",
    ],
    "pho": [
        "a photo taken on a city street",
        "a person walking on an urban sidewalk with buildings",
    ],
    "nha-hang": [
        "a photo taken inside a restaurant",
        "a person sitting at a dining table in a restaurant",
    ],
    "studio": [
        "a studio photo with a plain backdrop",
        "a professional photo shoot in a studio with lighting",
    ],
    "dem": [
        "a photo taken at night with city lights",
        "a person outdoors at night under street lights",
    ],
    "du-lich": [
        "a tourist posing at a famous landmark",
        "a travel photo at a scenic tourist destination",
    ],
    "thoi-trang": [
        "a fashion photo shoot of a model",
        "a stylish outfit photo for a fashion magazine",
    ],
    "ngoai-troi": [
        "an outdoor photo in nature",
        "a person outdoors in natural scenery",
    ],
}
_scene_anchors: dict[str, np.ndarray] | None = None

# Zero-shot gender detection — reuses the already-loaded CLIP model's text tower,
# no extra model needed. Anchors are cached after the first use (see warm_up).
_GENDER_PROMPTS = {
    "nam": ["a photo of a man", "a photo of a male person", "a photo of a boy"],
    "nu": ["a photo of a woman", "a photo of a female person", "a photo of a girl"],
}
_gender_anchors: dict[str, np.ndarray] | None = None


def _text_anchor(prompts: list[str]) -> np.ndarray:
    """Normalised mean of the prompts' text embeddings."""
    vecs = np.array([embed_text(p) for p in prompts], dtype=np.float32)
    mean = vecs.mean(axis=0)
    return mean / np.linalg.norm(mean)


def _get_gender_anchors() -> dict[str, np.ndarray]:
    global _gender_anchors
    if _gender_anchors is None:
        _gender_anchors = {label: _text_anchor(prompts) for label, prompts in _GENDER_PROMPTS.items()}
    return _gender_anchors


def _get_scene_anchors() -> dict[str, np.ndarray]:
    global _scene_anchors
    if _scene_anchors is None:
        _scene_anchors = {slug: _text_anchor(prompts) for slug, prompts in _SCENE_PROMPTS.items()}
    return _scene_anchors


def _get_selfie_anchors() -> tuple[np.ndarray, np.ndarray]:
    global _selfie_anchors
    if _selfie_anchors is None:
        _selfie_anchors = (_text_anchor(_SELFIE_PROMPTS), _text_anchor(_NOT_SELFIE_PROMPTS))
    return _selfie_anchors


def _softmax(scores: dict[int, float], scale: float) -> dict[int, float]:
    if not scores:
        return {}
    keys = list(scores)
    x = np.array([scores[k] for k in keys], dtype=np.float64) * scale
    e = np.exp(x - x.max())
    return dict(zip(keys, (e / e.sum()).tolist()))


def warm_up() -> None:
    """Loads CLIP and every text anchor so the first suggestion request isn't slow."""
    _get_gender_anchors()
    _get_scene_anchors()
    _get_selfie_anchors()


def _detect_gender(query_vec: list[float]) -> str:
    anchors = _get_gender_anchors()
    q = np.array(query_vec, dtype=np.float32)
    scores = {label: float(np.dot(q, vec)) for label, vec in anchors.items()}
    return max(scores, key=scores.get)


def _filter_by_gender(poses: list[Pose], gender: str) -> list[Pose]:
    """Hard-filter by detected gender — CLIP's image-image similarity alone doesn't reliably weigh
    gender, so this is a deterministic pre-filter rather than leaving it to the ranking. Poses
    without a gender label (not yet auto-labeled) stay eligible so nothing gets excluded by missing
    metadata, and if filtering would leave nothing, fall back to the unfiltered pool."""
    gendered = [p for p in poses if p.gender == gender or p.gender is None]
    return gendered or poses


def _rank_by_similarity(query_vec: list[float], poses: list[Pose]) -> list[tuple[float, Pose]]:
    """(similarity, pose) pairs, most similar first. Embeddings are L2-normalised, so dot = cosine."""
    matrix = np.array([p.embedding for p in poses], dtype=np.float32)
    scores = matrix @ np.array(query_vec, dtype=np.float32)
    order = np.argsort(-scores)
    return [(float(scores[i]), poses[i]) for i in order]


class SuggestRequest(BaseModel):
    image: str  # base64 data-URL or raw base64
    category_id: Optional[int] = None
    top_k: int = 5


def _decode_image_from_base64(data: str) -> Image.Image:
    """Decode a base64 (or data-URL) string into a PIL Image."""
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _process_image_matching(img: Image.Image, category_id: Optional[int], top_k: int, db: Session):
    query_vec = embed_image(img)
    detected_gender = _detect_gender(query_vec)

    # 1. Fetch active poses that have embeddings
    q = db.query(Pose).options(joinedload(Pose.category)).filter(Pose.is_active.is_(True), Pose.embedding.isnot(None))
    if category_id is not None:
        cat_poses = q.filter(Pose.category_id == category_id).all()
        poses = cat_poses if cat_poses else q.all()
    else:
        poses = q.all()

    if not poses:
        raise HTTPException(status_code=404, detail="Chưa có pose nào có dữ liệu embedding trong hệ thống")

    # 2. Gender pre-filter, then rank poses by cosine similarity descending
    scored = _rank_by_similarity(query_vec, _filter_by_gender(poses, detected_gender))

    # Build PoseOut with similarity
    results: list[PoseOut] = []
    for score, p in scored[:top_k]:
        out = PoseOut.model_validate(p)
        out.similarity = round(score, 4)
        results.append(out)

    # 3. Aggregate environment / category scores
    cat_scores: dict[int, list[float]] = {}
    cat_map: dict[int, Category] = {}
    for score, p in scored:
        if p.category_id not in cat_scores:
            cat_scores[p.category_id] = []
            cat_map[p.category_id] = p.category
        cat_scores[p.category_id].append(score)

    env_list: list[EnvironmentScore] = []
    for cat_id, scores in cat_scores.items():
        cat = cat_map.get(cat_id)
        if not cat:
            continue
        max_s = max(scores)
        conf_pct = round(max(0.0, min(100.0, ((max_s + 1.0) / 2.0) * 100)), 1)
        env_list.append(
            EnvironmentScore(
                id=cat.id,
                name=cat.name,
                slug=cat.slug,
                score=round(max_s, 4),
                confidence_percent=conf_pct,
            )
        )
    env_list.sort(key=lambda e: e.score, reverse=True)
    detected = env_list[0] if env_list else None

    return results, detected, env_list, detected_gender


class SuggestBatchRequest(BaseModel):
    image: str  # base64 data-URL or raw base64
    exclude_ids: list[int] = []  # poses the client already showed for the current scene
    batch_size: int = DEFAULT_BATCH_SIZE
    # Selfie poses are only offered with the front camera; omitted means selfie stays allowed.
    facing: Optional[Literal["front", "back"]] = None


class SuggestBatchResponse(BaseModel):
    scene: EnvironmentScore | None = None  # None when no category has enough poses (random fallback)
    detected_gender: str | None = None
    reset: bool = False  # True when the scene ran out of fresh poses and the list restarted
    matches: list[PoseOut] = []


def _image_score(items: list[tuple[float, Pose]]) -> float:
    """Mean similarity of a category's closest poses; `items` is sorted by similarity descending."""
    top = [score for score, _ in items[:SCENE_TOP_N]]
    return sum(top) / len(top)


def _pick_scene(query_vec: list[float], eligible: dict[int, list[tuple[float, Pose]]]) -> tuple[int, float]:
    """Returns (category id, blended probability) of the most likely scene among `eligible`."""
    anchors = _get_scene_anchors()
    q = np.array(query_vec, dtype=np.float32)
    slugs = {cid: items[0][1].category.slug for cid, items in eligible.items()}
    p_text = _softmax(
        {cid: float(np.dot(q, anchors[slug])) for cid, slug in slugs.items() if slug in anchors},
        SCENE_TEXT_SCALE,
    )
    p_image = _softmax({cid: _image_score(items) for cid, items in eligible.items()}, SCENE_IMAGE_SCALE)
    text_weight = SCENE_TEXT_WEIGHT if p_text else 0.0
    blended = {
        cid: text_weight * p_text.get(cid, 0.0) + (1 - text_weight) * p_image[cid] for cid in eligible
    }
    best = max(blended, key=blended.get)
    return best, blended[best]


def _selfie_probability(
    query_vec: list[float],
    selfie_items: list[tuple[float, Pose]],
    other: dict[int, list[tuple[float, Pose]]],
) -> float:
    """Probability the frame is a selfie: close-up vs full-body text, selfie vs best other poses."""
    selfie_anchor, not_selfie_anchor = _get_selfie_anchors()
    q = np.array(query_vec, dtype=np.float32)
    p_text = _softmax({1: float(np.dot(q, selfie_anchor)), 0: float(np.dot(q, not_selfie_anchor))}, SCENE_TEXT_SCALE)
    best_other = max((_image_score(items) for items in other.values()), default=None)
    if best_other is None:
        return p_text[1]
    p_image = _softmax({1: _image_score(selfie_items), 0: best_other}, SCENE_IMAGE_SCALE)
    return 0.5 * p_text[1] + 0.5 * p_image[1]


def _suggest_batch(
    img: Image.Image,
    exclude_ids: list[int],
    batch_size: int,
    facing: Optional[str],
    db: Session,
) -> SuggestBatchResponse:
    query_vec = embed_image(img)
    detected_gender = _detect_gender(query_vec)

    poses = (
        db.query(Pose)
        .options(joinedload(Pose.category))
        .filter(Pose.is_active.is_(True), Pose.embedding.isnot(None))
        .all()
    )
    if not poses:
        raise HTTPException(status_code=404, detail="Chưa có pose nào có dữ liệu embedding trong hệ thống")

    poses = _filter_by_gender(poses, detected_gender)
    if facing == "back":
        poses = [p for p in poses if p.category.slug != SELFIE_SLUG] or poses
    scored = _rank_by_similarity(query_vec, poses)

    by_category: dict[int, list[tuple[float, Pose]]] = {}
    for item in scored:
        by_category.setdefault(item[1].category_id, []).append(item)

    # Selfie check first (front camera only, see SELFIE_THRESHOLD), then the scene among the real
    # places (see _pick_scene), then the poses inside it ranked by image similarity.
    # Categories with fewer than MIN_POSES_PER_SCENE poses can't fill a batch, so they never
    # compete. The scene is picked on the full pool (not minus exclude_ids) so it stays stable
    # between presses; exclusion only affects which poses of that scene are returned.
    eligible = {cid: items for cid, items in by_category.items() if len(items) >= MIN_POSES_PER_SCENE}
    selfie_cid = next((cid for cid, items in eligible.items() if items[0][1].category.slug == SELFIE_SLUG), None)
    places = {cid: items for cid, items in eligible.items() if cid != selfie_cid}
    scene: EnvironmentScore | None = None
    if eligible:
        scene_cid = None
        if selfie_cid is not None:
            selfie_prob = _selfie_probability(query_vec, eligible[selfie_cid], places)
            if selfie_prob >= SELFIE_THRESHOLD or not places:
                scene_cid, scene_prob = selfie_cid, selfie_prob
        if scene_cid is None:
            scene_cid, scene_prob = _pick_scene(query_vec, places)
        pool = eligible[scene_cid]
        cat = pool[0][1].category
        scene = EnvironmentScore(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            score=round(scene_prob, 4),
            confidence_percent=round(scene_prob * 100, 1),
        )
    else:
        # No category has enough poses: fall back to random poses across everything.
        pool = scored[:]
        random.shuffle(pool)

    n = max(1, min(batch_size, 10))
    excluded = set(exclude_ids)
    fresh = [item for item in pool if item[1].id not in excluded]
    batch = fresh[:n]
    reset = False
    if len(batch) < n:
        # Not enough unseen poses left: restart from the best matches, topping up the batch.
        reset = True
        taken = {p.id for _, p in batch}
        batch += [item for item in pool if item[1].id not in taken][: n - len(batch)]

    matches: list[PoseOut] = []
    for score, p in batch:
        out = PoseOut.model_validate(p)
        out.similarity = round(score, 4)
        matches.append(out)

    return SuggestBatchResponse(scene=scene, detected_gender=detected_gender, reset=reset, matches=matches)


@router.post("/suggest-poses", response_model=SuggestBatchResponse)
def suggest_poses(body: SuggestBatchRequest, db: Session = Depends(get_db)):
    """One scene per call; successive calls with the growing `exclude_ids` page through that scene."""
    try:
        img = _decode_image_from_base64(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    return _suggest_batch(img, body.exclude_ids, body.batch_size, body.facing, db)


@router.post("/suggest-pose", response_model=list[PoseOut])
def suggest_pose(body: SuggestRequest, db: Session = Depends(get_db)):
    try:
        img = _decode_image_from_base64(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    k = max(1, min(body.top_k, 20))
    matches, _, _, _ = _process_image_matching(img, body.category_id, k, db)
    return matches


@router.post("/match-image", response_model=MatchImageResponse)
def match_image(body: SuggestRequest, db: Session = Depends(get_db)):
    """Analyze uploaded base64/dataURL image: identify environment and return most related poses."""
    try:
        img = _decode_image_from_base64(body.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    k = max(1, min(body.top_k, 30))
    matches, detected_env, env_list, detected_gender = _process_image_matching(img, body.category_id, k, db)

    return MatchImageResponse(
        detected_environment=detected_env,
        detected_gender=detected_gender,
        environments=env_list,
        matches=matches,
    )


@router.post("/match-image-file", response_model=MatchImageResponse)
async def match_image_file(file: UploadFile = File(...), top_k: int = Form(10), db: Session = Depends(get_db)):
    """Analyze an uploaded multipart image file."""
    content = await file.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Định dạng file ảnh không hợp lệ")

    k = max(1, min(top_k, 30))
    matches, detected_env, env_list, detected_gender = _process_image_matching(img, None, k, db)

    return MatchImageResponse(
        detected_environment=detected_env,
        detected_gender=detected_gender,
        environments=env_list,
        matches=matches,
    )
