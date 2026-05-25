import { useCallback } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, SelectionMode,
  type NodeTypes, type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import GenericNode from './nodes/GenericNode'
import { useWorkflow } from '../stores/workflowStore'
import type { NodeSpec } from '../types'

const nodeTypes: NodeTypes = { generic: GenericNode as any }

export default function Canvas() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    addNodeFromSpec, setSelected,
  } = useWorkflow()

  const onDrop = useCallback((evt: React.DragEvent) => {
    evt.preventDefault()
    const raw = evt.dataTransfer.getData('application/imagen-flow-node')
    if (!raw) return
    const spec = JSON.parse(raw) as NodeSpec
    const bounds = (evt.target as HTMLElement).getBoundingClientRect()
    addNodeFromSpec(spec, { x: evt.clientX - bounds.left - 110, y: evt.clientY - bounds.top - 40 })
  }, [addNodeFromSpec])

  const onDragOver = useCallback((evt: React.DragEvent) => {
    evt.preventDefault()
    evt.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n: Node) => setSelected(n.id)}
        onPaneClick={() => setSelected(null)}
        deleteKeyCode={['Delete', 'Backspace']}
        selectionMode={SelectionMode.Partial}
        minZoom={0.1}
        fitView
        defaultEdgeOptions={{ animated: false }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#1f1f1f" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#171717" maskColor="rgba(10,10,10,0.7)" />
      </ReactFlow>
    </div>
  )
}
