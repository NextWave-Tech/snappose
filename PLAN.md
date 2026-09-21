# SnapPose — Tổng quan kế hoạch "Gợi ý pose bằng AI"

> File này là tổng quan chung. Việc chi tiết tách riêng theo người làm — xem [PLAN_NGUYEN.md](PLAN_NGUYEN.md) (dataset/khung outline) và [PLAN_MINH.md](PLAN_MINH.md) (model so khớp + tích hợp backend).

---

## 1. Mục tiêu

Khi user bấm nút trên camera, app gửi 1 khung hình hiện tại lên, hệ thống chọn ra **~5 pose phù hợp nhất** trong thư viện (dựa theo bối cảnh xung quanh), trả về ảnh viền (outline) để overlay lên camera cho user tự canh chụp — giống cơ chế "AI Posture Recommendation" của Huawei / "Pose suggestion" của SnapEdit.

Đã thống nhất:
- Đây là bài toán **retrieval**: so vector embedding ảnh camera với vector embedding của từng pose trong thư viện, trả về **top-5**.
- Chỉ chạy AI **khi user bấm nút** (on-demand), không chạy liên tục theo khung hình.
- Việc **tạo dataset** (ảnh + khung outline) và việc **so khớp** (CLIP/model + tích hợp API) là 2 việc độc lập, làm song song được — không việc nào phải chờ việc kia xong.

---

## 2. Phân công

| Người | Việc | File chi tiết |
|---|---|---|
| **Nguyên** | Tạo/mở rộng thư viện ảnh + khung outline (dùng Gemini), nạp vào DB qua `seed.py` | [PLAN_NGUYEN.md](PLAN_NGUYEN.md) |
| **Minh** | Model so khớp ảnh camera ↔ thư viện pose (CLIP hoặc tương đương), **tích hợp thẳng vào backend + DB thật** (không phải script test riêng) | [PLAN_MINH.md](PLAN_MINH.md) |

**Nguyên tắc phối hợp**: thư viện pose **không cần phong phú ngay** — Minh code + test matching trên bất kỳ dữ liệu nào đang có trong DB tại thời điểm đó (bắt đầu từ 6 pose có sẵn), Nguyên cứ thêm dần pose mới bất cứ lúc nào, không cần đồng bộ/chờ nhau. Điểm chung duy nhất cần thống nhất: **format file** (xem PLAN_NGUYEN.md) để `seed.py` và script tính embedding đọc đúng.

---

## 3. Hiện trạng hệ thống (đã có, không cần dựng lại)

| Thành phần | Trạng thái | Chạy ở đâu |
|---|---|---|
| PostgreSQL + MinIO | Đã chạy qua Docker Compose | `snappose-api/docker-compose.yml`, local, port 5432 / 9000-9001 |
| FastAPI backend | Đã chạy, serve API + build frontend cùng 1 port | `.pyembed/python.exe -m uvicorn app.main:app --port 8000` (Windows), local, port 8000 |
| React frontend | Đã build (`npm run build`), FastAPI serve tĩnh qua `snappose-api/app/main.py` (mount `dist/`) | Cùng port 8000 |
| DB schema | `Category`, `Pose` (`photo_url`, `skeleton_url`), `AdminUser` | `app/models/*.py` |
| Seed script | `scripts/seed.py` — quét `poses/{category-slug}/{prefix}-photo.*` + `{prefix}-skeleton.*`, upload MinIO, insert DB | `snappose-api/scripts/seed.py` |
| Camera capture | `CameraPreview.jsx` đã có sẵn hàm `capture()` trả về dataURL khung hình hiện tại | `snappose-web/src/components/CameraPreview.jsx:148-165` |
| Overlay hiển thị | `CameraScreen.jsx` overlay `currentPose.skeleton_url` lên camera | `snappose-web/src/screens/CameraScreen.jsx:58-72` |

**Lưu ý cho Minh**: `.pyembed/` là Python nhúng riêng cho máy Windows này (workaround vì Python hệ thống bị hỏng, xem memory `python_broken_install.md`) — **không áp dụng cho máy Mac của Minh**, Minh dùng `python3 -m venv` bình thường.

---

## 4. Kiến trúc so khớp (tổng quan — chi tiết ở PLAN_MINH.md)

```
[User bấm nút "Gợi ý pose"]
        │
        ▼ POST /api/suggest-pose { image: base64 }
┌─────────────────────────────────────────────┐
│              FastAPI backend                 │
│  1. Decode ảnh, embed bằng CLIP              │
│  2. So cosine similarity với embedding của   │
│     toàn bộ pose trong DB (bao nhiêu pose    │
│     hiện có thì so bấy nhiêu, không chờ đủ)  │
│  3. Trả về TOP 5 pose khớp nhất              │
└─────────────────────────────────────────────┘
        │
        ▼ list 5 x { id, skeleton_url, category_id, ... }
FE hiển thị 5 lựa chọn, user chọn 1 → overlay như cơ chế hiện có
```
