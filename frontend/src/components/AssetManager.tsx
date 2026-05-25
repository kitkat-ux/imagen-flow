import { useEffect, useState } from 'react'
import { listAssets } from '../api/client'
import { useWorkflow } from '../stores/workflowStore'
import type { AssetItem } from '../types'

export default function AssetManager() {
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addLocalImageNode } = useWorkflow()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setAssets(await listAssets())
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Assets</div>
          <div className="text-lg text-paper">Uploaded images</div>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}
      {!loading && !error && assets.length === 0 && (
        <div className="text-sm text-neutral-500">
          No uploaded assets yet. Upload an image from a Local Image node first.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {assets.map((asset) => (
          <div key={asset.id} className="border border-line bg-panel rounded overflow-hidden">
            <div className="aspect-square bg-ink">
              <img src={asset.url} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-3 space-y-2">
              <div className="text-xs text-paper truncate" title={asset.filename ?? asset.url}>
                {asset.filename || 'Uploaded image'}
              </div>
              <div className="text-[10px] text-neutral-500">
                {asset.provider} / {new Date(`${asset.created_at}Z`).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addLocalImageNode(asset.url)}
                  className="flex-1 text-xs px-2 py-1 bg-accent text-ink rounded font-display uppercase tracking-wider hover:bg-lime-300"
                >
                  Use
                </button>
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 border border-line rounded hover:border-accent hover:text-accent"
                >
                  Open
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
