# SnapPose — Kế hoạch triển khai tính năng "Gợi ý pose bằng AI"

> Tài liệu này chốt lại toàn bộ những gì đã bàn: mục tiêu, kiến trúc, và việc cần làm theo từng giai đoạn.
> Nguyên tắc xuyên suốt: **tận dụng tối đa cái đã có, chạy 100% local**. Mục tiêu là ra sản phẩm dùng được thật (đủ pose cho cả 10 category), không dừng ở mức PoC — dataset 6 pose hiện tại chỉ là điểm khởi đầu để verify pipeline, việc lấp đầy dataset (Giai đoạn D-E) nằm trong scope, không phải việc "để sau".

---

## 1. Mục tiêu

Khi user bấm nút trên camera, app gửi 1 khung hình hiện tại lên, hệ thống tự chọn ra 1 pose phù hợp nhất trong thư viện (dựa theo bối cảnh xung quanh), trả về ảnh viền (outline) và overlay lên camera để user tự canh chụp — giống cơ chế "AI Posture Recommendation" của Huawei / "Pose suggestion" của SnapEdit.

Đã thống nhất trong quá trình bàn:
- Đây **không phải** sinh ảnh mới bằng generative AI (diffusion) — quá nặng, không cần thiết, tốn chi phí. Đó là tính năng khác ("Change Pose" kiểu SnapEdit, hậu kỳ, không làm ở đây).
- Đây là bài toán **retrieval**: chọn 1 pose có sẵn trong thư viện khớp nhất với ảnh camera, bằng cách so sánh vector embedding ảnh (CLIP).
- CLIP giỏi hiểu **bối cảnh/không khí chung** của ảnh, nhưng **không đáng tin cho chi tiết tư thế cơ thể** (đã research: CLIP thiên về category-level concept, yếu về fine-grained spatial configuration). Vì dataset hiện tại quá nhỏ (xem mục 3), bước tinh chỉnh bằng MediaPipe pose-matching **chưa cần làm ngay** — để dành khi có nhiều pose/category hơn.
- Chỉ chạy xử lý AI **khi user bấm nút** (on-demand), không chạy liên tục theo từng khung hình → không lo vấn đề hiệu năng/chi phí real-time.

---

## 2. Hiện trạng hệ thống (đã có, không cần dựng lại)

| Thành phần | Trạng thái | Chạy ở đâu |
|---|---|---|
| PostgreSQL + MinIO | Đã chạy qua Docker Compose | `snappose-api/docker-compose.yml`, local, port 5432 / 9000-9001 |
| FastAPI backend | Đã chạy, serve API + build frontend cùng 1 port | `.pyembed/python.exe -m uvicorn app.main:app --port 8000`, local, port 8000 |
| React frontend | Đã build (`npm run build`), FastAPI serve tĩnh qua `snappose-api/app/main.py` (mount `dist/`) | Cùng port 8000 |
| Python runtime | `.pyembed/` — **đã cài sẵn `torch`, `transformers`, `mediapipe`, `opencv-contrib-python`, `numpy`, `pillow`, `huggingface_hub`, `sqlalchemy`, `minio`** | Local, không cần cài thêm gì để làm CLIP/MediaPipe |
| DB schema | `Category`, `Pose` (`photo_url`, `skeleton_url`), `AdminUser` | `app/models/*.py` |
| Camera capture | `CameraPreview.jsx` đã có sẵn hàm `capture()` trả về dataURL của khung hình hiện tại (không dính overlay) | `snappose-web/src/components/CameraPreview.jsx:148-165` |
| Overlay hiển thị | `CameraScreen.jsx` đang overlay `currentPose.skeleton_url` (ảnh PNG) lên camera bằng `<img>` tuyệt đối | `snappose-web/src/screens/CameraScreen.jsx:58-72` |
| Component overlay dạng SVG (chưa dùng tới) | `PoseSilhouette.jsx` — vẽ path SVG có sẵn, hiện chưa được import vào đâu | `snappose-web/src/components/PoseSilhouette.jsx` |

