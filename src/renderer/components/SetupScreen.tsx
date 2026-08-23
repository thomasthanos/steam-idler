import { useState } from 'react'
import { Key, Gamepad2, Trophy, BarChart3, Award, ExternalLink, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppContext } from '../hooks/useAppContext'
import toast from 'react-hot-toast'

export default function SetupScreen() {
  const { updateSettings } = useAppContext()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await updateSettings({ steamApiKey: apiKey.trim() })
      toast.success('API key saved!')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md mx-auto px-6 py-10"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(124,58,237,0.12) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Key className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Welcome to Souvlatzidiko</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
            To get started, add your Steam API Key. This unlocks all features of the app.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {[
            { icon: Gamepad2, text: 'Full game library', desc: 'All owned games' },
            { icon: Trophy, text: 'Achievements', desc: 'Unlock & track' },
            { icon: BarChart3, text: 'Playtime stats', desc: 'Hours & history' },
            { icon: Award, text: 'Completion', desc: 'Progress tracking' },
          ].map(({ icon: Icon, text, desc }) => (
            <div key={text} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)', opacity: 0.8 }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{text}</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="space-y-3">
          <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--sub)' }}>Steam API Key</label>
            <input
              type="password"
              className="input w-full font-mono text-sm"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <a
              href="https://steamcommunity.com/dev/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs mt-2.5 transition-opacity hover:opacity-80"
              style={{ color: 'var(--accent)' }}
            >
              Get your key from Steam
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Continue'}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
