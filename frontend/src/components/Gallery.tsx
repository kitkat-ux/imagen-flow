import { useEffect, useState } from 'react'
import { deleteImage, imageFileUrl, imageThumbUrl, listImages } from '../api/client'
import type { GalleryImage } from '../types'

export default function Gallery() {
  const [items, setItems] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GalleryImage | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setItems(await listImages())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onDelete = async (id: string) => {
    if (!confirm('Xoá ảnh này?')) return
    await deleteImage(id)
    setSelected(null)
    load()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Gallery</div>
          <div className="text-lg text-paper">Ảnh đã sinh</div>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
        >
          ⟳ Refresh
        </button>
      </div>

      {loading && <div className="text-neutral-500 text-sm">Đang tải…</div>}
      {!loading && items.length === 0 && (
        <div className="text-neutral-500 text-sm">Chưa có ảnh nào. Hãy chạy 1 workflow có node "Save Image".</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setSelected(it)}
            className="group relative aspect-square overflow-hidden rounded border border-line hover:border-accent"
          >
            <img
              src={imageThumbUrl(it.id)}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            {it.prompt && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-paper text-left line-clamp-2 opacity-0 group-hover:opacity-100">
                {it.prompt}
              </div>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-panel border border-line rounded max-w-5xl w-full max-h-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-line">
              <div className="text-xs text-neutral-400">
                {new Date(selected.created_at + 'Z').toLocaleString()}
              </div>
              <div className="flex gap-2">
                <a
                  href={imageFileUrl(selected.id)}
                  download
                  className="text-xs px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
                >
                  ↓ Download
                </a>
                <button
                  onClick={() => onDelete(selected.id)}
                  className="text-xs px-3 py-1 border border-danger/40 text-danger rounded hover:bg-danger/10"
                >
                  🗑 Xoá
                </button>
                <button onClick={() => setSelected(null)} className="text-xs px-3 py-1 border border-line rounded">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-ink flex items-center justify-center">
              <img src={imageFileUrl(selected.id)} alt="" className="max-w-full max-h-[70vh] object-contain" />
            </div>
            {selected.prompt && (
              <div className="p-3 border-t border-line text-xs text-neutral-300">
                <span className="text-neutral-500">Prompt: </span>
                {selected.prompt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
