"""Singleton CLIP model — loaded once at server startup, reused across requests.
Supports Apple Silicon Metal (MPS) acceleration on macOS.
"""
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

_MODEL_NAME = "openai/clip-vit-base-patch32"
_model: CLIPModel | None = None
_processor: CLIPProcessor | None = None
_device: str = "cpu"


def _get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _ensure_loaded():
    global _model, _processor, _device
    if _model is None:
        _device = _get_device()
        print(f"[clip_engine] Loading {_MODEL_NAME} on device '{_device}' ...")
        _processor = CLIPProcessor.from_pretrained(_MODEL_NAME)
        _model = CLIPModel.from_pretrained(_MODEL_NAME).to(_device)
        _model.eval()
        print("[clip_engine] Model ready.")


def embed_image(image: Image.Image) -> list[float]:
    """Return a 512-dim embedding vector for a PIL Image."""
    _ensure_loaded()
    inputs = _processor(images=image, return_tensors="pt").to(_device)
    with torch.no_grad():
        out = _model.get_image_features(**inputs)
    features = out.pooler_output if hasattr(out, "pooler_output") else out
    # L2-normalise so cosine similarity = dot product
    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].cpu().tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors (both assumed already L2-normalised)."""
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    return float(np.dot(a_arr, b_arr))
