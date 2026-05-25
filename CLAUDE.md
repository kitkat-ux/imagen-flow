# ImagenFlow — Sổ tay kỹ thuật

## Trạng thái dự án

Xem `CODEX.md` để biết lịch sử cập nhật tính năng.

---

## Docker Setup & Deploy VPS (24/7)

> Cập nhật: 2026-05-26

### Tổng quan kiến trúc Docker

```
[Browser]
    │ HTTP port 8080
    ▼
[Frontend — Nginx container]
    │ proxy /api/ và /ws/ → port 8000
    ▼
[Backend — FastAPI container]
    │ asyncpg
    ▼
[Database — PostgreSQL container]

[Volume: db_data] ← dữ liệu Postgres
[Volume: data]    ← ảnh sinh ra, thumbnails
```

Toàn bộ chạy bằng một lệnh `docker compose up -d`. Khi tắt máy local, server VPS vẫn chạy 24/7.

---

### Các file liên quan đến Docker

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Kịch bản khởi động 3 services: db, backend, frontend |
| `backend/Dockerfile` | Build image Python/FastAPI |
| `backend/railway.toml` | Cấu hình Railway cho backend service |
| `frontend/Dockerfile` | Build React → Nginx image |
| `frontend/nginx.conf` | Template proxy /api/ và /ws/ — dùng `${BACKEND_HOST}` |
| `frontend/railway.toml` | Cấu hình Railway cho frontend service |
| `.env.example` | Template biến môi trường (copy thành .env) |
| `.env` | Biến thật (không commit lên git) |

**Cơ chế `${BACKEND_HOST}`:** nginx image tự chạy `envsubst` khi khởi động, thay `${BACKEND_HOST}` bằng giá trị thật. Docker local dùng `backend`, Railway dùng `backend.railway.internal`.

---

### Biến môi trường quan trọng (docker-compose.yml đọc từ .env)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `MASTER_KEY` | Có | Fernet key mã hoá API keys trong DB |
| `CORS_ORIGINS` | Có | URL frontend được phép gọi API |
| `LOG_LEVEL` | Không | DEBUG / INFO / WARNING / ERROR |
| `CLOUDINARY_CLOUD_NAME` | Không | Dùng cho Local Image node |
| `CLOUDINARY_UPLOAD_PRESET` | Không | Dùng cho Local Image node |

---

### Quy trình 1 — Chạy Docker local (test trước khi lên VPS)

**Bước 1:** Tạo file `.env` ở thư mục gốc

```bash
cp .env.example .env
```

Mở `.env`, điền:
```
MASTER_KEY=<key tạo bằng lệnh bên dưới>
CORS_ORIGINS=http://localhost:8080
```

Tạo MASTER_KEY:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Bước 2:** Build và chạy

```bash
docker compose up --build -d
```

- Frontend: http://localhost:8080
- Backend API docs: http://localhost:8000/docs

**Bước 3:** Xem log nếu có lỗi

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

**Bước 4:** Dừng

```bash
docker compose down
```

---

### Quy trình 2 — Deploy lên VPS (24/7)

**Yêu cầu VPS:** Ubuntu 22.04+, RAM tối thiểu 1GB (khuyến nghị 2GB)

#### 2.1 Cài Docker trên VPS

SSH vào VPS rồi chạy:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Đăng xuất rồi đăng nhập lại để có quyền docker
```

#### 2.2 Copy code lên VPS

**Cách A — dùng Git (khuyến nghị):**
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/imagen-flow.git
git push -u origin main

# Trên VPS:
git clone https://github.com/YOUR_USERNAME/imagen-flow.git
cd imagen-flow
```

**Cách B — dùng SCP (không cần Git):**
```bash
# Trên máy local, chạy lệnh này:
scp -r . root@YOUR_VPS_IP:/root/imagen-flow
# Trên VPS:
cd /root/imagen-flow
```

#### 2.3 Tạo .env trên VPS

```bash
cp .env.example .env
nano .env   # hoặc vim .env
```

Điền vào `.env`:
```
MASTER_KEY=<fernet key mới tạo>
CORS_ORIGINS=http://YOUR_VPS_IP:8080
LOG_LEVEL=INFO

# Nếu dùng Cloudinary:
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_preset
CLOUDINARY_FOLDER=imagen-flow
```

> Nếu có domain (vd: app.example.com), đổi CORS_ORIGINS=https://app.example.com

#### 2.4 Mở firewall trên VPS

```bash
# DigitalOcean / Vultr: mở port trong bảng điều khiển web
# Hoặc dùng ufw:
sudo ufw allow 8080/tcp
sudo ufw allow 22/tcp    # giữ SSH
sudo ufw enable
```

