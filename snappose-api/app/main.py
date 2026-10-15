import threading
from contextlib import asynccontextmanager
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load CLIP in the background so startup isn't blocked but the first suggestion is fast.
    threading.Thread(target=suggest.warm_up, daemon=True).start()
    async with httpx.AsyncClient() as client:
        app.state.http = client
        yield


app = FastAPI(title="SnapPose API", lifespan=lifespan)

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
async def proxy_minio(path: str, request: Request):
    url = f"http://{settings.minio_endpoint}/snappose/{path}"
    r = await request.app.state.http.get(url)
    # Pose photos/skeletons are fetched on every suggestion; letting clients cache them for a day
    # avoids re-downloading the same images (expensive over a tunnel or mobile data).
    headers = {"Cache-Control": "public, max-age=86400"} if r.status_code == 200 else None
    return Response(
        content=r.content,
        status_code=r.status_code,
        media_type=r.headers.get("content-type", "image/png"),
        headers=headers,
    )


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

