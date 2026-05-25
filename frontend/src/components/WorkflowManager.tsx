import { useEffect, useState } from 'react'
import { type Edge, type Node } from '@xyflow/react'
import {
  createRun,
  createWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  listWorkflowVersions,
  listWorkflows,
  restoreWorkflowVersion,
  updateWorkflow,
} from '../api/client'
import { serializeGraph, useWorkflow } from '../stores/workflowStore'
import type { NodeData, WorkflowItem, WorkflowVersionItem } from '../types'

export default function WorkflowManager() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [versions, setVersions] = useState<Record<string, WorkflowVersionItem[]>>({})
  const [name, setName] = useState('Untitled')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [batchPrompts, setBatchPrompts] = useState('')
  const [batchRunning, setBatchRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    nodes,
    edges,
    loadWorkflow,
    setView,
    currentWorkflowId,
    currentWorkflowName,
    setCurrentWorkflow,
  } = useWorkflow()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setWorkflows(await listWorkflows())
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (currentWorkflowName) setName(currentWorkflowName)
  }, [currentWorkflowName])

  const openWorkflow = (workflow: WorkflowItem) => {
    loadWorkflow({
      nodes: (workflow.graph_json.nodes ?? []) as Node<NodeData>[],
      edges: (workflow.graph_json.edges ?? []) as Edge[],
    })
    setCurrentWorkflow(workflow.id, workflow.name)
    setName(workflow.name)
    setDescription(workflow.description ?? '')
    setView('canvas')
  }

  const saveAsNew = async () => {
    setSaving(true)
    setError(null)
    try {
      const workflow = await createWorkflow({
        name: name.trim() || 'Untitled',
        description: description.trim() || undefined,
        graph_json: serializeGraph(),
      })
      setCurrentWorkflow(workflow.id, workflow.name)
      await refresh()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveCurrentVersion = async () => {
    if (!currentWorkflowId) {
      await saveAsNew()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const workflow = await updateWorkflow(currentWorkflowId, {
        name: name.trim() || 'Untitled',
        description: description.trim() || undefined,
        graph_json: serializeGraph(),
      })
      setCurrentWorkflow(workflow.id, workflow.name)
      await refresh()
      await loadVersions(workflow.id)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const loadVersions = async (workflowId: string) => {
    setError(null)
    try {
      setVersions((current) => ({ ...current, [workflowId]: current[workflowId] ?? [] }))
      const items = await listWorkflowVersions(workflowId)
      setVersions((current) => ({ ...current, [workflowId]: items }))
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load versions')
    }
  }

  const onDuplicate = async (workflow: WorkflowItem) => {
    setError(null)
    try {
      await duplicateWorkflow(workflow.id)
      await refresh()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Duplicate failed')
    }
  }

  const onDelete = async (workflow: WorkflowItem) => {
    setError(null)
    try {
      await deleteWorkflow(workflow.id)
      if (currentWorkflowId === workflow.id) setCurrentWorkflow(null)
      await refresh()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Delete failed')
    }
  }

  const onRestore = async (workflow: WorkflowItem, version: WorkflowVersionItem) => {
    setError(null)
    try {
      const restored = await restoreWorkflowVersion(workflow.id, version.id)
      openWorkflow(restored)
      await refresh()
      await loadVersions(workflow.id)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Restore failed')
    }
  }

  const runBatch = async () => {
    const graph = serializeGraph()
    const variationNode = (graph.nodes ?? []).find((node: any) => node.type === 'input.prompt_variations')
    const manualPrompts = batchPrompts.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const variationPrompts = variationNode
      ? String(variationNode.data?.params?.values ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : []
    const prompts = variationPrompts.length > 0 ? variationPrompts : manualPrompts
    const textNode = (graph.nodes ?? []).find((node: any) => node.type === 'input.text')

    if (prompts.length === 0) {
      setError('Add prompts to Prompt Variations or enter one prompt per line.')
      return
    }
    if (!variationNode && !textNode) {
      setError('Batch Run needs a Prompt Variations node or a Text Prompt node.')
      return
    }

    setBatchRunning(true)
    setError(null)
    try {
      for (let index = 0; index < prompts.length; index += 1) {
        const graphCopy = {
          ...graph,
          nodes: (graph.nodes ?? []).map((node: any) => {
            const params = { ...(node.data?.params ?? {}) }
            if (node.type === 'input.prompt_variations') params.index = index
            if (!variationNode && node.id === textNode.id) params.value = prompts[index]
            return { ...node, data: { ...(node.data ?? {}), params } }
          }),
        }
        await createRun(graphCopy, currentWorkflowId ?? undefined)
      }
      setView('monitor')
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Batch run failed')
    } finally {
      setBatchRunning(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Workflows</div>
          <div className="text-lg text-paper">Save / load / versions</div>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
        >
          Refresh
        </button>
      </div>

      <div className="border border-line bg-panel rounded p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_auto] gap-3 items-end">
          <label className="text-xs text-neutral-500">
            <span className="block mb-1 font-display uppercase tracking-widest">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-black border border-line rounded px-3 py-2 text-paper"
            />
          </label>
          <label className="text-xs text-neutral-500">
            <span className="block mb-1 font-display uppercase tracking-widest">Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full bg-black border border-line rounded px-3 py-2 text-paper"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={saveCurrentVersion}
              disabled={saving || nodes.length === 0}
              className="px-3 py-2 bg-accent text-ink rounded font-display text-xs uppercase tracking-wider disabled:opacity-40"
            >
              {currentWorkflowId ? 'Save Version' : 'Save'}
            </button>
            <button
              onClick={saveAsNew}
              disabled={saving || nodes.length === 0}
              className="px-3 py-2 border border-line rounded font-display text-xs uppercase tracking-wider hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Save As
            </button>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-neutral-600">
          Current canvas: {nodes.length} nodes / {edges.length} edges
        </div>
      </div>

      <div className="border border-line bg-panel rounded p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="text-xs text-neutral-500">
            <span className="block mb-1 font-display uppercase tracking-widest">Batch Prompts</span>
            <textarea
              value={batchPrompts}
              onChange={(event) => setBatchPrompts(event.target.value)}
              placeholder="One prompt per line. If the canvas has Prompt Variations, that node is used instead."
              className="w-full min-h-24 bg-black border border-line rounded px-3 py-2 text-paper resize-y"
            />
          </label>
          <button
            onClick={runBatch}
            disabled={batchRunning || nodes.length === 0}
            className="px-3 py-2 bg-accent text-ink rounded font-display text-xs uppercase tracking-wider disabled:opacity-40"
          >
            Batch Run
          </button>
        </div>
        <div className="mt-2 text-[11px] text-neutral-600">
          Creates one queued job per prompt. Jobs appear in Monitor.
        </div>
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading...</div>}
      {error && <div className="text-sm text-danger mb-3">{error}</div>}
      {!loading && workflows.length === 0 && (
        <div className="text-sm text-neutral-500">No saved workflows yet.</div>
      )}

      <div className="space-y-3">
        {workflows.map((workflow) => {
          const nodeCount = workflow.graph_json.nodes?.length ?? 0
          const edgeCount = workflow.graph_json.edges?.length ?? 0
          const versionItems = versions[workflow.id]
          return (
            <div key={workflow.id} className="border border-line bg-panel rounded p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-paper truncate">{workflow.name}</div>
                    {currentWorkflowId === workflow.id && (
                      <span className="text-[10px] text-accent font-display uppercase">open</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500 truncate">
                    {nodeCount} nodes / {edgeCount} edges - updated {new Date(`${workflow.updated_at}Z`).toLocaleString()}
                  </div>
                  {workflow.description && (
                    <div className="mt-1 text-xs text-neutral-500 truncate">{workflow.description}</div>
                  )}
                </div>
                <button onClick={() => openWorkflow(workflow)} className="text-xs px-3 py-1.5 bg-accent text-ink rounded font-display uppercase tracking-wider">
                  Open
                </button>
                <button onClick={() => loadVersions(workflow.id)} className="text-xs px-3 py-1.5 border border-line rounded hover:border-accent hover:text-accent">
                  Versions
                </button>
                <button onClick={() => onDuplicate(workflow)} className="text-xs px-3 py-1.5 border border-line rounded hover:border-accent hover:text-accent">
                  Duplicate
                </button>
                <button onClick={() => onDelete(workflow)} className="text-xs px-3 py-1.5 border border-danger text-danger rounded hover:bg-danger hover:text-white">
                  Delete
                </button>
              </div>

              {versionItems && (
                <div className="mt-3 border-t border-line pt-3 space-y-2">
                  {versionItems.length === 0 && <div className="text-xs text-neutral-500">No versions.</div>}
                  {versionItems.map((version) => (
                    <div key={version.id} className="flex items-center gap-3 text-xs">
                      <span className="font-display text-accent">v{version.version}</span>
                      <span className="text-neutral-500 flex-1">
                        {new Date(`${version.created_at}Z`).toLocaleString()} - {(version.graph_json.nodes ?? []).length} nodes
                      </span>
                      <button
                        onClick={() => onRestore(workflow, version)}
                        className="px-3 py-1 border border-line rounded hover:border-accent hover:text-accent"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