> Port 8000 (backend) KHÔNG cần mở public — nginx đã proxy qua 8080

#### 2.5 Chạy

```bash
docker compose up --build -d
```

Truy cập: `http://YOUR_VPS_IP:8080`

#### 2.6 Kiểm tra services đang chạy

```bash
docker compose ps
```

Output bình thường:
```
NAME                STATUS          PORTS
imagen-flow-db-1        running (healthy)   5432/tcp
imagen-flow-backend-1   running             0.0.0.0:8000->8000/tcp
imagen-flow-frontend-1  running             0.0.0.0:8080->80/tcp
```

---

### Quy trình 3 — Cập nhật code (khi có thay đổi)

```bash
# Trên VPS, vào thư mục dự án:
git pull origin main          # nếu dùng Git

docker compose down
docker compose up --build -d  # build lại image mới

# Kiểm tra log:
docker compose logs -f backend
```

> Dữ liệu (PostgreSQL, ảnh) được lưu trong Docker volumes — KHÔNG bị mất khi rebuild image.

---

### Quy trình 4 — Backup dữ liệu

**Backup database:**
```bash
docker compose exec db pg_dump -U imagen imagen > backup_$(date +%Y%m%d).sql
```

**Restore database:**
```bash
cat backup_20260526.sql | docker compose exec -T db psql -U imagen imagen
```

**Backup ảnh đã sinh (volume data):**
```bash
docker run --rm -v imagen-flow_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/images_backup_$(date +%Y%m%d).tar.gz /data
```

---

### Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `database is locked` | Dùng SQLite thay vì Postgres | Đảm bảo chạy bằng `docker compose` (Postgres), không phải local SQLite |
| CORS error trên browser | CORS_ORIGINS sai | Kiểm tra `.env`: CORS_ORIGINS phải khớp chính xác URL đang truy cập |
| WebSocket không kết nối | Nginx chưa proxy WS | Truy cập qua port 8080, không phải 8000 |
| `MASTER_KEY` lỗi | Key không đúng định dạng | Tạo lại bằng lệnh Fernet |
| Container db không healthy | Postgres chưa kịp khởi động | Chờ 30s rồi chạy lại `docker compose up -d` |
| Không vào được web sau deploy | Firewall VPS chặn | Mở port 8080 trong bảng điều khiển VPS |

---

### Lưu ý bảo mật cho production

