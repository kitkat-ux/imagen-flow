# ImagenFlow

> Web local **kéo-thả node-based** để tạo ảnh bằng AI (kiểu mini-ComfyUI), provider khởi đầu là **OpenAI** (gpt-image-1 / gpt-image-2 / dall-e-3).

**Stack:** FastAPI + SQLAlchemy + WebSocket (backend) · React + React Flow + Zustand + Tailwind (frontend) · SQLite (dev) / PostgreSQL (Docker).

---

## ✨ Tính năng

- 🎛 **Node-based editor** kéo-thả: kéo node từ palette → canvas → nối port → Run
- ⚡ **Executor song song**: các node độc lập trong cùng một level chạy đồng thời bằng `asyncio.gather`
- 🔌 **WebSocket realtime**: theo dõi từng node đang chạy / hoàn thành / lỗi ngay trên canvas
- 🖼 **Gallery** lưu ảnh đã tạo + tải xuống / xoá
- 🔐 **API key mã hoá** (Fernet) lưu trong DB local, nhập qua UI Settings
- 🤖 **Multi-provider**: OpenAI (sync) + WeryAI GPT_IMAGE_2 (async với polling) đã được tích hợp sẵn
- 🐳 **Docker Compose** sẵn sàng (frontend + backend + Postgres)

---

## 🤖 Providers đã hỗ trợ

| Provider | Model | Kiểu node | Ghi chú |
|---|---|---|---|
| **OpenAI** | `gpt-image-1`, `dall-e-3` | `openai.image.generate` | Sync API |
| **WeryAI** | `GPT_IMAGE_2` | `weryai.gpt_image_2.text2image` | Async (submit → poll), 13 aspect ratios |
| **WeryAI** | `GPT_IMAGE_2` | `weryai.gpt_image_2.image2image` | Async, tự upload ảnh chain (base64 → URL) |

---

## 🚀 Bắt đầu nhanh (dev local — không Docker)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Tạo MASTER_KEY (Fernet 32-byte base64):
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Mở .env, dán giá trị vào MASTER_KEY=...
uvicorn app.main:app --reload --port 8000
```

Mở http://localhost:8000/docs để xem OpenAPI.

### 2. Frontend (terminal mới)

```bash
cd frontend
npm install
npm run dev
```

Mở **http://localhost:5173**.

### 3. Cấu hình OpenAI API key

- Vào tab **Settings** → nhập API key (lấy ở https://platform.openai.com/api-keys) → **Lưu**.

### 4. Workflow đầu tiên

1. Vào tab **Canvas**.
2. Kéo lần lượt từ palette bên trái: **Text Prompt** → **OpenAI Image** → **Save Image**.
3. Click node **Text Prompt**, sửa prompt trong **Inspector** bên phải.
4. Nối các port: `text` → `prompt` của OpenAI Image; `image` của OpenAI Image → `image` của Save Image; (tuỳ chọn) nối `text` → `prompt` của Save Image để lưu prompt đi cùng ảnh.
5. Bấm **▶ Run** ở thanh trên cùng.
6. Khi xong, vào tab **Gallery** để xem ảnh.

> 💡 File ví dụ workflow nằm ở `examples/hello-world.json`.

---

## 🐳 Chạy bằng Docker

### Production (Postgres + nginx)

```bash
# Tạo MASTER_KEY
export MASTER_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

docker compose up --build -d
```

- Frontend: http://localhost:8080
- Backend (REST + WS): http://localhost:8000

### Dev mode (hot reload, SQLite)

```bash
export MASTER_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
docker compose -f docker-compose.dev.yml up --build
```

- Frontend (Vite): http://localhost:5173
- Backend (uvicorn --reload): http://localhost:8000

---

## 📐 Kiến trúc

```
frontend (React + React Flow)
        │ REST + WebSocket
        ▼
backend (FastAPI)
  ├── api/        REST endpoints (workflows, runs, gallery, settings, nodes)
  ├── ws/         WebSocket cho realtime run updates
  ├── nodes/      Node registry + node implementations
  ├── executor/   Graph parser, topological sort, runner (asyncio parallel)
  ├── providers/  OpenAI client (mở rộng được)
  ├── db/         SQLAlchemy models, async session
  └── core/       Config (pydantic-settings), Fernet encryption
        │
        ▼
