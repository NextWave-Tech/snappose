# Việc của Minh — Model so khớp ảnh camera ↔ thư viện pose

> Tích hợp thẳng vào backend + DB thật (không phải script test riêng). Không cần chờ dataset phong phú — code + test trên bao nhiêu pose đang có trong DB tại thời điểm đó (bắt đầu từ 6 pose có sẵn), Nguyên thêm dần không cần đồng bộ.

## Setup máy (macOS — khác máy Windows đang dùng `.pyembed`)

`.pyembed/` trong repo là Python nhúng riêng cho máy Windows (workaround do Python hệ thống máy đó bị hỏng) — **không liên quan tới Mac**. Trên Mac dùng Python bình thường:

```bash
cd snappose-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install torch transformers pillow numpy   # chưa có trong requirements.txt, cần thêm
```

Hạ tầng chạy local như bình thường:
```bash
docker compose up -d          # Postgres + MinIO
python -m scripts.seed        # nạp 6 pose có sẵn (file ảnh đồng bộ qua git, đã có trong poses/)
uvicorn app.main:app --reload --port 8000
```

Nếu Mac dùng chip Apple Silicon (M1/M2/M3...), PyTorch hỗ trợ tăng tốc qua Metal — dùng `device = "mps" if torch.backends.mps.is_available() else "cpu"` khi load model, nhanh hơn CPU thường đáng kể.

## Kiến trúc

```
POST /api/suggest-pose { image: base64 }
        │
        ▼
1. Decode ảnh, embed bằng CLIP
2. So cosine similarity với embedding của TOÀN BỘ pose đang có trong bảng `poses`
   (không quan tâm số lượng — 6 hay 100 đều chạy được, càng nhiều pose thì kết quả
   càng phong phú, không có ngưỡng tối thiểu nào cần chờ)
3. Trả về TOP 5 (không phải top-1) — sắp theo similarity giảm dần
```

## Việc cần làm — tích hợp thẳng vào backend thật

### 1. Thêm cột `embedding` vào bảng `poses`

Sửa `app/models/pose.py`, thêm cột kiểu JSON (lưu list 512 float — không cần pgvector, dataset quy mô vài trăm dòng thì so cosine similarity bằng NumPy thuần trong Python là đủ nhanh):

```python
embedding = Column(JSON, nullable=True)
```

### 2. Script tính embedding — `scripts/build_pose_embeddings.py`

- Load CLIP qua `transformers`: `openai/clip-vit-base-patch32` (điểm khởi đầu hợp lý, tải tự động từ HuggingFace Hub lần đầu ~600MB, cache local sau đó).
- Quét bảng `poses`, **chỉ tính embedding cho pose nào có `embedding IS NULL`** (giống tinh thần incremental của `seed.py` — an toàn chạy lại bất cứ lúc nào Nguyên thêm pose mới, không tính lại từ đầu).
- Tải `photo_url` từ MinIO → CLIP image encoder → vector 512 chiều → lưu vào cột `embedding`.
- Chạy tay: `python -m scripts.build_pose_embeddings` — chạy lại mỗi khi Nguyên báo có pose mới.

### 3. `app/clip_engine.py` — load model 1 lần

Singleton, load CLIP lúc server khởi động (không load lại mỗi request — quan trọng để giữ tốc độ phản hồi).

### 4. Router `app/routers/suggest.py`

```python
POST /api/suggest-pose
```
- Nhận ảnh (base64/multipart), embed bằng CLIP.
- So cosine similarity với `poses.embedding` của toàn bộ pose có embedding (bỏ qua pose chưa tính embedding, tránh lỗi).
- Có thể lọc theo `category_id` nếu FE muốn giữ chọn category tay + AI chỉ chọn trong category đó (tuỳ chọn, không bắt buộc).
- **Trả về top-5** (không phải top-1), sort giảm dần theo similarity — dùng schema `PoseOut` có sẵn trong `app/schemas.py`, trả về `list[PoseOut]`.

Đăng ký router vào `app/main.py` (thêm `app.include_router(suggest.router)`, giống các router khác đã có).

## Nếu CLIP không đủ tốt — thử theo thứ tự sau

Test xong mà thấy chọn sai/lệch nhiều, đổi lần lượt (không cần đổi kiến trúc, chỉ đổi model):

1. **`openai/clip-vit-large-patch14`** — cùng cách dùng, chỉ đổi tên checkpoint, chính xác hơn bản `base` nhưng chậm hơn chút. Thử đầu tiên vì rẻ nhất.
2. **SigLIP** (`google/siglip-so400m-patch14-384` hoặc bản nhỏ hơn) — cùng họ contrastive image-text với CLIP, nhiều benchmark cho kết quả tốt hơn, load qua `transformers` gần như y hệt CLIP.
3. **MobileCLIP2** (Apple) — đáng thử vì đang chạy trên Mac, được tối ưu riêng cho phần cứng Apple.
4. Nếu vẫn không đủ phân biệt tư thế chi tiết trong cùng category: thêm bước lọc tinh bằng MediaPipe Pose Landmarker (so góc khớp) sau khi CLIP/SigLIP đã lọc thô theo category — chỉ làm nếu thật sự cần, tăng độ phức tạp đáng kể.

## Lưu ý phối hợp với Nguyên

- Cả 2 chạy DB/MinIO **local riêng trên máy mình** (không phải server chung) — đồng bộ dữ liệu qua git: Nguyên commit ảnh mới vào `poses/{slug}/`, Minh `git pull` rồi chạy `python -m scripts.seed` để nạp vào DB local của mình, sau đó chạy `build_pose_embeddings.py` để tính embedding cho pose mới.
- Không cần chờ Nguyên có đủ 100 ảnh mới bắt đầu — code + test ngay trên 6 pose hiện có, quy trình nạp thêm về sau y hệt (chạy lại 2 script trên).
