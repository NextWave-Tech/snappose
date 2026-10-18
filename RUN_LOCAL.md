# Chạy SnapPose local (Backend + Cloudflared + Mobile)

Guide nhanh để chạy lại mà không cần đọc source. Không bao gồm `snappose-web`. Không dùng ngrok.
Lệnh dùng **Git Bash**, chạy từ gốc repo `E:\Project\Startup-Project\snappose`.

## Cách nhanh: 1 lệnh
```bash
./dev-up.sh
```
Script sẽ: bật Docker Postgres (nếu chưa) → backend `:8000` → 2 tunnel cloudflared (API và Metro) → ghi URL API vào `snappose-mobile/.env` → chạy Metro. Nó in ra:
```
API   : https://aaaa.trycloudflare.com
METRO : https://bbbb.trycloudflare.com   <- nhập URL này trong app
```
Trên điện thoại: mở app SnapPose → **Enter URL manually** → dán URL `METRO` → Connect. Không cần USB, không cần chung Wi-Fi.
Log nằm trong `.devlogs/`. `Ctrl+C` tắt tất cả.

## Cơ chế

```
Điện thoại (APK dev build)
  ├─ tải code JS ──> https://<metro>.trycloudflare.com ──> Metro :8081 (máy dev)
  └─ gọi API ─────> https://<api>.trycloudflare.com   ──> FastAPI :8000 ──> Postgres :5432 (Docker)
```
- APK trên điện thoại (`app-debug.apk`, có `expo-dev-client`) chỉ chứa phần native (camera, Skia…), **không có code JS** (không có `index.android.bundle`). Mỗi lần mở app, nó tải JS từ Metro.
- `EXPO_PACKAGER_PROXY_URL=<metro tunnel>` bắt Metro trả về manifest trỏ bundle qua URL cloudflare thay vì IP LAN, nên điện thoại ở mạng nào cũng tải được.
- `EXPO_PUBLIC_API_URL` trong `.env` được nhúng vào bundle lúc build → đổi URL API thì phải chạy lại Metro với `--clear` (script đã làm sẵn).
- Chỉ phải build/cài lại APK khi đổi native (thêm native module, sửa plugin/permission trong `app.json`).

**Hạn chế của quick tunnel:** URL `trycloudflare.com` đổi **mỗi lần** chạy lại → mỗi lần phải nhập URL Metro mới trong app. Trước đây (`expo start --tunnel`, chạy qua ngrok) có địa chỉ cố định `8w_wdn0-anonymous-8081.exp.direct` nên app tự vào. Muốn URL cloudflare cố định thì cần tài khoản Cloudflare + một domain để tạo *named tunnel* (`cloudflared tunnel login` / `create` / `route dns`).

## Chạy tay từng bước (nếu không dùng script)

| Thành phần | Cổng | Ghi chú |
|---|---|---|
| Postgres + MinIO (Docker) | 5432, 9000/9001 | `snappose-api/docker-compose.yml`, `restart: unless-stopped` |
| Backend FastAPI | 8000 | Dùng `snappose-api/.pyembed/python.exe` (KHÔNG dùng venv/system Python, bị hỏng) |
| Cloudflared × 2 | — | 1 cho :8000, 1 cho :8081 |
| Metro (dev client) | 8081 | App dùng `react-native-vision-camera` → **không chạy trên Expo Go** |

```bash
CF="/c/Program Files (x86)/cloudflared/cloudflared"

# 0. Docker (mở Docker Desktop trước)
docker ps | grep snappose-api-postgres || (cd snappose-api && docker compose up -d)

# 1. Backend (terminal 1)
cd snappose-api && ./.pyembed/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Tunnel API (terminal 2) → lấy URL https://aaaa.trycloudflare.com trong log
"$CF" tunnel --url http://localhost:8000

# 3. Tunnel Metro (terminal 3) → lấy URL https://bbbb.trycloudflare.com
"$CF" tunnel --url http://localhost:8081

# 4. Ghi URL API cho mobile
sed -i 's#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=https://aaaa.trycloudflare.com#' snappose-mobile/.env

# 5. Metro (terminal 4)
cd snappose-mobile && EXPO_PACKAGER_PROXY_URL=https://bbbb.trycloudflare.com npx expo start --dev-client --clear
```
Rồi nhập `https://bbbb.trycloudflare.com` trong app. Lần đầu bundle Android mất ~50 giây.

