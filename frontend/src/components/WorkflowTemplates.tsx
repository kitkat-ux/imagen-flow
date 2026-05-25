import { BUILTIN_TEMPLATES } from '../templates/builtinTemplates'
import { useWorkflow } from '../stores/workflowStore'

export default function WorkflowTemplates() {
  const { loadWorkflow, setView, setCurrentWorkflow } = useWorkflow()

  const useTemplate = (templateId: string) => {
    const template = BUILTIN_TEMPLATES.find((item) => item.id === templateId)
    if (!template) return
    loadWorkflow({
      nodes: template.graph.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          params: { ...node.data.params },
          status: 'idle',
          preview: null,
          error: null,
        },
      })),
      edges: template.graph.edges.map((edge) => ({ ...edge })),
    })
    setCurrentWorkflow(null)
    setView('canvas')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-5">
        <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Templates</div>
        <div className="text-lg text-paper">Built-in workflows</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {BUILTIN_TEMPLATES.map((template) => (
          <div key={template.id} className="border border-line bg-panel rounded p-4 flex flex-col min-h-[150px]">
            <div className="text-sm font-semibold text-paper">{template.name}</div>
            <div className="mt-2 text-xs text-neutral-500 leading-relaxed flex-1">{template.description}</div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-neutral-600">
              <span>
                {template.graph.nodes.length} nodes / {template.graph.edges.length} edges
              </span>
              <button
                onClick={() => useTemplate(template.id)}
                className="px-3 py-1.5 bg-accent text-ink rounded font-display text-xs uppercase tracking-wider hover:bg-lime-300"
              >
                Use
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
