import type { RunEvent } from '../types'

export function subscribeRun(runId: string, onEvent: (e: RunEvent) => void): () => void {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${proto}//${window.location.host}/ws/runs/${runId}`
  const ws = new WebSocket(url)

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data) as RunEvent
      onEvent(data)
    } catch (e) {
      console.error('Bad WS message', e)
    }
  }
  ws.onerror = (e) => console.error('WS error', e)

  return () => {
    try { ws.close() } catch {}
  }
}
