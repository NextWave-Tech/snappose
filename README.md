# SnapPose

Ứng dụng gợi ý tư thế chụp ảnh. Backend FastAPI + PostgreSQL + MinIO, Frontend React (Vite).

## Yêu cầu

- Python 3.11+
- Node.js 18+
- Docker Desktop
- [ngrok](https://ngrok.com/download) (để truy cập API từ điện thoại)

---

## 1. Khởi động DB + MinIO (Docker Compose)

```bash
cd snappose-api
docker compose up -d
```

Kiểm tra containers đang chạy:

```bash
docker compose ps
```

| Service    | Port             | Mục đích              |
|------------|------------------|-----------------------|
| PostgreSQL | `localhost:5432` | Database chính        |
| MinIO      | `localhost:9000` | Object storage (ảnh)  |
| MinIO UI   | `localhost:9001` | Console quản lý MinIO |

MinIO Console: truy cập `http://localhost:9001` với `minioadmin` / `minioadmin`.

---

## 2. Cài đặt Backend (API)

```bash
cd snappose-api

# Tạo virtual environment
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate

# Kích hoạt (macOS/Linux)
# source .venv/bin/activate

# Cài dependencies
pip install -r requirements.txt
```

### Cấu hình .env

```bash
cp .env.example .env
```

Nội dung mặc định của `.env`:

```env
DATABASE_URL=postgresql://snappose:snappose@localhost:5432/snappose
JWT_SECRET=change-me-to-a-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123
UPLOAD_DIR=uploads
CORS_ORIGINS=http://localhost:5173
```

> Khi dùng ngrok, bổ sung URL ngrok vào `CORS_ORIGINS` (xem bước 5).

### Chạy API

```bash
uvicorn app.main:app --reload --port 8000
```

API chạy tại `http://localhost:8000`.
Swagger docs: `http://localhost:8000/docs`.

---

## 3. Init ảnh và Seed Database

### Bước 3a — Chuẩn bị thư mục ảnh

Đặt ảnh vào `snappose-api/poses/` theo cấu trúc:

```
poses/
  {category-slug}/
    01-photo.png
    01-skeleton.png
    02-photo.png
    02-skeleton.png
    ...
```

Tên slug được map với tên hiển thị trong `scripts/seed.py`:

| Slug         | Tên hiển thị |
|--------------|--------------|
| `ngoai-troi` | Ngoài trời   |
| `ca-phe`     | Cà phê       |
| `bien`       | Biển         |
| `pho`        | Phố          |
| `studio`     | Studio       |
| `cong-vien`  | Công viên    |
| `nha-hang`   | Nhà hàng     |
| `du-lich`    | Du lịch      |
| `thoi-trang` | Thời trang   |
| `dem`        | Đêm          |

### Bước 3b — (Tuỳ chọn) Xoá nền ảnh skeleton

Script `remove_bg.py` tự nhận diện loại nền và xoá:

```bash
cd snappose-api

# Xem trước kết quả (lưu *_preview.png, không ghi đè)
python -m scripts.remove_bg --preview

# Ghi đè ảnh gốc
python -m scripts.remove_bg

# Bỏ qua một số ảnh cụ thể
python -m scripts.remove_bg --skip bien/01-skeleton.png ca-phe/02-skeleton.png
```

> Nền đen dùng thuật toán luminance (nhanh). Nền màu khác dùng AI `rembg` — cần cài thêm: `pip install rembg`.

### Bước 3c — Seed Database

```bash
cd snappose-api

# Seed lần đầu (bỏ qua nếu đã có data)
python -m scripts.seed

# Seed lại từ đầu (xoá data cũ)
python -m scripts.seed --reset

# Chỉ định thư mục ảnh khác
python -m scripts.seed --poses-dir /path/to/poses
```

Script sẽ:
1. Tạo bảng DB (nếu chưa có)
2. Tạo tài khoản admin (`admin` / `changeme123`)
3. Upload ảnh lên MinIO bucket `snappose`
4. Insert categories + poses vào PostgreSQL

---

## 4. Cài đặt Frontend

```bash
cd snappose-web

# Cài dependencies
npm install

# Tạo file .env
cp .env.example .env
```

Nội dung `.env` mặc định:

```env
VITE_API_URL=http://localhost:8000
```

Chạy dev server:

```bash
npm run dev
```

Frontend chạy tại `http://localhost:5173`.

---

## 5. Dùng ngrok (truy cập từ điện thoại)

Ngrok tạo public HTTPS URL để điện thoại có thể gọi đến API đang chạy local.

### Cài ngrok

Tải tại [ngrok.com/download](https://ngrok.com/download) hoặc:

```bash
# macOS
brew install ngrok

# Windows
winget install ngrok
```

Đăng ký tài khoản và xác thực:

```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

### Expose API

```bash
# Mở terminal riêng — giữ ngrok chạy song song với uvicorn
ngrok http 8000
```

Ngrok sẽ in ra URL dạng:

```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8000
```

### Cập nhật config sau khi có ngrok URL

**`snappose-api/.env`** — thêm ngrok URL vào CORS (thay `abc123` bằng ID thật):

```env
CORS_ORIGINS=http://localhost:5173,https://abc123.ngrok-free.app
```

> Restart uvicorn sau khi sửa `.env`.

**`snappose-web/.env`** — trỏ API về ngrok URL:

```env
VITE_API_URL=https://abc123.ngrok-free.app
```

> Restart `npm run dev` sau khi sửa `.env`.

Bây giờ mở `http://localhost:5173` trên máy tính hoặc truy cập ngrok URL từ điện thoại — camera và API đều hoạt động qua HTTPS.

---

## Tóm tắt thứ tự chạy

```
1.  cd snappose-api && docker compose up -d
2.  uvicorn app.main:app --reload --port 8000
3.  python -m scripts.seed              ← chỉ chạy lần đầu
4.  ngrok http 8000                     ← terminal riêng
5.  cập nhật .env frontend với ngrok URL
6.  cd snappose-web && npm run dev
```

---

## Cấu trúc project

```
snappose/
├── snappose-api/           # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy models (Category, Pose, AdminUser)
│   │   ├── routers/        # public.py + admin_*.py
│   │   ├── config.py       # Settings từ .env
│   │   ├── database.py     # SQLAlchemy engine
│   │   └── storage.py      # MinIO client
│   ├── scripts/
│   │   ├── seed.py         # Seed DB + upload ảnh lên MinIO
│   │   └── remove_bg.py    # Xoá nền ảnh skeleton
│   ├── poses/              # Ảnh gốc (không commit)
│   ├── uploads/            # Upload từ admin panel
│   ├── docker-compose.yml  # PostgreSQL + MinIO
│   └── requirements.txt
└── snappose-web/           # React + Vite frontend
    ├── src/
    │   ├── screens/        # SplashScreen, CameraScreen, ResultScreen
    │   ├── components/     # CameraPreview, PoseCarousel, CategoryBar...
    │   └── api/            # axios clients
    └── package.json
```
