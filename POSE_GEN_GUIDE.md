# Hướng dẫn generate ảnh pose (Gemini) — cho mọi người làm dataset

> Đã test qua nhiều vòng chỉnh sửa thật (xem lịch sử) mới ra được 2 prompt ổn định dưới đây. Dùng đúng nguyên văn, đừng tự đổi — mỗi lần đổi tuỳ hứng dễ ra lại đúng mấy lỗi đã từng gặp (liệt kê ở mục Checklist).

---

## Quy trình 1 session = 1 dáng mới

**Ảnh gốc giờ lấy từ ảnh thật tìm trên mạng, không AI-generate nữa** (Prompt 1 cũ chuyển thành phương án dự phòng, xem cuối mục này):

1. Tìm 1 ảnh đẹp, phù hợp bối cảnh category đang làm (biển/cà phê/...) trên mạng — rõ toàn thân, dáng rõ ràng, không bị che khuất nhiều.
2. Mở 1 đoạn chat mới với Gemini, đính kèm **đúng 1 ảnh** vừa tìm được (không cần đính thêm ảnh khung mẫu nào — đã test, Prompt 2 tự ra đúng style mà không cần ảnh ví dụ).
3. Chạy **Prompt 2** (bên dưới) → ra ảnh khung khớp đúng dáng trong ảnh vừa tìm.
4. Tự kiểm tra theo **Checklist** bên dưới trước khi lưu.
5. Lưu ảnh gốc (chính ảnh tìm được) + ảnh khung mới ra, đặt tên tự nhiên kiểu `anh-N.jpg` + `anh-N-khung.jpg` (không cần đúng chuẩn ngay — xem [PLAN_NGUYEN.md](PLAN_NGUYEN.md) phần nạp vào hệ thống).
6. Lặp lại từ bước 1 cho dáng tiếp theo.

---

## Prompt 1 — ảnh gốc bằng AI (chỉ dùng khi không tìm được ảnh thật ưng ý)

```
Here is a reference image from a photography pose-guide app: an original
photorealistic photo of a person posing in a specific setting/scene.

Using this as the exact reference for photography style, lighting mood, and
setting/background (keep the same location type and environment), generate
1 new original photo: a different, natural full-body pose in the SAME
setting — pick a pose yourself, different from the reference pose. Make the
pose clearly and meaningfully different, not just a minor adjustment.

Photorealistic, full body visible head to toe, vertical portrait
orientation, candid photography look. No text, no watermark.
```

**Gợi ý dáng** (không bắt buộc, chỉ tham khảo nếu thấy Gemini ra dáng lặp lại nhau): đứng thẳng / đi bộ giữa bước / ngồi ôm gối / ngồi xổm / nhảy lên không trung / dựa vào tường hoặc bề mặt / quay lưng nhìn ra xa / nằm chống khuỷu tay / chạy / xoay người.

---

## Prompt 2 — ảnh khung (đã chốt sau nhiều vòng test, đầy đủ rule)

**Chỉ cần đính đúng 1 ảnh (ảnh tìm được) — đã test, không cần ảnh khung mẫu tham chiếu, prompt tự đủ để ra đúng style:**

