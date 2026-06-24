# SnapPose — API (Backend)

FastAPI + PostgreSQL (local qua Docker Compose). Deploy chưa quyết định — chạy local trước.

## Chạy local

```bash
# 1. Khởi động Postgres local
docker compose up -d

# 2. Tạo virtualenv + cài deps
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

# 3. Tạo .env từ mẫu
cp .env.example .env

# 4. Seed dữ liệu demo (10 category x 10 pose placeholder + 1 admin user)
.venv/Scripts/python.exe scripts/seed.py

# 5. Chạy server
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

API chạy ở `http://localhost:8000`. Docs Swagger: `http://localhost:8000/docs`.

Tài khoản admin mặc định (đổi trong `.env`): `admin` / `changeme123`.

## Cấu trúc

- `app/models/` — SQLAlchemy models: Category, Pose, AdminUser
- `app/routers/public.py` — `GET /api/categories`, `GET /api/poses` (không cần auth)
- `app/routers/admin_*.py` — login (JWT) + CRUD category/pose + upload ảnh (lưu vào `uploads/`, serve qua `/uploads/...`)
- `scripts/seed.py` — seed 10 category x 10 pose demo, chạy lại an toàn (bỏ qua nếu đã có data)

## Lưu trữ ảnh

Giai đoạn local: ảnh upload qua admin panel lưu trực tiếp vào thư mục `uploads/` trên máy, serve qua FastAPI static files. Khi deploy thật sẽ chuyển sang storage cloud (Supabase Storage/S3/Cloudinary) — chưa quyết định, bàn riêng.

## Deploy

Chưa triển khai. `DATABASE_URL` trong `.env` là điểm duy nhất cần đổi khi chuyển sang DB managed — code không phụ thuộc vào việc DB chạy local hay cloud.
