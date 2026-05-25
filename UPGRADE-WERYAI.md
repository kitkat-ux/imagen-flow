# Upgrade: thêm WeryAI GPT_IMAGE_2 provider

Patch này thêm tích hợp **WeryAI** (model key `GPT_IMAGE_2`) vào project hiện có.

## Cách áp dụng

Giải nén file zip này **đè lên** thư mục `imagen-flow/` của bạn — các file đều là replace/add, không xoá. DB và ảnh đã lưu không bị ảnh hưởng (không có migration).

```bash
# Từ thư mục cha của imagen-flow:
unzip -o imagen-flow-weryai-patch.zip
```

Sau khi giải nén:

```bash
# 1. Restart backend
cd imagen-flow/backend
# (nếu đang chạy uvicorn --reload thì nó tự reload)
# Nếu chưa, kích hoạt venv và chạy:
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 2. Frontend không cần install thêm gì, chỉ cần dev server đang chạy:
cd ../frontend
npm run dev
```

> Docker: `docker compose up --build -d` (rebuild để đưa code mới vào image).

## Thay đổi

### Files mới
- `backend/app/providers/weryai_provider.py` — client + helpers cho WeryAI API
- `backend/app/nodes/weryai.py` — 2 node mới (`text2image`, `image2image`)
- `examples/weryai-text2image.json` — workflow ví dụ T2I
- `examples/weryai-image2image-chain.json` — workflow ví dụ T2I → I2I chain

### Files chỉnh sửa
- `backend/app/nodes/inputs.py` — thêm node `input.image_url` (paste URL ảnh thẳng)
- `backend/app/nodes/registry.py` — load module `weryai`
- `backend/app/executor/context.py` — thêm `get_weryai_provider()`
- `backend/app/api/settings.py` — refactor sang generic provider, giữ tương thích URL cũ + thêm `/api/settings/weryai`
- `frontend/src/api/client.ts` — thêm `getWeryAIStatus / setWeryAIKey / deleteWeryAIKey`
- `frontend/src/components/SettingsPanel.tsx` — refactor thành component `<ProviderCard>` tái sử dụng, hiển thị OpenAI + WeryAI
- `README.md` — thêm section providers + troubleshooting WeryAI

## Bắt đầu dùng

1. Vào tab **Settings** → mục **WeryAI** → dán API key (lấy ở https://weryai.com/api/keys) → **Lưu**.
2. Vào tab **Canvas**. Trong palette bên trái dưới mục **Generator** có 2 node mới:
   - `WeryAI · GPT Image 2 (T2I)` — text-to-image
   - `WeryAI · GPT Image 2 (I2I)` — image-to-image
3. Workflow T2I cơ bản: `Text Prompt` → `WeryAI · GPT Image 2 (T2I)` → `Save Image`. Bấm **Run**.
4. Workflow I2I chain: như trên rồi nối output của T2I node vào input `image` của một node I2I khác, kèm prompt mới.

## Aspect ratios GPT_IMAGE_2

**Text-to-image** (13 lựa chọn):
`1:1`, `2:3`, `3:4`, `3:2`, `4:3`, `4:5`, `5:4`, `16:9(1k)`, `16:9(2k)`, `16:9(4k)`, `9:16(1k)`, `9:16(2k)`, `9:16(4k)`

**Image-to-image** (11 lựa chọn, không có `4:5`, `5:4`):
`1:1`, `2:3`, `3:4`, `3:2`, `4:3`, `16:9(1k)`, `16:9(2k)`, `16:9(4k)`, `9:16(1k)`, `9:16(2k)`, `9:16(4k)`

**Quality**: `low`, `medium`, `high`.

## Cách Image-to-Image xử lý input

Node `WeryAI · GPT Image 2 (I2I)` có input `image` chấp nhận **cả hai**:
- **URL** (string bắt đầu bằng `http://` hoặc `https://`) — provider gửi thẳng vào field `images` của API.
- **Base64 PNG** (output từ một node generator khác) — provider tự động upload qua endpoint `/v1/generation/upload-file` để lấy URL trước khi submit task.

⚠ Theo docs WeryAI: chỉ paying users mới được upload file. Nếu account của bạn không upload được, hãy:
- Dùng node `Image URL` (palette → Input) để paste URL ảnh public, hoặc
- Host ảnh ở dịch vụ khác (Imgur, S3, …) và paste URL.

## Polling behavior

WeryAI là async API. Provider tự động:
- Submit task → nhận `task_id`
- Poll `/v1/generation/{taskId}/status` mỗi **3 giây**
- Timeout sau **10 phút** (`POLL_MAX_WAIT` trong `weryai_provider.py`)
- Khi task `succeed`: download URL ảnh → base64 → trả về dưới dạng PNG b64 đồng nhất với OpenAI node

UI thấy node ở trạng thái "running" (vàng nhấp nháy) cho đến khi xong.
