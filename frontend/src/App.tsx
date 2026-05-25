import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'

import Toolbar from './components/Toolbar'
import NodePalette from './components/NodePalette'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import Gallery from './components/Gallery'
import RunHistory from './components/RunHistory'
import WorkflowTemplates from './components/WorkflowTemplates'
import WorkflowManager from './components/WorkflowManager'
import JobMonitor from './components/JobMonitor'
import AssetManager from './components/AssetManager'
import SettingsPanel from './components/SettingsPanel'
import { fetchNodeRegistry } from './api/client'
import { useWorkflow } from './stores/workflowStore'

export default function App() {
  const { view, setNodeRegistry } = useWorkflow()

  useEffect(() => {
    fetchNodeRegistry().then(setNodeRegistry).catch((e) => {
      console.error('Không lấy được node registry', e)
    })
  }, [setNodeRegistry])

  return (
    <div className="h-screen w-screen flex flex-col bg-ink text-paper">
      <Toolbar />
      <main className="flex-1 flex overflow-hidden">
        {view === 'canvas' && (
          <ReactFlowProvider>
            <NodePalette />
            <Canvas />
            <Inspector />
          </ReactFlowProvider>
        )}
        {view === 'workflows' && <WorkflowManager />}
        {view === 'templates' && <WorkflowTemplates />}
        {view === 'monitor' && <JobMonitor />}
        {view === 'history' && <RunHistory />}
        {view === 'assets' && <AssetManager />}
        {view === 'gallery' && <Gallery />}
        {view === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
