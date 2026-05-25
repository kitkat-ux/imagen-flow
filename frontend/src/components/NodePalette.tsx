import { useWorkflow } from '../stores/workflowStore'
import type { NodeSpec } from '../types'

const CATEGORY_LABEL: Record<string, string> = {
  input: 'Input',
  generator: 'Generator',
  processing: 'Processing',
  logic: 'Logic',
  output: 'Output',
}

const CATEGORY_ORDER = ['input', 'generator', 'processing', 'logic', 'output']

export default function NodePalette() {
  const { nodeRegistry } = useWorkflow()

  const byCategory: Record<string, NodeSpec[]> = {}
  for (const spec of nodeRegistry) {
    ;(byCategory[spec.category] ||= []).push(spec)
  }

  const onDragStart = (e: React.DragEvent, spec: NodeSpec) => {
    e.dataTransfer.setData('application/imagen-flow-node', JSON.stringify(spec))
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="w-64 shrink-0 bg-panel border-r border-line overflow-y-auto">
      <div className="px-4 py-3 border-b border-line">
        <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Nodes</div>
        <div className="text-sm text-paper">Kéo vào canvas</div>
      </div>
      <div className="p-3 space-y-4">
        {CATEGORY_ORDER.filter((c) => byCategory[c]).map((cat) => (
          <div key={cat}>
            <div className="font-display text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
              {CATEGORY_LABEL[cat] || cat}
            </div>
            <div className="space-y-1">
              {byCategory[cat].map((spec) => (
                <div
                  key={spec.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, spec)}
                  className="px-3 py-2 bg-ink hover:bg-neutral-800 border border-line rounded cursor-grab active:cursor-grabbing transition-colors"
                  title={spec.description}
                >
                  <div className="text-xs text-paper">{spec.label}</div>
                  {spec.description && (
                    <div className="text-[10px] text-neutral-500 truncate">{spec.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {nodeRegistry.length === 0 && (
          <div className="text-xs text-neutral-500">Đang tải danh sách node…</div>
        )}
      </div>
    </aside>
  )
}