- Đổi password Postgres mặc định (`imagen/imagen`) trong `docker-compose.yml`
- Dùng MASTER_KEY ngẫu nhiên mạnh, không chia sẻ
- Không commit file `.env` lên git (đã có trong `.gitignore`)
- Nên đặt domain + HTTPS (Nginx reverse proxy + Let's Encrypt) thay vì dùng IP:8080

---

## Deploy lên Railway.app (không cần VPS)

> Cập nhật: 2026-05-26

### Tổng quan kiến trúc trên Railway

```
[Browser]
    │ HTTPS (Railway tự cấp)
    ▼
[Frontend service — Nginx]         railway.app/...
    │ proxy /api/ và /ws/
    │ → http://backend.railway.internal:8000  (private network)
    ▼
[Backend service — FastAPI]
    │ asyncpg (DATABASE_URL tự động từ plugin)
    ▼
[PostgreSQL Plugin]
```

Railway cung cấp HTTPS miễn phí và URL dạng `https://xxx.up.railway.app`.

### Điều chỉnh đã thực hiện để tương thích Railway

| File đã sửa | Nội dung thay đổi |
|---|---|
| `frontend/nginx.conf` | `http://backend:8000` → `http://${BACKEND_HOST}:8000` |
| `frontend/Dockerfile` | Copy nginx.conf vào `/etc/nginx/templates/` (nginx tự chạy envsubst) |
| `docker-compose.yml` | Thêm `BACKEND_HOST: backend` cho local Docker |
| `backend/app/core/config.py` | Tự chuyển `postgresql://` → `postgresql+asyncpg://` (Railway cung cấp format cũ) |
| `backend/railway.toml` | Config Railway cho backend |
| `frontend/railway.toml` | Config Railway cho frontend |

### Quy trình deploy Railway — từng bước

#### Bước 1 — Đưa code lên GitHub

Railway cần đọc code từ GitHub. Tạo repo và push code lên:

```bash
# Trên máy local (chạy trong thư mục dự án):
git init
git add .
git commit -m "initial commit"
# Tạo repo mới trên github.com rồi chạy:
git remote add origin https://github.com/TEN_BAN/imagen-flow.git
git push -u origin main
```

#### Bước 2 — Tạo project trên Railway

1. Vào [railway.app](https://railway.app) → đăng ký / đăng nhập bằng GitHub
2. Click **New Project** → **Empty Project**

#### Bước 3 — Thêm PostgreSQL

Trong project vừa tạo:
1. Click **+ Add Service** → **Database** → **Add PostgreSQL**
2. Railway tự tạo database và cấp biến `DATABASE_URL` cho các service trong cùng project

#### Bước 4 — Deploy Backend

1. Click **+ Add Service** → **GitHub Repo** → chọn repo `imagen-flow`
2. Railway hỏi **Root Directory** → nhập: `backend`
3. Railway tự detect `backend/Dockerfile` và `backend/railway.toml`
4. Vào tab **Variables** của backend service, thêm:

```
MASTER_KEY=<fernet key — tạo bằng lệnh python bên dưới>
CORS_ORIGINS=https://FRONTEND_URL.up.railway.app
LOG_LEVEL=INFO
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=<nếu có>
CLOUDINARY_UPLOAD_PRESET=<nếu có>
CLOUDINARY_FOLDER=imagen-flow
```

> `DATABASE_URL` Railway tự inject từ PostgreSQL plugin — KHÔNG cần thêm thủ công.

Tạo MASTER_KEY (chạy trên máy local):
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

5. Click **Deploy** → chờ build xong (~2–3 phút)
6. Vào **Settings** → **Networking** → **Generate Domain** → lưu lại URL backend (dạng `backend-xxx.up.railway.app`)

#### Bước 5 — Deploy Frontend

1. Click **+ Add Service** → **GitHub Repo** → chọn cùng repo `imagen-flow`
2. **Root Directory** → nhập: `frontend`
3. Railway tự detect `frontend/Dockerfile` và `frontend/railway.toml`
4. Vào tab **Variables** của frontend service, thêm:

```
BACKEND_HOST=backend.railway.internal
```

> `backend.railway.internal` là hostname nội bộ Railway — frontend nginx proxy về backend qua mạng riêng, không qua internet.

5. Click **Deploy** → chờ build xong
6. Vào **Settings** → **Networking** → **Generate Domain** → lưu lại URL frontend (dạng `frontend-xxx.up.railway.app`)

#### Bước 6 — Cập nhật CORS_ORIGINS cho Backend

Sau khi có URL frontend thật:
1. Vào backend service → tab **Variables**
2. Sửa `CORS_ORIGINS` thành URL frontend Railway (vd: `https://frontend-xxx.up.railway.app`)
3. Railway tự redeploy backend

#### Bước 7 — Kiểm tra

Mở `https://frontend-xxx.up.railway.app` trên trình duyệt:
- Vào **Settings** → nhập API key (WeryAI / Cloudinary)
- Tạo workflow và bấm **Run**
- WebSocket realtime hoạt động → node chuyển màu khi chạy

### Biến môi trường đầy đủ trên Railway

**Backend service:**

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `DATABASE_URL` | *(tự động)* | Railway inject từ PostgreSQL plugin |
| `MASTER_KEY` | fernet key | Tạo bằng python |
| `CORS_ORIGINS` | `https://frontend-xxx.up.railway.app` | URL frontend Railway |
| `LOG_LEVEL` | `INFO` | |
| `DATA_DIR` | `/data` | Mặc định trong Dockerfile |
| `CLOUDINARY_CLOUD_NAME` | *(nếu có)* | |
| `CLOUDINARY_UPLOAD_PRESET` | *(nếu có)* | |

**Frontend service:**

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `BACKEND_HOST` | `backend.railway.internal` | Railway private network |

### Cập nhật code sau khi đã deploy Railway

Railway **tự động redeploy** mỗi khi bạn push code lên GitHub:

```bash
# Trên máy local — sửa code xong thì:
git add .
git commit -m "mô tả thay đổi"
git push origin main
# Railway tự detect push → build lại → deploy tự động
```

### Xử lý lỗi thường gặp trên Railway

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Build failed — backend | Thiếu package | Kiểm tra `requirements.txt` |
| `asyncpg` connect failed | DATABASE_URL sai format | Railway tự fix nhờ `config.py` validator — xem log |
| CORS error | CORS_ORIGINS chưa khớp URL frontend | Cập nhật `CORS_ORIGINS` trong backend Variables |
| WebSocket không kết nối | `BACKEND_HOST` sai | Đảm bảo frontend Variables có `BACKEND_HOST=backend.railway.internal` |
| Frontend trắng trang | nginx không resolve backend | Kiểm tra `BACKEND_HOST` và Railway private networking đã bật |
| 502 Bad Gateway | Backend chưa kịp start | Chờ 1–2 phút, Railway có health check tự retry |