**Kết luận quan trọng**: hạ tầng gen-khung gần như có đủ 90% — cái thiếu duy nhất là **logic chọn pose tự động** (hiện tại là user tự bấm `CategoryBar` + `PoseCarousel` để chọn tay). Việc cần làm là thêm 1 API chọn-pose-tự-động và 1 nút gọi nó, tái dùng toàn bộ phần overlay/camera đã có.

---

## 3. Dataset hiện tại — đã check trực tiếp trong DB

```
SELECT category, count(pose) FROM thực tế:
  ca-phe : 3 pose  (01, 02, 03 — có photo + skeleton)
  bien   : 3 pose  (01, 02, 03 — có photo + skeleton)
  ngoai-troi, pho, studio, cong-vien, nha-hang, du-lich, thoi-trang, dem : 0 pose (category rỗng)
```

→ Tổng cộng **6 pose thật trong hệ thống**, chỉ phủ 2/10 phong cảnh: **Cà phê** và **Biển**. 8 category còn lại tồn tại trong DB (hiện trên UI category bar) nhưng chưa có pose nào — nếu ra sản phẩm với dataset này, 8/10 nút category trên UI bấm vào sẽ trống trơn, không dùng được.

**Quyết định**: đây là điểm khởi đầu, **không phải mục tiêu cuối**. Để ra được sản phẩm thật sự dùng được (đủ 10 category có pose), việc lấp đầy dataset **làm TRƯỚC** (Giai đoạn D — xem mục 6), vì Giai đoạn A-B-C (chọn pose tự động) không có gì để test/verify ý nghĩa nếu 8/10 category vẫn trống. Thứ tự thực hiện: **Giai đoạn D trước** (lấy ảnh + tự build outline, đủ dữ liệu cho cả 10 category) → rồi mới tới A-B-C (chọn-pose-tự-động) trên dataset đã đầy đủ.

> Đã bỏ hướng Pose Depot/Civitai (research ở các bước trước): Pose Depot license sạch nhưng pose không hợp bối cảnh đời thường (anime/action), Civitai chỉ là input ControlNet để tự chạy Stable Diffusion generate — quay lại đúng vấn đề "AI gen xấu" ban đầu. Hướng chốt: **tự lấy ảnh thật (license rõ ràng) + tự build pipeline sinh viền**, xem chi tiết Giai đoạn D.

---

## 4. Kiến trúc tổng thể

```
[User bấm nút "Gợi ý pose"]
        │
        ▼
CameraPreview.capture() → dataURL (đã có sẵn, tái dùng)
        │
        ▼ POST /api/suggest-pose  { image: base64 }
┌─────────────────────────────────────────────┐
│              FastAPI backend                 │
│  1. Decode ảnh                               │
│  2. CLIP embed ảnh camera (transformers,     │
│     model tải 1 lần từ HuggingFace, chạy CPU │
│     local, không gọi API ngoài)              │
│  3. So cosine similarity với embedding của   │
│     6 pose đã tính sẵn (offline)             │
│  4. Trả về pose khớp nhất (PoseOut schema)   │
└─────────────────────────────────────────────┘
        │
        ▼ { id, skeleton_url, category_id, ... }
CameraScreen overlay ảnh skeleton_url lên camera (logic overlay đã có sẵn, chỉ đổi nguồn chọn pose)
```

Toàn bộ chạy trên máy local — không có bước nào gọi cloud API (không CLIP API, không VLM API). Model CLIP tải về 1 lần (~600MB, cần internet lúc tải), sau đó chạy hoàn toàn offline.

---

## 5. Việc cần làm — theo giai đoạn

### Giai đoạn A — Tính embedding sẵn cho pose hiện có (offline, chạy 1 lần)