Ghi chú backend: lần đầu gọi gợi ý pose sẽ load model CLIP (CPU), chậm vài giây; cảnh báo `HF_TOKEN` bỏ qua được. DB trống thì chạy `./.pyembed/python.exe scripts/seed.py`.

## Checklist
```bash
curl -s localhost:8000/api/categories | head -c 100          # backend
curl -s https://aaaa.trycloudflare.com/api/categories | head -c 100   # tunnel API
curl -s https://bbbb.trycloudflare.com/status                 # tunnel Metro → packager-status:running
```

## Lỗi hay gặp
- **App mở URL cũ rồi báo lỗi**: tunnel đã đổi URL → nhập URL Metro mới (lắc máy / nút dev menu → Go home → Enter URL).
- **App mở được nhưng không load pose**: tunnel API chết hoặc `.env` còn URL cũ → chạy lại Metro với `--clear` sau khi sửa `.env`.
- **URL tunnel mới tạo trả 530/1033**: đợi ~10 giây cho DNS lên.
- **Cổng 8000/8081 bị chiếm**: `netstat -ano | grep :8081` rồi `taskkill //PID <pid> //F //T`.
- **Lỗi kết nối DB**: Docker Desktop chưa bật. Máy này còn một Postgres trong WSL nghe `127.0.0.1:5432`; nếu backend báo sai mật khẩu/không có DB `snappose`, chạy `wsl --shutdown` rồi thử lại.
- **Cài APK mới**: file ở `snappose-mobile/android/app/build/outputs/apk/debug/app-debug.apk`; build lại bằng `npx expo run:android` khi đổi native.

## Đăng nhập Google (cấu hình một lần)

App dùng `@react-native-google-signin/google-signin` (native → cần APK build sau khi thêm thư viện). Luồng: app lấy **ID token** từ Google → `POST /api/auth/google` → server kiểm tra chữ ký bằng khóa công khai của Google, tạo/cập nhật bảng `users`, trả JWT SnapPose (30 ngày, `typ: "user"` — không dùng được cho API admin).

Trên https://console.cloud.google.com (một project, ví dụ "SnapPose"):
1. **APIs & Services → OAuth consent screen**: External, điền tên app + email; ở chế độ *Testing* thì thêm email người test vào **Test users**.
2. **Credentials → Create credentials → OAuth client ID → Android**:
   - Package name: `com.nextwavetech.snappose`
   - SHA-1 (keystore debug của Expo, `snappose-mobile/android/app/debug.keystore`): `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - Client ID này **không** cần copy vào đâu, Google tự khớp theo package + SHA-1. Build release/EAS dùng keystore khác → thêm một Android client nữa với SHA-1 của keystore đó.
3. **Create credentials → OAuth client ID → Web application** (không cần redirect URI). Copy **Client ID** dạng `xxxx.apps.googleusercontent.com`:
   - `snappose-mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>` rồi chạy lại Metro với `--clear`.
   - `snappose-api/.env`: `GOOGLE_CLIENT_IDS=<web client id>` rồi khởi động lại backend.

Lấy lại SHA-1: `"/c/Program Files/Java/jdk-21/bin/keytool" -list -v -keystore snappose-mobile/android/app/debug.keystore -storepass android -alias androiddebugkey | grep SHA1`

Lỗi hay gặp: báo "Cấu hình Google chưa khớp" (DEVELOPER_ERROR) = sai package/SHA-1 ở Android client, hoặc `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` không phải client loại **Web**.
