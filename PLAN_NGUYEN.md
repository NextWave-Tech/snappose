# Việc của Nguyên — Xây thư viện ảnh + khung outline

> Không cần làm phong phú ngay — thêm dần theo thời gian. Không phụ thuộc vào việc CLIP/matching của Minh, làm độc lập.

## Format bắt buộc (để `seed.py` đọc đúng)

```
snappose-api/poses/
  {category-slug}/
    01-photo.png        (hoặc .jpg/.jpeg/.webp)
    01-skeleton.png
    02-photo.png
    02-skeleton.png
    ...
```

- Mỗi pose = **2 file cùng tên tiền tố**, khác hậu tố `-photo` / `-skeleton` (dùng `-` hoặc `_` đều được: `01-photo.png` hoặc `01_photo.png`).
- `photo` = ảnh minh hoạ đầy đủ (người + bối cảnh), `skeleton` = khung outline (nền trong suốt, đè lên camera).
- Tên tiền tố (`01`, `02`...) không cần theo thứ tự tuyệt đối, chỉ cần **duy nhất trong 1 category** — script tự sinh tên hiển thị `Pose 01`, `Pose 02`... theo tiền tố này.

## 10 category slug cố định (đặt đúng tên folder)

`ngoai-troi`, `ca-phe`, `bien`, `pho`, `studio`, `cong-vien`, `nha-hang`, `du-lich`, `thoi-trang`, `dem`

(Đặt folder tên khác cũng được, script tự tạo category mới theo tên folder — nhưng nên dùng đúng 10 tên trên để khớp với category đã có sẵn trên app.)

## Cách thêm pose mới (đã test, chạy an toàn nhiều lần)

```bash
# Sau khi thả file ảnh mới vào poses/{slug}/
cd snappose-api
python -m scripts.seed
```

- **Vừa sửa lại `seed.py` để hỗ trợ thêm dần**: script giờ chỉ insert pose nào **chưa có trong DB** (so theo tên `Pose 01`, `Pose 02`... trong từng category), bỏ qua pose đã tồn tại — an toàn chạy lại bao nhiêu lần cũng được, không xoá/không đụng data cũ. Đã test thật: chạy trên 6 pose có sẵn ra đúng `+0 pose mới, bỏ qua 6 pose đã có sẵn`.
- Muốn xoá sạch làm lại từ đầu mới cần `python -m scripts.seed --reset` (hiếm khi cần).

## Lưu ý quan trọng

- **Đừng dùng trang admin web (`/admin` → Poses) để thêm pose lúc này** — form đó đang có bug (field `image_url`/`silhouette_type` không khớp với schema thật `photo_url`/`skeleton_url` trong DB, submit sẽ lỗi). Chưa fix, dùng cách thả file + `seed.py` ở trên cho chắc.
- Ảnh generate bằng Gemini — trước khi dùng số lượng lớn cho sản phẩm thương mại, nên đọc kỹ điều khoản sử dụng nội dung generate của Gemini (thường cho phép dùng thương mại nhưng nên xác nhận lại, giống cách đã soát license Pexels/Pose Depot/Civitai trước đó trong dự án).
- Mỗi lần thêm pose mới xong, báo Minh 1 tiếng — bên Minh cần chạy lại script tính embedding (`build_pose_embeddings.py`) cho pose mới thì mới match được (xem PLAN_MINH.md).
