# SnapPose — Web (Frontend)

React + Vite. Camera chụp ảnh qua `getUserMedia`, skeleton overlay hiển thị riêng (không lẫn vào ảnh chụp).

## Chạy local

```bash
npm install
cp .env.example .env   # chỉnh VITE_API_URL nếu backend chạy port khác
npm run dev
```

Mở `http://localhost:5173`. Trang admin: `http://localhost:5173/admin`.

**Lưu ý camera trên điện thoại:** browser chỉ cho phép `getUserMedia` trên `localhost` hoặc origin HTTPS. Test trên desktop browser ở `localhost` là đủ cho dev. Để test trên điện thoại thật cần deploy lên HTTPS (hoặc dùng ngrok/tunnel) — sẽ làm ở giai đoạn deploy.

## Cấu trúc

- `src/screens/` — Splash, Camera, Result (end-user flow, không có Home/login)
- `src/admin/` — trang quản lý category/pose (`/admin`, cần đăng nhập)
- `src/components/CameraPreview.jsx` — getUserMedia + canvas capture (overlay không bao giờ được vẽ vào canvas)
- `src/api/` — gọi backend FastAPI

## Backend

Cần chạy `snappose-api` (repo riêng, xem README ở đó) trước khi dùng app này — camera screen và admin panel đều fetch dữ liệu từ đó.
