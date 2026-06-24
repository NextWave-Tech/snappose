from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import admin_auth, admin_categories, admin_poses, admin_upload, public

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SnapPose API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(admin_auth.router)
app.include_router(admin_categories.router)
app.include_router(admin_poses.router)
app.include_router(admin_upload.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