SQLite (./data/app.db) hoặc PostgreSQL (Docker)
ảnh + thumbnail lưu ở ./data/images/, ./data/thumbnails/
```

### Flow của một lần Run

1. FE serialize graph (`{nodes, edges}`) → POST `/api/runs`
2. BE tạo `Run` record, trả về ngay; chạy `execute_run` trong `asyncio.create_task`
3. FE mở WebSocket `/ws/runs/{run_id}`
4. BE parse graph → topological sort → mỗi level chạy song song
5. Mỗi node: emit `node_started` → execute → emit `node_finished` (kèm `preview_b64` nếu có)
6. Kết thúc: `run_finished` (success/failed)
7. Node `output.save` lưu ảnh ra disk + record vào `generated_images` → hiện ở Gallery

---

## 🧩 Cách thêm Node mới

1. Tạo class kế thừa `BaseNode` trong `backend/app/nodes/`:

```python
from .base import BaseNode, NodeSpec, PortSpec, ParamSpec, PORT_STRING
from .registry import register

@register
class UppercaseTextNode(BaseNode):
    spec = NodeSpec(
        type="text.uppercase",
        category="processing",
        label="Uppercase",
        description="Chuyển text về uppercase",
        inputs=[PortSpec(name="text", type=PORT_STRING)],
        outputs=[PortSpec(name="text", type=PORT_STRING)],
        params=[],
    )

    async def execute(self, params, inputs, ctx):
        return {"text": (inputs.get("text") or "").upper()}
```

2. Import nó trong `backend/app/nodes/registry.py` → `load_builtins()`:

```python
def load_builtins():
    from . import inputs, generators, outputs, my_new_module  # noqa
```

3. Restart backend. Node xuất hiện trong palette FE tự động (FE đọc từ `/api/nodes/registry`).

---

## 🔌 Cách thêm Provider mới (Replicate, Stability...)

1. Thêm `backend/app/providers/replicate_provider.py` theo mẫu `openai_provider.py`.
2. Thêm setting key (vd `replicate.api_key`) trong `backend/app/api/settings.py` + UI tương ứng trong `frontend/src/components/SettingsPanel.tsx`.
3. Thêm 1 node generator mới trong `backend/app/nodes/generators.py`.
4. `ExecutionContext` có thể được mở rộng để cung cấp helper `get_replicate_provider()`.

---

## 🛣 Roadmap (xem `quy-trinh-web-tao-anh-node.md`)

- [x] **Phase 0–4**: Setup, node editor FE, BE MVP, executor parallel, persistence, gallery
- [ ] **Phase 5**: Logic nodes (If/Else, Loop) — đã có sẵn cấu trúc, cần implement
- [ ] **Phase 6**: Polish UI (undo/redo, hotkey, viewport persist)
- [ ] **Phase 7**: Provider abstraction sạch hơn (đăng ký provider tương tự node registry)
- [x] **Phase 8**: Docker hoá

---

## 🐛 Troubleshooting

- **`MASTER_KEY` lỗi**: phải là base64 url-safe 32 bytes. Generate bằng `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. (App hiện auto-derive SHA-256 từ chuỗi bất kỳ nên giá trị string thường cũng chạy được, nhưng nên dùng key chuẩn cho production.)
- **OpenAI 404 model**: tên model `gpt-image-2` có thể chưa khả dụng trên account của bạn — đổi sang `gpt-image-1` hoặc `dall-e-3` trong inspector.
- **WeryAI task timeout**: mặc định poll tối đa 10 phút (`POLL_MAX_WAIT` trong `weryai_provider.py`). Nếu hay timeout, tăng giá trị này hoặc kiểm tra credit còn lại tại weryai.com.
- **WeryAI image-to-image lỗi upload**: docs ghi rõ "Only paying users are allowed to upload files" — nếu bạn chỉ chain T2I → I2I qua URL output (không base64), provider sẽ không cần upload. Để chain qua base64 từ một node khác, cần account trả phí.
- **CORS lỗi**: chỉnh `CORS_ORIGINS` trong `.env` cho khớp origin của frontend.
- **WebSocket không connect (Docker)**: nginx đã proxy `/ws/`, đảm bảo bạn truy cập qua port `8080` chứ không phải `8000` ở chế độ Docker prod.

---

## 📄 License

MIT — dùng tự do, sửa thoải mái.
