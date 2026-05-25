import { useState } from 'react'
import { createRun } from '../api/client'
import { subscribeRun } from '../ws/runWs'
import { serializeGraph, useWorkflow } from '../stores/workflowStore'

export default function Toolbar() {
  const {
    view, setView, isRunning, setRunning, setRunId, applyRunEvent, resetRunStatuses,
    nodes, currentWorkflowId, currentWorkflowName,
  } = useWorkflow()
  const [error, setError] = useState<string | null>(null)

  const onRun = async () => {
    setError(null)
    if (nodes.length === 0) {
      setError('Canvas đang trống. Kéo node vào và nối lại đã.')
      return
    }
    resetRunStatuses()
    const graph = serializeGraph()
    try {
      setRunning(true)
      const run = await createRun(graph, currentWorkflowId ?? undefined)
      setRunId(run.id)
      const unsub = subscribeRun(run.id, (evt) => {
        applyRunEvent(evt)
        if (evt.type === 'run_finished') {
          setRunning(false)
          if (evt.status === 'failed') setError(evt.error || 'Run thất bại.')
          setTimeout(unsub, 600)
        }
      })
    } catch (e: any) {
      setRunning(false)
      setError(e?.response?.data?.detail || e?.message || 'Lỗi không xác định')
    }
  }

  return (
    <header className="h-12 shrink-0 bg-panel border-b border-line flex items-center px-4 gap-2">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 bg-accent rounded-sm rotate-45" />
        <div className="font-display font-bold tracking-wider text-paper">IMAGEN/FLOW</div>
      </div>

      <nav className="ml-6 flex items-center gap-1">
        {(['canvas', 'workflows', 'templates', 'monitor', 'history', 'assets', 'gallery', 'settings'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1 text-xs uppercase font-display tracking-wider rounded ${
              view === v ? 'bg-ink text-accent border border-line' : 'text-neutral-500 hover:text-paper'
            }`}
          >
            {v}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {currentWorkflowName && (
          <span className="text-[11px] text-neutral-500 max-w-[180px] truncate">{currentWorkflowName}</span>
        )}
        {error && <span className="text-[11px] text-danger max-w-xs truncate">{error}</span>}
        <button
          onClick={onRun}
          disabled={isRunning || view !== 'canvas'}
          className="px-4 py-1.5 text-xs font-display uppercase tracking-wider bg-accent text-ink rounded hover:bg-lime-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Running…' : '▶ Run'}
        </button>
      </div>
    </header>
  )
}