- **Input**: 6 ảnh `photo_url` hiện có trong DB (`poses/ca-phe/*.png`, `poses/bien/*.png`).
- **Việc làm**: viết script mới `scripts/build_pose_embeddings.py`:
  1. Load model CLIP qua `transformers` (đã cài sẵn trong `.pyembed`) — dùng checkpoint nhỏ, ví dụ `openai/clip-vit-base-patch32` (tải tự động từ HuggingFace Hub lần đầu, cache local).
  2. Với mỗi pose trong bảng `poses`, tải `photo_url` (từ MinIO), chạy qua CLIP image encoder → vector 512 chiều.
  3. Lưu vector vào cột mới `embedding` (kiểu JSON hoặc `ARRAY(Float)`) trong bảng `poses` — **không cần cài pgvector**, dataset chỉ 6 dòng thì so cosine similarity bằng NumPy thuần trong Python là đủ nhanh, không cần vector DB chuyên dụng.
- **Output**: mỗi pose trong DB có thêm 1 vector embedding.
- **Chạy ở đâu**: chạy tay 1 lần bằng `.pyembed/python.exe -m scripts.build_pose_embeddings`, local, không cần chạy lại trừ khi thêm pose mới (thì gọi lại cho riêng pose mới, không cần chạy lại cả bảng).
- **Việc cần sửa thêm**: `app/models/pose.py` thêm cột `embedding`; `scripts/seed.py` gọi hàm build embedding luôn sau khi insert pose mới (để tự động, khỏi phải nhớ chạy tay mỗi lần thêm pose qua trang admin).

### Giai đoạn B — API chọn pose tự động (on-demand)

- **Input**: 1 ảnh (base64/multipart) gửi từ frontend khi bấm nút.
- **Việc làm**:
  1. Tạo `app/clip_engine.py`: load model CLIP **1 lần khi server khởi động** (singleton, tránh load lại mỗi request — quan trọng để giữ tốc độ phản hồi trong ngưỡng chấp nhận được trên CPU).
  2. Tạo router mới `app/routers/suggest.py`, theo đúng pattern của `app/routers/public.py` đã có:
     - `POST /api/suggest-pose` — nhận ảnh, embed, so cosine similarity với toàn bộ `poses.embedding` trong DB (lọc theo `category_id` nếu FE muốn giữ chọn category tay + AI chỉ chọn pose trong category đó), trả về `PoseOut` của pose khớp nhất.
  3. Đăng ký router mới vào `app/main.py` (thêm 1 dòng `app.include_router(suggest.router)`, giống các router khác).
- **Output**: JSON pose (đúng schema `PoseOut` có sẵn trong `app/schemas.py`), FE dùng lại y hệt cách đang dùng `currentPose`.
- **Chạy ở đâu**: cùng FastAPI process, port 8000, local.

### Giai đoạn C — Nút bấm ở frontend

- **Việc làm**:
  1. Thêm hàm `suggestPose(imageDataUrl, categoryId)` vào `snappose-web/src/api/poses.js` (theo pattern của `getPoses` đã có trong file này), gọi `POST /api/suggest-pose`.
  2. Trong `CameraScreen.jsx`: thêm 1 nút "Gợi ý pose" cạnh nút chụp hiện tại (dòng 131-139 là nút chụp, thêm nút mới bên cạnh).
  3. Khi bấm: gọi `previewRef.current.capture()` (đã có sẵn) lấy dataURL → gọi `suggestPose()` → nhận pose trả về → `setSelectedPoseId(pose.id)` (state đã có sẵn) → overlay tự động cập nhật vì `currentPose` đã derive từ `selectedPoseId` (dòng 38-41), **không cần sửa logic overlay**.
- **Output**: user bấm 1 nút, viền trắng tự đổi theo bối cảnh đang quay, không cần tự bấm category/pose thủ công (vẫn giữ được thao tác tay làm phương án dự phòng).
- **Chạy ở đâu**: build lại `npm run build`, serve qua FastAPI port 8000 như hiện tại (đúng yêu cầu 1 port, local, đơn giản).

