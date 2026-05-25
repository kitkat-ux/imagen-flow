import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeData } from '../../types'

const CATEGORY_COLORS: Record<string, string> = {
  input: 'border-l-sky-400',
  generator: 'border-l-fuchsia-400',
  processing: 'border-l-amber-400',
  logic: 'border-l-violet-400',
  output: 'border-l-accent',
}

const STATUS_STYLES: Record<string, string> = {
  idle: 'ring-1 ring-line',
  running: 'ring-2 ring-warn animate-pulse',
  success: 'ring-2 ring-accent',
  failed: 'ring-2 ring-danger',
}

function GenericNodeImpl({ data, selected }: NodeProps) {
  const d = data as NodeData
  const { spec, params, status = 'idle', preview, error } = d
  const previewSrc = typeof preview === 'string' && preview.startsWith('http')
    ? preview
    : `data:image/png;base64,${preview}`
  const colorClass = CATEGORY_COLORS[spec.category] ?? 'border-l-line'
  const statusClass = STATUS_STYLES[status] ?? 'ring-1 ring-line'

  return (
    <div
      className={`bg-panel border border-line border-l-4 ${colorClass} rounded-md min-w-[220px] max-w-[280px] ${statusClass} ${
        selected ? 'shadow-[0_0_0_2px_#84cc16]' : ''
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-line">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-display">
          {spec.category}
        </div>
        <div className="text-sm font-semibold text-paper truncate">{spec.label}</div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2 text-xs text-neutral-300">
        {/* Inputs */}
        {spec.inputs.map((p, i) => (
          <div key={`in_${p.name}`} className="relative flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id={p.name}
              style={{ top: 56 + i * 24, left: -6 }}
            />
            <span className="text-neutral-400">↳ {p.label || p.name}</span>
            <span className="ml-auto text-[10px] text-neutral-600 font-display">{p.type}</span>
          </div>
        ))}

        {/* Param preview (1-2 dòng) */}
        {spec.params.slice(0, 2).map((p) => {
          const v = params[p.name]
          const display = typeof v === 'string' && v.length > 40 ? v.slice(0, 40) + '…' : String(v ?? '')
          return (
            <div key={`p_${p.name}`} className="text-[11px] text-neutral-500">
              <span className="text-neutral-600">{p.label}: </span>
              <span className="text-neutral-300">{display}</span>
            </div>
          )
        })}

        {/* Preview ảnh */}
        {preview && (
          <div className="mt-2 rounded overflow-hidden border border-line bg-black/30">
            <img src={previewSrc} alt="preview" className="w-full block" />
            <a
              href={previewSrc}
              download={`${spec.label.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'image'}.png`}
              className="block border-t border-line px-2 py-1 text-center text-[11px] font-semibold text-accent hover:bg-accent hover:text-black"
            >
              Download
            </a>
          </div>
        )}

        {/* Error */}
        {status === 'failed' && error && (
          <div className="text-[11px] text-danger break-words">⚠ {error}</div>
        )}

        {/* Outputs */}
        {spec.outputs.map((p, i) => (
          <div key={`out_${p.name}`} className="relative flex items-center justify-end">
            <span className="text-[10px] text-neutral-600 font-display mr-2">{p.type}</span>
            <span className="text-neutral-400">{p.label || p.name} ↦</span>
            <Handle
              type="source"
              position={Position.Right}
              id={p.name}
              style={{ top: 56 + (spec.inputs.length + i) * 24, right: -6 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(GenericNodeImpl)