```
Here is a photo (the pose to convert). Redraw it as a clean line-art
outline drawing — a pure line illustration, NOT a photo cutout and NOT a
silhouette with photo texture inside it.

Rules:
- The person: draw ONLY as a white outline shape. The inside of the
  person's silhouette must be solid flat black, exactly matching the
  background — no photo texture, no gradient, no color bleeding through
  anywhere inside the outline.
- Keep linework MINIMAL: draw only the essential outer silhouette and major
  clothing boundaries (collar, sleeve edge, where garments separate). Do
  NOT draw fine details — no wrinkles, no fabric folds, no stitching lines,
  no texture, no small decorative marks. Fewer lines is better.
- Objects: include ONLY items the person is ACTIVELY holding in their
  hand(s), wearing, or directly sitting/leaning on with their body weight.
  If multiple chairs/tables/furniture pieces appear in the photo, draw
  ONLY the single one piece of furniture the person's body weight is
  directly resting on — completely omit every other chair, table, sofa, or
  furniture piece, even if partially visible in the photo.
- Do NOT include any object merely placed nearby but not in direct
  physical contact with the person's hand or body weight — remove those
  completely, leave that area empty solid black.
- Exclude all background/distant elements — trees, buildings, scenery,
  other people, other furniture.
- Do NOT add any decorative elements — no sparkles, no stars, no flourish
  marks, no extra graphic elements of any kind, and no stray lines or
  fragments that aren't part of a clearly readable shape.
- Style: uniform thin white line strokes only, solid black background,
  full body head to toe, same camera angle as the photo. Absolutely no
  color, no shading, no fill, no photographic texture anywhere, no text,
  no watermark.

The final result must be a pure white line drawing on black background,
minimal and clean, showing ONLY the person plus the one object/surface
they are directly holding or sitting on — nothing else in the frame.
```

---

## Checklist — tự kiểm tra trước khi lưu ảnh khung (đã gặp thật cả 4 lỗi này)

- [ ] Bên trong người **hoàn toàn đen phẳng**, không lem ảnh gốc/da/quần áo mờ mờ vào trong.
- [ ] Không còn **sparkle/ngôi sao/hoạ tiết trang trí** ở góc ảnh — Gemini hay tự thêm dù prompt đã cấm, phải nhìn kỹ.
- [ ] Không có **ghế/bàn/đồ vật thừa** nằm gần nhưng không ai chạm/ngồi vào — chỉ giữ đúng 1 món đang cầm/ngồi lên.
- [ ] Không dính **cây cối/nhà cửa/người khác** ở nền phía sau.

Nếu dính lỗi nào → không tự sửa tay bằng cách chỉnh ảnh, **generate lại** (Gemini vẫn hay bỏ sót 1-2 rule dù đã ghi rõ, làm lại nhanh hơn ngồi sửa).

---

## Sau khi có đủ ảnh — đổi tên + xoá nền + nạp vào hệ thống

Lưu 2 ảnh vào đúng thư mục category, tên tuỳ ý miễn đúng quy tắc: **tên ảnh khung = tên ảnh gốc + `-khung`**.

```
snappose-api/poses/{category-slug}/
  anh-13.jpg          ← ảnh gốc, tên gì cũng được (không kết thúc bằng "-khung")
  anh-13-khung.jpg    ← ảnh khung, bắt buộc = tên ảnh gốc + "-khung"
```

10 category slug cố định: `ngoai-troi`, `ca-phe`, `bien`, `pho`, `studio`, `cong-vien`, `nha-hang`, `du-lich`, `thoi-trang`, `dem`.

Xong thì chạy đúng 2 lệnh sau, theo thứ tự (từ thư mục `snappose-api/`):

```bash
# Bước 1: tự đổi tên đúng chuẩn ({so}-photo/{so}-skeleton) + tự xoá nền đen
# của ảnh khung, chuyển thành PNG nền trong suốt thật (không phải .jpg nền đen)
python -m scripts.import_raw_poses

# Bước 2: upload ảnh lên MinIO + insert vào database
python -m scripts.seed
```

- Trên máy Windows đang dùng `.pyembed`, chạy `.pyembed/python.exe -m scripts.import_raw_poses` và `.pyembed/python.exe -m scripts.seed` thay vì `python`.
- Cả 2 lệnh **an toàn chạy lại nhiều lần** — chỉ xử lý ảnh mới/pose mới, không đụng ảnh/pose đã có sẵn.
- Sau khi chạy xong, tự soát lại 1 lượt bằng checklist ở trên trên chính ảnh đã ra (mở file `.png` skeleton vừa tạo lên xem) — script chỉ lo đúng *kỹ thuật* (tên file, nền trong suốt), không lo được nội dung ảnh có đúng yêu cầu hay không.
- Báo Minh sau khi seed xong — bên Minh cần chạy lại script tính embedding cho pose mới (xem [PLAN_MINH.md](PLAN_MINH.md)).
