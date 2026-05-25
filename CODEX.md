# Running State Update

Status: implemented in frontend.

2026-05-25 fix: backend no longer keeps a SQLite write transaction open while a node waits for image generation. `runner.py` commits after node start and after node finish/fail, preventing `POST /api/runs` from returning 500 `database is locked` during long WeryAI runs.

2026-05-25 fix: node-level I2I runs no longer clear existing previews at run start. Backend level execution is sequential with the shared `AsyncSession` to avoid `Session is already flushing` during multi-input dependency runs.

2026-05-25 fix: frontend now rejects incompatible port connections such as `string -> image`, and graph serialization filters invalid edges. WeryAI I2I also validates Reference Image input and returns a clear error when text is connected instead of an image/URL.

2026-05-25 fix: WeryAI T2I/I2I now pass the original WeryAI image URL through the `image` output and send base64 separately as `_preview_b64`. I2I can reuse T2I output by URL, avoiding `/upload-file` and the API-side `Permission denied` error on accounts without upload permission. Save/Preview nodes accept either URL or base64.

2026-05-25 update: added app-managed local image upload for I2I. Configure Cloudinary unsigned upload in `.env`, use the `Local Image` node, choose a local file in Inspector, and the app uploads it to storage then outputs a public image URL for WeryAI I2I.

2026-05-25 update: Run History foundation added. Backend lists saved runs with graph snapshots, and frontend has a History tab that can reopen a previous run graph on the canvas.

2026-05-25 fix: opening a History run now hydrates node specs from the current node registry before rendering, so snapshots saved without `data.spec` no longer appear as blank white nodes.

2026-05-25 fix: History now includes node execution outputs and restores URL previews when reopening a successful run. Node preview rendering accepts both base64 and public image URLs.

2026-05-25 update: added Built-in Workflow Templates tab with starter graphs for WeryAI T2I, Local Image I2I, T2I -> I2I, Local I2I -> Save, and T2I -> Save.

2026-05-25 update: added Asset Manager foundation. Cloudinary uploads from Local Image are stored as `assets`, `/api/assets` lists them, and the frontend Assets tab can reuse an uploaded image by creating a Local Image node from its URL.

2026-05-26 update: added Prompt/Style System foundation with `Style Preset` and `Prompt Composer` nodes, plus a Styled Prompt to Image built-in template.

2026-05-26 update: added Queue + Job Monitor foundation. Runs now enter a backend queue before execution, the Monitor tab has active/failed/all filters, auto-refresh, status counters, Open, and Retry, and `POST /api/runs/{run_id}/retry` reruns from the saved graph snapshot.

2026-05-26 update: WeryAI I2I now supports multi-reference images. The I2I node keeps `image` for old workflows and adds optional `image_2`, `image_3`, `image_4`; executor also preserves multiple connections to the same input port as a list before sending WeryAI `images`.

2026-05-26 update: added Workflow Versioning + Save/Load. Backend stores `workflow_versions` on create/update/restore and supports duplicate/restore APIs; frontend adds a Workflows tab to save current canvas, save as new, open, duplicate, delete, inspect versions, and restore a version.

2026-05-26 update: added Batch Generation foundation. New `Prompt Variations` input node outputs one prompt by active index, and the Workflows tab can Batch Run the current canvas by queueing one run per prompt, using either Prompt Variations lines or manual batch prompt lines.

2026-05-26 update: WeryAI settings now support multiple API keys. Settings can add/delete individual WeryAI keys, legacy `weryai.api_key` is still read, and each WeryAI execution randomly selects one saved key from `weryai.api_keys`.

## Problem

Current run behavior is workflow-level:

- `frontend/src/components/Toolbar.tsx` uses one global `isRunning`.
- `frontend/src/stores/workflowStore.ts` has per-node `data.status`, but the Run button still serializes and runs the whole canvas.
- This makes the UI feel like one `Running` state controls the whole project, even when the user only wants to run one node.

## Required Behavior

Running state must be split into two levels:

1. Workflow running
   - Used only when the user runs the whole canvas.
   - Disables the global Run button.
   - Does not imply every node is running.

2. Node running
   - Each node owns its own status: `idle | running | success | failed`.
   - When a node starts, only that node shows `running`.
   - When a node finishes, only that node changes to `success` or `failed`.
   - Other unrelated nodes must keep their previous state unless they are part of the same execution.

## Node-Level Run

Add a node-level Run action for selected nodes.

Expected behavior:

- If the user runs a selected node, execute only the dependency subgraph needed for that node.
- Dependency subgraph means:
  - the selected target node
  - all upstream nodes that feed into it
  - all edges between those nodes
- Do not run downstream nodes unless the user runs the whole workflow.

Example:

```text
Text Prompt -> WeryAI T2I -> WeryAI I2I -> Save Image
```

If the user runs only `WeryAI I2I`, execute:

```text
Text Prompt -> WeryAI T2I -> WeryAI I2I
```

Do not execute:

```text
Save Image
```

## Frontend Implementation Notes

Update `frontend/src/stores/workflowStore.ts`:

- Keep `isRunning` for full workflow runs only.
- Add node-level tracking if needed:
  - `runningNodeIds: Set<string>` or equivalent serializable structure.
  - Or rely on existing `node.data.status`, but do not reset unrelated nodes.
- Add helper to build a dependency subgraph for one node:
  - input: `targetNodeId`
  - output: `{ nodes, edges }`
  - traverse upstream through `edges.target === currentNodeId`

Update `frontend/src/components/Inspector.tsx`:

- Add a Run button for the selected node.
- Button label should show `Running...` only for that selected node when it is running.
- Do not disable unrelated nodes globally.

Update `frontend/src/components/Toolbar.tsx`:

- The global Run button still runs the whole canvas.
- Before a full run, resetting all node statuses is acceptable.
- Before a node-level run, reset only nodes inside that dependency subgraph.

## Backend Behavior

Backend `/api/runs` can keep accepting `graph_json`.

For node-level runs, frontend should send a reduced `graph_json` containing only the dependency subgraph. This avoids adding a separate backend endpoint.

Backend `node_started` and `node_finished` events already contain `node_id`; frontend must apply these events only to matching nodes.

## Acceptance Criteria

- Running the full canvas still works.
- Running a selected node executes only that node and its upstream dependencies.
- Unrelated nodes do not flash `running`.
- Downstream nodes are not executed during node-level run.
- Generated image previews still appear on generator nodes.
- Save Image only runs when it is part of the submitted graph.
