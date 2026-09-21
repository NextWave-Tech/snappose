# Setup SnapPose backend trên macOS (cho Minh)

> Hướng dẫn từ đầu đến lúc chạy được backend + seed data local trên Mac. Sau khi xong, đọc tiếp [PLAN_MINH.md](PLAN_MINH.md) để làm phần CLIP matching.

---

## 0. Yêu cầu cài sẵn

| Công cụ | Kiểm tra đã có chưa | Cài nếu chưa có |
|---|---|---|
| Docker Desktop for Mac | `docker --version` | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Python 3.11+ | `python3 --version` | `brew install python@3.11` (hoặc dùng bản có sẵn nếu ≥3.11) |
| Git | `git --version` | có sẵn trên macOS, hoặc `brew install git` |
| Node.js 18+ (chỉ cần nếu muốn chạy thử cả frontend) | `node --version` | `brew install node` |

**Lưu ý quan trọng**: repo có thư mục `snappose-api/.pyembed/` — đó là Python nhúng riêng cho máy Windows dùng trong lúc dev trước đó (workaround vì Python hệ thống máy đó bị hỏng). **Không liên quan gì đến Mac, bỏ qua thư mục đó hoàn toàn**, tự tạo venv theo hướng dẫn dưới.

---

## 1. Clone + vào thư mục

```bash
git clone https://github.com/NextWave-Tech/snappose.git
cd snappose
```

---

## 2. Bật Postgres + MinIO (Docker)

```bash
cd snappose-api
docker compose up -d
docker compose ps   # kiểm tra cả 2 container đang "Up"
```

| Service | Port | Ghi chú |
|---|---|---|
| PostgreSQL | `localhost:5432` | user/pass/db đều là `snappose` |
| MinIO | `localhost:9000` | API, `minioadmin`/`minioadmin` |
| MinIO Console | `localhost:9001` | xem ảnh đã upload qua web UI |

---

## 3. Tạo virtual environment + cài dependency

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

`requirements.txt` đã có đủ mọi thứ cần (kể cả `torch`/`transformers`/`pillow`/`numpy` cho phần CLIP sau này) — không cần cài thêm gì tay.

### Nếu `psycopg2-binary` cài lỗi (hay gặp trên Apple Silicon nếu macOS hơi cũ)

Lỗi thường gặp: không tìm được wheel khớp phiên bản macOS. Cách xử lý theo thứ tự:
```bash
pip install psycopg2-binary --no-cache-dir   # thử tải lại wheel mới nhất trước
```
Nếu vẫn lỗi:
```bash
brew install postgresql libpq
echo 'export LDFLAGS="-L/opt/homebrew/opt/libpq/lib"' >> ~/.zshrc
echo 'export CPPFLAGS="-I/opt/homebrew/opt/libpq/include"' >> ~/.zshrc
source ~/.zshrc
pip install psycopg2-binary --no-cache-dir --no-binary psycopg2-binary
```

### Về `mediapipe` (chỉ cần nếu sau này làm tới bước fallback ở PLAN_MINH.md)

Không cần cài ngay — chỉ cần khi thật sự làm tới bước "lọc tinh bằng MediaPipe". Khi cần: `pip install mediapipe` chạy bình thường trên Apple Silicon (đã hỗ trợ arm64 chính thức từ bản 0.9.3+, không cần bản fork/silicon riêng nữa).

---

## 4. Cấu hình `.env`

```bash
cp .env.example .env
```

Giữ nguyên mặc định là chạy được ngay (Postgres/MinIO local, port mặc định). Không cần sửa gì trừ khi đổi port.

---

## 5. Seed dữ liệu (6 pose có sẵn, đồng bộ qua git)

```bash
python -m scripts.seed
```

- Script đã sửa thành **incremental** — an toàn chạy lại bất cứ lúc nào (kể cả sau khi `git pull` có thêm pose mới từ Nguyên), chỉ insert pose chưa có, không đụng data cũ.
- Kết quả mong đợi lần đầu: `Done: +6 pose mới, bỏ qua 0 pose đã có sẵn`.

---

## 6. Chạy server, kiểm tra

```bash
uvicorn app.main:app --reload --port 8000
```

Test nhanh ở terminal khác:
```bash
curl http://localhost:8000/api/health        # {"status":"ok"}
curl http://localhost:8000/api/categories     # list 10 category
curl http://localhost:8000/api/poses          # list 6 pose vừa seed
```

Swagger docs xem trực tiếp ở `http://localhost:8000/docs`.

---

## 7. (Tuỳ chọn) Chạy thử frontend

```bash
cd ../snappose-web
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8000, mặc định đã đúng
npm run dev
```

Mở `http://localhost:5173`.

---

## 8. Lưu ý / bug đã biết (đọc để khỏi mất công debug nhầm)

- **Trang admin thêm pose (`/admin` → Poses) đang bị lỗi**: form dùng field `image_url`/`silhouette_type` không khớp schema thật (`photo_url`/`skeleton_url`) — submit sẽ fail. Đừng dùng để test, thêm pose qua `scripts/seed.py` (xem PLAN_NGUYEN.md) hoặc gọi thẳng API `/api/admin/poses`.
- **Khi Nguyên thêm pose mới**: `git pull` → `python -m scripts.seed` (script tự biết cái nào mới, không cần `--reset`).
- **PyTorch trên Apple Silicon**: cài qua `pip install torch` bình thường đã có hỗ trợ Metal (MPS) sẵn, không cần cài riêng bản gì khác. Khi code phần CLIP (PLAN_MINH.md), nhớ dùng `device = "mps" if torch.backends.mps.is_available() else "cpu"` để tận dụng tăng tốc.

---

Xong phần này thì qua [PLAN_MINH.md](PLAN_MINH.md) để làm phần CLIP matching.
