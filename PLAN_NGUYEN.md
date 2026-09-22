# Việc của Nguyên — Xây thư viện ảnh + khung outline

> Không cần làm phong phú ngay — thêm dần theo thời gian. Không phụ thuộc vào việc CLIP/matching của Minh, làm độc lập.
> **Prompt generate ảnh (Gemini) + checklist kiểm tra chất lượng**: xem [POSE_GEN_GUIDE.md](POSE_GEN_GUIDE.md) — đọc file đó trước, quay lại đây để biết cách nạp ảnh vào hệ thống.

## Format thô — thoải mái đặt tên tự nhiên, có script tự đổi lại đúng chuẩn

**Không cần nhớ đúng tên `{prefix}-photo`/`{prefix}-skeleton` khi generate xong** — cứ lưu file theo cách tự nhiên:

```
snappose-api/poses/
  {category-slug}/
    anh-2.jpg          ← ảnh gốc bất kỳ tên gì, miễn không kết thúc bằng "-khung"
    anh-2-khung.jpg    ← ảnh outline tương ứng, đặt tên = {tên ảnh gốc} + "-khung"
    anh-chang-trai-3.jpg
    anh-chang-trai-3-khung.jpg
    ...
```

- Đúng 1 quy tắc bắt buộc duy nhất: **tên file khung = tên file gốc + `-khung`** (hoặc `_khung`), cùng thư mục category. Ngoài ra tên gì cũng được.
- Chạy 1 lệnh để tự đổi tên đúng chuẩn + tự tách nền đen thành PNG trong suốt (xem bước 2 bên dưới) — không cần tự làm tay 2 việc này.

**Vấn đề đã gặp và đã fix**: ảnh khung generate ra thường là `.jpg` nền đen (không có kênh trong suốt) — nếu để nguyên vậy overlay lên camera sẽ ra 1 khối đen che kín màn hình. Script ở bước 2 tự phát hiện nền đen và chuyển thành PNG trong suốt thật (dùng luminance làm alpha), không cần làm tay.

## 10 category slug cố định (đặt đúng tên folder)

`ngoai-troi`, `ca-phe`, `bien`, `pho`, `studio`, `cong-vien`, `nha-hang`, `du-lich`, `thoi-trang`, `dem`

(Đặt folder tên khác cũng được, script tự tạo category mới theo tên folder — nhưng nên dùng đúng 10 tên trên để khớp với category đã có sẵn trên app.)

## Cách thêm pose mới — 2 bước, đã test thật trên data thật

```bash
cd snappose-api

# Bước 1: đổi tên đúng chuẩn + tách nền đen thành PNG trong suốt
python -m scripts.import_raw_poses

# Bước 2: nạp vào DB + upload MinIO
python -m scripts.seed
```

- **Bước 1** (`import_raw_poses.py`) tự quét mọi cặp `{tên}.jpg` + `{tên}-khung.jpg` chưa đúng chuẩn trong từng category, đổi thành `{số tiếp theo}-photo.jpg` + `{số tiếp theo}-skeleton.png` (số tự nối tiếp từ pose lớn nhất đã có, không đụng pose cũ), đồng thời tách nền đen → trong suốt cho ảnh skeleton. Đã test thật: 3 cặp ở `bien/` → `04,05,06`, 8 cặp ở `ca-phe/` → `04..11`.
- **Bước 2** (`seed.py`) — đã sửa để hỗ trợ thêm dần: chỉ insert pose nào **chưa có trong DB**, bỏ qua pose đã tồn tại — an toàn chạy lại bao nhiêu lần cũng được, không xoá/không đụng data cũ.
- Muốn xoá sạch làm lại từ đầu mới cần `python -m scripts.seed --reset` (hiếm khi cần).

## Lưu ý quan trọng

- **Đừng dùng trang admin web (`/admin` → Poses) để thêm pose lúc này** — form đó đang có bug (field `image_url`/`silhouette_type` không khớp với schema thật `photo_url`/`skeleton_url` trong DB, submit sẽ lỗi). Chưa fix, dùng cách thả file + `seed.py` ở trên cho chắc.
- Ảnh generate bằng Gemini — trước khi dùng số lượng lớn cho sản phẩm thương mại, nên đọc kỹ điều khoản sử dụng nội dung generate của Gemini (thường cho phép dùng thương mại nhưng nên xác nhận lại, giống cách đã soát license Pexels/Pose Depot/Civitai trước đó trong dự án).
- Mỗi lần thêm pose mới xong, báo Minh 1 tiếng — bên Minh cần chạy lại script tính embedding (`build_pose_embeddings.py`) cho pose mới thì mới match được (xem PLAN_MINH.md).
