import { useEffect, useState } from 'react'
import { type Edge, type Node } from '@xyflow/react'
import { listRuns } from '../api/client'
import { useWorkflow } from '../stores/workflowStore'
import type { NodeData, RunHistoryItem } from '../types'

const STATUS_CLASS: Record<string, string> = {
  success: 'text-accent',
  failed: 'text-danger',
  running: 'text-warn',
  pending: 'text-neutral-300',
}

export default function RunHistory() {
  const [runs, setRuns] = useState<RunHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { loadWorkflow, setView, setCurrentWorkflow } = useWorkflow()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setRuns(await listRuns())
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load run history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const openRun = (run: RunHistoryItem) => {
    const executions = new Map((run.node_executions ?? []).map((item) => [item.node_id, item]))
    loadWorkflow({
      nodes: (run.graph_snapshot.nodes ?? []).map((node) => {
        const execution = executions.get(node.id)
        const image = execution?.outputs_json?.image
        return {
          ...node,
          data: {
            ...(node.data ?? {}),
            status: execution?.status ?? node.data?.status,
            error: execution?.error ?? node.data?.error,
            preview: typeof image === 'string' && image.startsWith('http') ? image : node.data?.preview,
          },
        }
      }) as Node<NodeData>[],
      edges: (run.graph_snapshot.edges ?? []) as Edge[],
    })
    setCurrentWorkflow(null)
    setView('canvas')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">History</div>
          <div className="text-lg text-paper">Run history</div>
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
      {!loading && !error && runs.length === 0 && (
        <div className="text-sm text-neutral-500">No runs yet.</div>
      )}

      <div className="space-y-2">
        {runs.map((run) => {
          const nodeCount = run.graph_snapshot.nodes?.length ?? 0
          const edgeCount = run.graph_snapshot.edges?.length ?? 0
          return (
            <div
              key={run.id}
              className="border border-line bg-panel px-4 py-3 rounded flex items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`font-display text-xs uppercase ${STATUS_CLASS[run.status] ?? 'text-neutral-400'}`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(`${run.created_at}Z`).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-neutral-500 truncate">
                  {run.id} - {nodeCount} nodes / {edgeCount} edges
                </div>
                {run.error && (
                  <div className="mt-1 text-[11px] text-danger truncate">{run.error}</div>
                )}
              </div>
              <button
                onClick={() => openRun(run)}
                disabled={nodeCount === 0}
                className="text-xs px-3 py-1.5 bg-accent text-ink rounded font-display uppercase tracking-wider hover:bg-lime-300 disabled:opacity-40"
              >
                Open
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
