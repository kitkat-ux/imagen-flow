import { useEffect, useMemo, useState } from 'react'
import { type Edge, type Node } from '@xyflow/react'
import { listRuns, retryRun } from '../api/client'
import { useWorkflow } from '../stores/workflowStore'
import type { NodeData, RunHistoryItem } from '../types'

const STATUS_CLASS: Record<string, string> = {
  success: 'text-accent',
  failed: 'text-danger',
  running: 'text-warn',
  pending: 'text-neutral-300',
}

type Filter = 'active' | 'failed' | 'all'

export default function JobMonitor() {
  const [runs, setRuns] = useState<RunHistoryItem[]>([])
  const [filter, setFilter] = useState<Filter>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { loadWorkflow, setView, setCurrentWorkflow } = useWorkflow()

  const refresh = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      setRuns(await listRuns())
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh(true)
    const timer = window.setInterval(() => refresh(false), 4000)
    return () => window.clearInterval(timer)
  }, [])

  const filteredRuns = useMemo(() => {
    if (filter === 'active') return runs.filter((run) => run.status === 'pending' || run.status === 'running')
    if (filter === 'failed') return runs.filter((run) => run.status === 'failed')
    return runs
  }, [filter, runs])

  const stats = useMemo(() => ({
    pending: runs.filter((run) => run.status === 'pending').length,
    running: runs.filter((run) => run.status === 'running').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    success: runs.filter((run) => run.status === 'success').length,
  }), [runs])

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

  const onRetry = async (run: RunHistoryItem) => {
    setError(null)
    try {
      await retryRun(run.id)
      await refresh(false)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Retry failed')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Monitor</div>
          <div className="text-lg text-paper">Job monitor</div>
        </div>
        <button
          onClick={() => refresh(true)}
          className="text-xs px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {(['pending', 'running', 'failed', 'success'] as const).map((key) => (
          <div key={key} className="border border-line bg-panel rounded px-3 py-2">
            <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">{key}</div>
            <div className={`text-lg ${STATUS_CLASS[key]}`}>{stats[key]}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['active', 'failed', 'all'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`text-xs px-3 py-1 rounded border ${
              filter === item ? 'border-accent text-accent bg-ink' : 'border-line text-neutral-500 hover:text-paper'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading...</div>}
      {error && <div className="text-sm text-danger mb-3">{error}</div>}
      {!loading && filteredRuns.length === 0 && (
        <div className="text-sm text-neutral-500">No jobs for this filter.</div>
      )}

      <div className="space-y-2">
        {filteredRuns.map((run) => {
          const nodeCount = run.graph_snapshot.nodes?.length ?? 0
          const runningNodes = run.node_executions?.filter((node) => node.status === 'running').length ?? 0
          const failedNodes = run.node_executions?.filter((node) => node.status === 'failed').length ?? 0
          return (
            <div key={run.id} className="border border-line bg-panel px-4 py-3 rounded flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`font-display text-xs uppercase ${STATUS_CLASS[run.status] ?? 'text-neutral-400'}`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-neutral-500">{new Date(`${run.created_at}Z`).toLocaleString()}</span>
                  <span className="text-[11px] text-neutral-600">{nodeCount} nodes</span>
                  {(runningNodes > 0 || failedNodes > 0) && (
                    <span className="text-[11px] text-neutral-600">
                      running {runningNodes} / failed {failedNodes}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500 truncate">{run.id}</div>
                {run.error && <div className="mt-1 text-[11px] text-danger truncate">{run.error}</div>}
              </div>
              <button
                onClick={() => openRun(run)}
                disabled={nodeCount === 0}
                className="text-xs px-3 py-1.5 border border-line rounded hover:border-accent hover:text-accent disabled:opacity-40"
              >
                Open
              </button>
              <button
                onClick={() => onRetry(run)}
                disabled={nodeCount === 0 || run.status === 'running' || run.status === 'pending'}
                className="text-xs px-3 py-1.5 bg-accent text-ink rounded font-display uppercase tracking-wider hover:bg-lime-300 disabled:opacity-40"
              >
                Retry
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
