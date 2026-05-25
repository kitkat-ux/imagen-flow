import { create } from 'zustand'
import {
  applyNodeChanges, applyEdgeChanges, addEdge,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
} from '@xyflow/react'
import type { NodeSpec, NodeData, RunEvent } from '../types'

type View = 'canvas' | 'workflows' | 'templates' | 'monitor' | 'history' | 'assets' | 'gallery' | 'settings'

interface State {
  view: View
  setView: (v: View) => void

  nodeRegistry: NodeSpec[]
  setNodeRegistry: (n: NodeSpec[]) => void

  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  currentWorkflowId: string | null
  currentWorkflowName: string | null
  setCurrentWorkflow: (id: string | null, name?: string | null) => void

  onNodesChange: (c: NodeChange[]) => void
  onEdgesChange: (c: EdgeChange[]) => void
  onConnect: (c: Connection) => void
  addNodeFromSpec: (spec: NodeSpec, position: { x: number; y: number }) => void
  addLocalImageNode: (url: string, position?: { x: number; y: number }) => void
  updateNodeParams: (id: string, params: Record<string, any>) => void
  removeNode: (id: string) => void
  setSelected: (id: string | null) => void
  clearWorkflow: () => void
  loadWorkflow: (graph: { nodes: Node<NodeData>[]; edges: Edge[] }) => void

  runId: string | null
  isRunning: boolean
  setRunId: (id: string | null) => void
  setRunning: (b: boolean) => void
  applyRunEvent: (e: RunEvent) => void
  resetRunStatuses: (nodeIds?: string[]) => void
}

let _nodeCounter = 1

export const useWorkflow = create<State>((set, get) => ({
  view: 'canvas',
  setView: (v) => set({ view: v }),

  nodeRegistry: [],
  setNodeRegistry: (n) => set({ nodeRegistry: n }),

  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentWorkflowId: null,
  currentWorkflowName: null,
  setCurrentWorkflow: (id, name = null) => set({ currentWorkflowId: id, currentWorkflowName: name }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as Node<NodeData>[] })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (conn) =>
    set((s) => (
      isValidConnection(conn, s.nodes)
        ? { edges: addEdge({ ...conn, animated: false }, s.edges) }
        : s
    )),

  addNodeFromSpec: (spec, position) => {
    const id = `n_${Date.now()}_${_nodeCounter++}`
    const defaults: Record<string, any> = {}
    for (const p of spec.params) defaults[p.name] = p.default ?? (p.type === 'number' ? 0 : '')
    const node: Node<NodeData> = {
      id,
      type: 'generic',
      position,
      data: { nodeType: spec.type, spec, params: defaults, status: 'idle' },
    }
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: id }))
  },

  addLocalImageNode: (url, position = { x: 120, y: 140 }) =>
    set((s) => {
      const spec = s.nodeRegistry.find((item) => item.type === 'input.local_image')
      if (!spec) return s
      const id = `n_${Date.now()}_${_nodeCounter++}`
      const node: Node<NodeData> = {
        id,
        type: 'generic',
        position,
        data: { nodeType: spec.type, spec, params: { url }, status: 'idle' },
      }
      return { nodes: [...s.nodes, node], selectedNodeId: id, view: 'canvas' }
    }),

  updateNodeParams: (id, params) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n,
      ),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  setSelected: (id) => set({ selectedNodeId: id }),

  clearWorkflow: () => set({ nodes: [], edges: [], selectedNodeId: null, currentWorkflowId: null, currentWorkflowName: null }),

  loadWorkflow: (graph) =>
    set((s) => ({
      nodes: hydrateNodes(graph.nodes, s.nodeRegistry),
      edges: graph.edges,
      selectedNodeId: null,
    })),

  runId: null,
  isRunning: false,
  setRunId: (id) => set({ runId: id }),
  setRunning: (b) => set({ isRunning: b }),

  resetRunStatuses: (nodeIds) =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({
        ...n,
        data: nodeIds && !nodeIds.includes(n.id)
          ? n.data
          : { ...n.data, status: 'idle', error: null },
      })),
    })),

  applyRunEvent: (e) => {
    if (e.type === 'node_started' && e.node_id) {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === e.node_id ? { ...n, data: { ...n.data, status: 'running' } } : n,
        ),
      }))
    } else if (e.type === 'node_finished' && e.node_id) {
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === e.node_id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: e.status === 'failed' ? 'failed' : 'success',
                  preview: e.preview_b64 ?? n.data.preview,
                  error: e.status === 'failed' ? e.error ?? null : null,
                },
              }
            : n,
        ),
      }))
    } else if (e.type === 'run_finished') {
      set({ isRunning: false })
    }
  },
}))

export function serializeGraph(): any {
  const { nodes, edges } = useWorkflow.getState()
  return serializeGraphParts(nodes, edges)
}

export function getDependencyNodeIds(targetNodeId: string): string[] {
  const { nodes, edges } = useWorkflow.getState()
  const nodeIds = new Set(nodes.map((n) => n.id))
  if (!nodeIds.has(targetNodeId)) return []

  const deps = new Set<string>()
  const visit = (nodeId: string) => {
    if (deps.has(nodeId)) return
    deps.add(nodeId)
    for (const edge of edges) {
      if (edge.target === nodeId) visit(edge.source)
    }
  }

  visit(targetNodeId)
  return Array.from(deps)
}

export function serializeGraphForNode(targetNodeId: string): any {
  const { nodes, edges } = useWorkflow.getState()
  const dependencyIds = new Set(getDependencyNodeIds(targetNodeId))
  return serializeGraphParts(
    nodes.filter((n) => dependencyIds.has(n.id)),
    edges.filter((e) => dependencyIds.has(e.source) && dependencyIds.has(e.target)),
  )
}

function serializeGraphParts(nodes: Node<NodeData>[], edges: Edge[]): any {
  const validEdges = edges.filter((e) => isValidConnection(e, nodes))
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      position: n.position,
      data: { nodeType: n.data.nodeType, params: n.data.params },
    })),
    edges: validEdges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
    })),
  }
}

function isValidConnection(
  conn: Pick<Edge, 'source' | 'sourceHandle' | 'target' | 'targetHandle'> | Connection,
  nodes: Node<NodeData>[],
): boolean {
  if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return false
  const sourceNode = nodes.find((n) => n.id === conn.source)
  const targetNode = nodes.find((n) => n.id === conn.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = sourceNode.data.spec.outputs.find((p) => p.name === conn.sourceHandle)?.type
  const targetType = targetNode.data.spec.inputs.find((p) => p.name === conn.targetHandle)?.type
  if (!sourceType || !targetType) return false

  return sourceType === 'any' || targetType === 'any' || sourceType === targetType
}

function hydrateNodes(nodes: Node<NodeData>[], registry: NodeSpec[]): Node<NodeData>[] {
  return nodes.map((node) => {
    const nodeType = String(node.data?.nodeType || node.type || '')
    const spec = node.data?.spec || registry.find((item) => item.type === nodeType)
    if (!spec) return node
    return {
      ...node,
      type: 'generic',
      data: {
        ...node.data,
        nodeType,
        spec,
        params: node.data?.params ?? {},
        status: node.data?.status ?? 'idle',
      },
    }
  })
}
