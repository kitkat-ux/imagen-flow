import { useEffect, useState } from 'react'
import {
  deleteOneWeryAIKey,
  deleteOpenAIKey,
  deleteWeryAIKey,
  getOpenAIStatus,
  getWeryAIStatus,
  setOpenAIKey,
  setWeryAIKey,
} from '../api/client'

type SingleStatus = { configured: boolean; masked: string | null }
type MultiStatus = { configured: boolean; masked: string[]; count: number }

export default function SettingsPanel() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl space-y-6">
        <div>
          <div className="font-display text-[10px] uppercase tracking-widest text-neutral-500">Settings</div>
          <div className="text-lg text-paper">API Providers</div>
        </div>

        <ProviderCard
          name="OpenAI"
          getStatus={getOpenAIStatus}
          setKey={setOpenAIKey}
          deleteKey={deleteOpenAIKey}
          helpText="Get it from platform.openai.com/api-keys. Used by the OpenAI Image node."
          placeholder="sk-..."
        />

        <ProviderCard
          name="WeryAI"
          getStatus={getWeryAIStatus}
          setKey={setWeryAIKey}
          deleteKey={deleteWeryAIKey}
          deleteOneKey={deleteOneWeryAIKey}
          multiKey
          helpText="Add as many WeryAI keys as needed. Each WeryAI run randomly selects one saved key."
          placeholder="sk-..."
        />

        <div className="text-[11px] text-neutral-500 leading-relaxed pt-2 border-t border-line">
          <p>
            <span className="text-neutral-300">Encryption:</span> API keys are encrypted with{' '}
            <span className="font-display text-accent">MASTER_KEY</span> before being stored in the local DB.
          </p>
        </div>
      </div>
    </div>
  )
}

interface ProviderCardProps {
  name: string
  getStatus: () => Promise<SingleStatus | MultiStatus>
  setKey: (key: string) => Promise<SingleStatus | MultiStatus>
  deleteKey: () => Promise<void>
  deleteOneKey?: (index: number) => Promise<MultiStatus>
  helpText: string
  placeholder?: string
  multiKey?: boolean
}

function ProviderCard({
  name,
  getStatus,
  setKey,
  deleteKey,
  deleteOneKey,
  helpText,
  placeholder,
  multiKey = false,
}: ProviderCardProps) {
  const [configured, setConfigured] = useState(false)
  const [masked, setMasked] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const applyStatus = (status: SingleStatus | MultiStatus) => {
    setConfigured(status.configured)
    if (Array.isArray(status.masked)) {
      setMasked(status.masked)
    } else {
      setMasked(status.masked ? [status.masked] : [])
    }
  }

  const load = async () => {
    try {
      applyStatus(await getStatus())
    } catch (e) {
      console.error(`Could not load ${name} status`, e)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!input.trim()) return
    setSaving(true)
    setMsg(null)
    try {
      applyStatus(await setKey(input.trim()))
      setInput('')
      setMsg({ kind: 'ok', text: multiKey ? 'API key added.' : 'API key saved.' })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.detail || e?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  const removeAll = async () => {
    if (!confirm(`Delete all saved ${name} API keys?`)) return
    await deleteKey()
    setConfigured(false)
    setMasked([])
    setMsg(null)
  }

  const removeOne = async (index: number) => {
    if (!deleteOneKey) return
    applyStatus(await deleteOneKey(index))
    setMsg(null)
  }

  return (
    <div className="bg-panel border border-line rounded p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-paper font-semibold">{name}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">{helpText}</div>
        </div>
        <div className={`text-[11px] font-display uppercase tracking-wider whitespace-nowrap ${configured ? 'text-accent' : 'text-neutral-500'}`}>
          {configured ? `● Configured${multiKey ? ` (${masked.length})` : ''}` : '○ Not set'}
        </div>
      </div>

      {!multiKey && masked.length > 0 && (
        <div className="text-[11px] text-neutral-500">
          Current key: <span className="text-neutral-300 font-display">{masked[0]}</span>
        </div>
      )}

      {multiKey && masked.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-neutral-500">Saved keys:</div>
          {masked.map((item, index) => (
            <div key={`${item}_${index}`} className="flex items-center gap-2 text-[11px]">
              <span className="text-neutral-300 font-display flex-1">{index + 1}. {item}</span>
              <button
                onClick={() => removeOne(index)}
                className="px-2 py-1 border border-danger/40 text-danger rounded hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-display uppercase tracking-wider text-neutral-500 mb-1">
          API Key
        </label>
        <input
          type="password"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder ?? 'sk-...'}
          className="w-full bg-ink border border-line rounded px-3 py-2 text-xs text-paper focus:outline-none focus:border-accent font-display"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !input.trim()}
          className="px-4 py-1.5 text-xs font-display uppercase tracking-wider bg-accent text-ink rounded hover:bg-lime-300 disabled:opacity-40"
        >
          {saving ? 'Saving...' : multiKey ? 'Add Key' : 'Save'}
        </button>
        {configured && (
          <button
            onClick={removeAll}
            className="px-4 py-1.5 text-xs font-display uppercase tracking-wider border border-danger/40 text-danger rounded hover:bg-danger/10"
          >
            {multiKey ? 'Delete All' : 'Delete Key'}
          </button>
        )}
      </div>

      {msg && (
        <div className={`text-xs ${msg.kind === 'ok' ? 'text-accent' : 'text-danger'}`}>{msg.text}</div>
      )}
    </div>
  )
}
