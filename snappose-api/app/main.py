from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import admin_auth, admin_categories, admin_poses, admin_upload, dataset, public, suggest

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SnapPose API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(suggest.router)
app.include_router(dataset.router)
app.include_router(admin_auth.router)
app.include_router(admin_categories.router)
app.include_router(admin_poses.router)
app.include_router(admin_upload.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/snappose/{path:path}", include_in_schema=False)
async def proxy_minio(path: str):
    url = f"http://{settings.minio_endpoint}/snappose/{path}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
    return Response(content=r.content, media_type=r.headers.get("content-type", "image/png"))


_DIST = Path(__file__).parent.parent.parent / "snappose-web" / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")
    if (_DIST / "mediapipe").exists():
        app.mount("/mediapipe", StaticFiles(directory=_DIST / "mediapipe"), name="mediapipe")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        file_path = _DIST / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_DIST / "index.html")

