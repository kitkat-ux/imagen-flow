import { useState } from 'react'
import { createRun, uploadImage } from '../api/client'
import { subscribeRun } from '../ws/runWs'
import {
  getDependencyNodeIds,
  serializeGraphForNode,
  useWorkflow,
} from '../stores/workflowStore'
import type { ParamSpec } from '../types'

export default function Inspector() {
  const {
    nodes, selectedNodeId, updateNodeParams, removeNode,
    setRunId, applyRunEvent, resetRunStatuses,
  } = useWorkflow()
  const [runError, setRunError] = useState<string | null>(null)
  const [isNodeRunActive, setNodeRunActive] = useState(false)
  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) {
    return (
      <aside className="w-80 shrink-0 bg-panel border-l border-line p-4 text-xs text-neutral-500">
        Chọn 1 node trên canvas để chỉnh tham số.
      </aside>
    )
  }

  const { spec, params, status, error } = node.data

  const onChange = (name: string, value: any) => updateNodeParams(node.id, { [name]: value })

  const onRunNode = async () => {
    setRunError(null)
    const dependencyIds = getDependencyNodeIds(node.id)
    if (dependencyIds.length === 0) {
      setRunError('Khong tim thay node de chay.')
      return
    }

    resetRunStatuses(dependencyIds)
    try {
      setNodeRunActive(true)
      const run = await createRun(serializeGraphForNode(node.id))
      setRunId(run.id)
      const unsub = subscribeRun(run.id, (evt) => {
        applyRunEvent(evt)
        if (evt.type === 'run_finished') {
          setNodeRunActive(false)
          if (evt.status === 'failed') setRunError(evt.error || 'Run node that bai.')
          setTimeout(unsub, 600)
        }
      })
    } catch (e: any) {
      setNodeRunActive(false)
      setRunError(e?.response?.data?.detail || e?.message || 'Loi khong xac dinh')
    }
  }

  return (
    <aside className="w-80 shrink-0 bg-panel border-l border-line overflow-y-auto">
      <div className="px-4 py-3 border-b border-line">
        <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">
          {spec.category}
        </div>
        <div className="text-sm text-paper font-semibold">{spec.label}</div>
        {spec.description && <div className="text-[11px] text-neutral-500 mt-1">{spec.description}</div>}
      </div>

      <div className="p-4 space-y-4">
        <button
          onClick={onRunNode}
          disabled={isNodeRunActive || status === 'running'}
          className="w-full text-xs px-3 py-2 bg-accent text-ink rounded font-display uppercase tracking-wider hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isNodeRunActive || status === 'running' ? 'Running...' : 'Run node'}
        </button>

        {runError && (
          <div className="rounded border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger break-words">
            {runError}
          </div>
        )}

        {spec.params.length === 0 && (
          <div className="text-xs text-neutral-500">Node này không có tham số.</div>
        )}

        {spec.params.map((p) => (
          <ParamField key={p.name} param={p} value={params[p.name]} onChange={(v) => onChange(p.name, v)} />
        ))}

        {status === 'failed' && error && (
          <div className="rounded border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger break-words">
            ⚠ {error}
          </div>
        )}

        <button
          onClick={() => removeNode(node.id)}
          className="w-full mt-4 text-xs px-3 py-2 border border-danger/40 text-danger rounded hover:bg-danger/10"
        >
          Xoá node
        </button>
      </div>
    </aside>
  )
}

function ParamField({
  param, value, onChange,
}: { param: ParamSpec; value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const onFileChange = async (file?: File) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const uploaded = await uploadImage(file)
      onChange(uploaded.url)
    } catch (e: any) {
      setUploadError(e?.response?.data?.detail || e?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="block text-[11px] font-display uppercase tracking-wider text-neutral-500 mb-1">
        {param.label}
      </label>
      {param.type === 'textarea' && (
        <textarea
          value={value ?? ''}
          placeholder={param.placeholder ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full bg-ink border border-line rounded px-2 py-1 text-xs text-paper focus:outline-none focus:border-accent"
        />
      )}
      {param.type === 'string' && (
        <input
          type="text"
          value={value ?? ''}
          placeholder={param.placeholder ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-ink border border-line rounded px-2 py-1 text-xs text-paper focus:outline-none focus:border-accent"
        />
      )}
      {param.type === 'file' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => onFileChange(e.target.files?.[0])}
            className="w-full bg-ink border border-line rounded px-2 py-1 text-xs text-paper file:mr-3 file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-ink disabled:opacity-50"
          />
          {uploading && <div className="text-[11px] text-neutral-500">Uploading...</div>}
          {value && (
            <div className="truncate text-[10px] text-accent" title={String(value)}>
              {String(value)}
            </div>
          )}
          {uploadError && (
            <div className="text-[11px] text-danger break-words">{uploadError}</div>
          )}
        </div>
      )}
      {param.type === 'number' && (
        <input
          type="number"
          value={value ?? 0}
          min={param.min ?? undefined}
          max={param.max ?? undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-ink border border-line rounded px-2 py-1 text-xs text-paper focus:outline-none focus:border-accent"
        />
      )}
      {param.type === 'select' && (
        <select
          value={value ?? param.default ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-ink border border-line rounded px-2 py-1 text-xs text-paper focus:outline-none focus:border-accent"
        >
          {(param.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {param.type === 'boolean' && (
        <label className="inline-flex items-center gap-2 text-xs text-paper">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          Bật
        </label>
      )}
    </div>
  )
}
