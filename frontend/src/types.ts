export interface PortSpec {
  name: string
  type: string
  label?: string | null
  optional?: boolean
}

export interface ParamSpec {
  name: string
  type: 'string' | 'number' | 'select' | 'textarea' | 'boolean' | 'file'
  label: string
  default?: any
  options?: string[] | null
  placeholder?: string | null
  min?: number | null
  max?: number | null
}

export interface NodeSpec {
  type: string
  category: string
  label: string
  description?: string
  inputs: PortSpec[]
  outputs: PortSpec[]
  params: ParamSpec[]
}

export interface NodeData {
  [key: string]: unknown
  nodeType: string
  spec: NodeSpec
  params: Record<string, any>
  status?: 'idle' | 'running' | 'success' | 'failed'
  preview?: string | null
  error?: string | null
}

export interface RunEvent {
  type: 'run_started' | 'node_started' | 'node_finished' | 'run_finished' | 'ping'
  node_id?: string
  node_type?: string
  status?: 'success' | 'failed'
  outputs?: Record<string, any>
  preview_b64?: string
  error?: string
  run_id?: string
}

export interface GalleryImage {
  id: string
  run_id: string | null
  node_id: string
  file_path: string
  thumbnail_path: string | null
  prompt: string | null
  created_at: string
}

export interface RunHistoryItem {
  id: string
  workflow_id: string | null
  status: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  created_at: string
  graph_snapshot: {
    nodes?: any[]
    edges?: any[]
  }
  node_executions?: Array<{
    node_id: string
    node_type: string
    status: string
    error: string | null
    outputs_json?: Record<string, any> | null
  }>
}

export interface AssetItem {
  id: string
  source: string
  provider: string
  url: string
  filename: string | null
  content_type: string | null
  asset_metadata: Record<string, any> | null
  created_at: string
}

export interface WorkflowItem {
  id: string
  name: string
  description: string | null
  graph_json: {
    nodes?: any[]
    edges?: any[]
  }
  created_at: string
  updated_at: string
}

export interface WorkflowVersionItem {
  id: string
  workflow_id: string
  version: number
  name: string
  description: string | null
  graph_json: {
    nodes?: any[]
    edges?: any[]
  }
  created_at: string
}
