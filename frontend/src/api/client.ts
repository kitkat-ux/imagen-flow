import axios from 'axios'
import type { NodeSpec, GalleryImage, RunHistoryItem, AssetItem, WorkflowItem, WorkflowVersionItem } from '../types'

const api = axios.create({
  baseURL: '',
  timeout: 60_000,
})

export async function fetchNodeRegistry(): Promise<NodeSpec[]> {
  const { data } = await api.get('/api/nodes/registry')
  return data.nodes
}

export async function createRun(graph_json: any, workflow_id?: string) {
  const { data } = await api.post('/api/runs', { graph_json, workflow_id })
  return data
}

export async function getRun(run_id: string) {
  const { data } = await api.get(`/api/runs/${run_id}`)
  return data
}

export async function listRuns(): Promise<RunHistoryItem[]> {
  const { data } = await api.get('/api/runs')
  return data
}

export async function retryRun(run_id: string): Promise<RunHistoryItem> {
  const { data } = await api.post(`/api/runs/${run_id}/retry`)
  return data
}

export async function listWorkflows(): Promise<WorkflowItem[]> {
  const { data } = await api.get('/api/workflows')
  return data
}

export async function createWorkflow(payload: { name: string; description?: string; graph_json: any }): Promise<WorkflowItem> {
  const { data } = await api.post('/api/workflows', payload)
  return data
}

export async function updateWorkflow(id: string, payload: any): Promise<WorkflowItem> {
  const { data } = await api.put(`/api/workflows/${id}`, payload)
  return data
}

export async function deleteWorkflow(id: string) {
  await api.delete(`/api/workflows/${id}`)
}

export async function duplicateWorkflow(id: string): Promise<WorkflowItem> {
  const { data } = await api.post(`/api/workflows/${id}/duplicate`)
  return data
}

export async function listWorkflowVersions(id: string): Promise<WorkflowVersionItem[]> {
  const { data } = await api.get(`/api/workflows/${id}/versions`)
  return data
}

export async function restoreWorkflowVersion(id: string, versionId: string): Promise<WorkflowItem> {
  const { data } = await api.post(`/api/workflows/${id}/versions/${versionId}/restore`)
  return data
}

export async function listImages(): Promise<GalleryImage[]> {
  const { data } = await api.get('/api/images')
  return data
}

export async function deleteImage(id: string) {
  await api.delete(`/api/images/${id}`)
}

export async function getOpenAIStatus() {
  const { data } = await api.get('/api/settings/openai')
  return data as { configured: boolean; masked: string | null }
}

export async function setOpenAIKey(api_key: string) {
  const { data } = await api.put('/api/settings/openai', { api_key })
  return data
}

export async function deleteOpenAIKey() {
  await api.delete('/api/settings/openai')
}

export async function getWeryAIStatus() {
  const { data } = await api.get('/api/settings/weryai')
  return data as { configured: boolean; masked: string[]; count: number }
}

export async function setWeryAIKey(api_key: string) {
  const { data } = await api.put('/api/settings/weryai', { api_key })
  return data
}

export async function deleteWeryAIKey() {
  await api.delete('/api/settings/weryai')
}

export async function deleteOneWeryAIKey(index: number) {
  const { data } = await api.delete('/api/settings/weryai/key', { data: { index } })
  return data as { configured: boolean; masked: string[]; count: number }
}

export async function uploadImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/uploads/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  })
  return data as { url: string; asset_id?: string }
}

export async function listAssets(): Promise<AssetItem[]> {
  const { data } = await api.get('/api/assets')
  return data
}

export function imageFileUrl(id: string) {
  return `/api/images/${id}/file`
}

export function imageThumbUrl(id: string) {
  return `/api/images/${id}/thumb`
}