---

## 6. Mở rộng dataset cho đủ 10 category — Pexels + tự build pipeline sinh viền (làm TRƯỚC Giai đoạn A-B-C)

Đã thử và loại 2 hướng trước đó (có bằng chứng cụ thể, xem lịch sử bàn):
- **Pose Depot** (30 pose render 3D, Apache-2.0): license sạch nhưng phần lớn pose kiểu anime/action (`Flying_Superhero`, `Fighting_Pose`...), không hợp bối cảnh đời thường biển/công viên/cà phê.
- **Civitai pose packs**: đã tải ảnh mẫu về xem trực tiếp — hoá ra chỉ là **input skeleton để tự chạy Stable Diffusion generate**, ảnh đẹp trên trang chỉ là demo AI-gen, không phải asset dùng thẳng được → quay lại đúng vấn đề "AI gen viền xấu" ban đầu, loại.

**Hướng chốt**: dùng **ảnh thật từ Pexels** (search đúng theo từng category, nên bối cảnh match tự nhiên, không cần đoán/VLM) + **tự build pipeline sinh viền** bằng MediaPipe + OpenCV (không phải AI segment mù mờ như trước — có bước lọc chất lượng đầu vào rõ ràng).

**License Pexels đã verify**: [Pexels License](https://www.pexels.com/license/) — miễn phí dùng thương mại, được phép chỉnh sửa (`modify`), không bắt buộc ghi công. Chỉ cấm bán lại bản KHÔNG chỉnh sửa (in poster/sản phẩm vật lý) — không áp dụng ở đây vì mình luôn xử lý qua pipeline (tách nền, vẽ viền) chứ không dùng ảnh gốc y nguyên làm sản phẩm bán. API free: 200 request/giờ, 20.000/tháng — dư sức cho vài trăm ảnh.

### Giai đoạn D — Fetch ảnh Pexels theo category + tự sinh outline (offline, chạy 1 lần, script đã viết sẵn)

Đã viết `scripts/fetch_pexels_poses.py` (chưa chạy, đợi duyệt), làm đủ cả input lẫn output trong 1 script:

- **Input**: 1 API key Pexels miễn phí (đăng ký tại [pexels.com/api](https://www.pexels.com/api/), cần email — **việc của mày**, mình không tự đăng ký thay được), set qua biến môi trường `PEXELS_API_KEY`.
- **Việc script làm, cho từng category trong 10 category** (mỗi category có 1 câu search tiếng Anh tương ứng, vd `bien` → `"person standing beach full body"`):
  1. Gọi Pexels Search API lấy ~20 ảnh ứng viên/category (orientation=portrait, hợp tỉ lệ camera phone).
  2. **Lọc chất lượng bằng MediaPipe Pose Landmarker** (đã có sẵn trong `.pyembed`, chỉ cần tải 1 model nhỏ `pose_landmarker_lite.task` ~lần đầu): loại ảnh có 0 hoặc >1 người, loại ảnh bị crop thiếu vai/hông/gối/mắt cá (proxy để đảm bảo ảnh full-body, không phải chân dung nửa người) — bước lọc tự động này thay cho việc ngồi duyệt ảnh tay.
  3. Với ảnh đạt: cùng 1 lần chạy Pose Landmarker (bật `output_segmentation_masks=True`) lấy luôn **mask tách người/nền** — không cần model segmentation riêng.
  4. Làm sạch mask (morphology + blur + threshold) → `cv2.findContours` lấy contour ngoài → `cv2.approxPolyDP` làm mượt → vẽ viền trắng lên canvas RGBA trong suốt — **chính là pipeline segmentation→contour đã bàn ở Giai đoạn A, giờ áp cho ảnh thật thay vì ảnh có sẵn**.
  5. Upload ảnh gốc + outline lên MinIO (`storage.upload`, tái dùng), insert `Pose` với đúng `category_id` (biết chắc vì search theo category, **không cần bước gán category bằng VLM như hướng Pose Depot cũ** — đây là điểm lợi lớn nhất so với hướng trước).
- **Output**: mỗi category có thêm tối đa N pose (mặc định 10/category, chỉnh qua `--limit`), tổng khoảng 100 pose nếu chạy đủ 10 category.
- **Chạy ở đâu**: `PEXELS_API_KEY=xxx .pyembed/python.exe -m scripts.fetch_pexels_poses` (có thể chạy từng category riêng qua `--category bien`), local, chạy 1 lần (chạy lại nếu muốn thêm ảnh mới).
- **Chưa chạy** — đang đợi mày lấy API key và duyệt lại script trước khi chạy thật (script đụng tới DB + MinIO + gọi Pexels API tốn quota, không tự ý chạy).

### Giai đoạn G — MediaPipe Pose Landmarker (CHỈ làm khi thực sự cần)

**Điều kiện bật**: chỉ làm khi, sau Giai đoạn D, một category cụ thể có **nhiều hơn ~5-7 pose** — lúc đó CLIP chọn thô theo category thôi sẽ không đủ phân biệt giữa các pose cùng category, cần lọc thêm theo tư thế cụ thể của người đang đứng trước camera. Với category nào vẫn còn ít pose thì bỏ qua bước này, không cần làm.

- **Việc làm** (chỉ khi điều kiện trên đúng):
  1. Giai đoạn D đã chạy MediaPipe Pose Landmarker trên từng ảnh để lọc chất lượng — tận dụng luôn, lưu thêm 33 keypoints (toạ độ chuẩn hoá) đã tính được ra cột mới `keypoints` (JSON) trong bảng `poses`, khỏi phải chạy lại MediaPipe lần 2 cho việc này.
  2. Runtime: sau khi CLIP lọc ra top-K pose theo category, chạy thêm MediaPipe lên khung camera hiện tại (ảnh user gửi lên) → so góc khớp (chuẩn hoá theo chiều cao khung xương) với `keypoints` của từng pose trong top-K → chọn pose khớp tư thế nhất.
- **Output**: chọn pose chính xác hơn trong category đông pose.
- **Chạy ở đâu**: cùng FastAPI process, local — không cần hạ tầng thêm, chỉ thêm logic vào `suggest.py` khi điều kiện trên xảy ra.

---

## 7. Tóm tắt "chạy ở đâu" (tất cả local)

| Việc | Lệnh | Port | Khi nào chạy |
|---|---|---|---|
| DB + MinIO | `docker compose up -d` (trong `snappose-api/`) | 5432, 9000-9001 | luôn bật khi dev |
| **Fetch Pexels + sinh outline (Giai đoạn D)** | `PEXELS_API_KEY=xxx .pyembed/python.exe -m scripts.fetch_pexels_poses` | — | **làm đầu tiên**, cần API key Pexels (mày tự đăng ký), chạy 1 lần/khi muốn thêm ảnh |
| Build embedding pose (Giai đoạn A) | `.pyembed/python.exe -m scripts.build_pose_embeddings` | — | sau Giai đoạn D, chạy lại khi thêm pose mới |
| Backend (API + suggest + serve frontend) | `.pyembed/python.exe -m uvicorn app.main:app --port 8000` | 8000 | luôn bật khi dev |
| Frontend build | `npm run build` (trong `snappose-web/`) | phục vụ qua 8000 ở trên | mỗi lần đổi UI |

**Việc mày cần làm để chạy được Giai đoạn D**: đăng ký API key free tại [pexels.com/api](https://www.pexels.com/api/) (chỉ cần email), đưa key cho mình hoặc set vào `.env`/biến môi trường — mình chưa chạy script vì cần key thật và mày duyệt lại logic trước (script đụng DB + MinIO + gọi API tốn quota Pexels).
