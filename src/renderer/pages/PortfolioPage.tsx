// pages/PortfolioPage.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Github, ExternalLink, X, CheckCircle, ChevronRight } from 'lucide-react'
import { PartnerAppRelease, PartnerAppDownloadProgress } from '@shared/types'
import toast from 'react-hot-toast'

interface AppInfo extends Partial<PartnerAppRelease> {
    key: string
    name: string
    tagline: string
    description: string
    longDescription: string
    icon: JSX.Element
    accent: string
    accentRgb: string
    badge?: string
    features: { icon: string; text: string }[]
    category: 'utility' | 'developer' | 'gaming' | 'productivity'
    githubSlug?: string
}

const apps: AppInfo[] = [
    {
        key: 'myle',
        name: 'Make Your Life Easier',
        tagline: 'The ultimate digital assistant',
        description: 'Password manager, system tools, notes and quick actions — all in one app.',
        longDescription: 'A comprehensive suite of tools that makes your everyday life easier. From password manager to system utilities, all in one with beautiful UI and incredible speed.',
        accent: '#a78bfa',
        accentRgb: '167,139,250',
        badge: 'Popular',
        category: 'utility',
        githubSlug: 'myle',
        features: [
            { icon: '🔐', text: 'Password manager with AES-256 encryption' },
            { icon: '📁', text: 'System cleaner & optimizer' },
            { icon: '📝', text: 'Notes with markdown support' },
            { icon: '⚡', text: '50+ quick actions with custom hotkeys' },
            { icon: '🌙', text: 'Dynamic dark mode with auto-schedule' },
            { icon: '💾', text: 'Auto-backup with version history' },
        ],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.5" fill="currentColor" />
            </svg>
        ),
    },
    {
        key: 'gbr',
        name: 'GitHub Build & Release',
        tagline: 'Automate your release pipeline',
        description: 'GUI for build automation and GitHub release management. Save hours with a single click.',
        longDescription: 'Professional GUI for build automation and release management. Perfect for developers who want to automate their workflow and ship faster.',
        accent: '#60a5fa',
        accentRgb: '96,165,250',
        badge: 'New',
        category: 'developer',
        githubSlug: 'gbr',
        features: [
            { icon: '🚀', text: 'One-click release creation' },
            { icon: '📦', text: 'Multi-platform builds (Win/Mac/Linux)' },
            { icon: '📝', text: 'AI-powered release notes' },
            { icon: '🤖', text: 'GitHub Actions integration' },
            { icon: '📊', text: 'Analytics & download stats' },
            { icon: '🔔', text: 'Slack/Discord notifications' },
        ],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="currentColor" />
            </svg>
        ),
    },
    {
        key: 'backup',
        name: 'Backup Projects',
        tagline: 'Protect your code',
        description: 'Incremental backups, AES-256 encryption and cloud storage in one lightweight app.',
        longDescription: 'Protect your projects with automatic, smart backups. Incremental saves, military-grade encryption and multi-location storage for complete peace of mind.',
        accent: '#34d399',
        accentRgb: '52,211,153',
        category: 'utility',
        githubSlug: 'backup-projects',
        features: [
            { icon: '💾', text: 'Incremental — 90% less storage used' },
            { icon: '🔒', text: 'AES-256 encryption' },
            { icon: '☁️', text: 'Google Drive & Dropbox support' },
            { icon: '📅', text: 'Scheduled automatic backups' },
            { icon: '🔄', text: '90-day version history' },
            { icon: '⚡', text: 'One-click restore' },
        ],
        icon: (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        key: 'discordviewer',
        name: 'Discord Package Viewer',
        tagline: 'Analyze your Discord data',
        description: 'Visualize your Discord data package with interactive graphs and chat analytics.',
        longDescription: 'Visualize and analyze your Discord data package. See message stats, activity heatmaps, word clouds and much more in a beautiful, interactive interface.',
        accent: '#818cf8',
        accentRgb: '129,140,248',
        category: 'productivity',
        githubSlug: 'discord-package-viewer',
        features: [
            { icon: '📊', text: 'Message statistics & graphs' },
            { icon: '📈', text: 'Activity heatmaps' },
            { icon: '💬', text: 'Chat analysis with word clouds' },
            { icon: '🔍', text: 'Advanced search across all messages' },
            { icon: '🎯', text: 'Top emojis & reactions analytics' },
            { icon: '📁', text: 'Media export' },
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
            </svg>
        ),
    },
]

export default function PortfolioPage() {
    const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null)
    const [releases, setReleases] = useState<Record<string, PartnerAppRelease>>({})
    const [progress, setProgress] = useState<Record<string, PartnerAppDownloadProgress>>({})

    useEffect(() => {
        window.steam.getPartnerAppReleases().then(res => {
            if (res.success && res.data) {
                const map: Record<string, PartnerAppRelease> = {}
                for (const r of res.data) map[r.key] = r
                setReleases(map)
            }
        })

        const unsub = window.steam.onPartnerAppDownloadProgress((p) => {
            setProgress(prev => ({ ...prev, [p.key]: p }))
            if (p.done && !p.error) {
                const app = apps.find(a => a.key === p.key)
                toast.success(`${app?.name} installed!`)
            }
            if (p.done && p.error) toast.error(`Download failed: ${p.error}`)
        })

        return () => { unsub() }
    }, [])

    const handleDownload = async (app: AppInfo) => {
        const rel = releases[app.key]
        if (!rel) { toast.error('No release available'); return }
        setProgress(prev => ({ ...prev, [app.key]: { key: app.key, percent: 0, done: false } }))
        await window.steam.downloadPartnerApp(app.key, rel.downloadUrl, rel.fileName)
    }

    return (
        <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
            <div className="max-w-3xl mx-auto px-6 py-8">

                {/* ── Header ── */}
                <div className="mb-10">
                    <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full inline-block mb-3"
                        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                        by ThomasThanos
                    </span>
                    <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
                        App Collection
                    </h1>
                    <p className="text-sm leading-relaxed max-w-lg" style={{ color: 'var(--muted)' }}>
                        Tools built to make your daily life easier — download for free.
                    </p>
                </div>

                {/* ── App Cards ── */}
                <div className="space-y-3">
                    {apps.map((app, i) => {
                        const rel = releases[app.key]
                        const prog = progress[app.key]
                        const isDownloading = prog && !prog.done
                        const isDone = prog?.done && !prog.error

                        return (
                            <motion.div
                                key={app.key}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.3 }}
                                className="group relative rounded-2xl overflow-hidden cursor-pointer"
                                style={{ background: 'var(--card)', border: '1px solid var(--border)', transition: 'border-color 0.2s' }}
                                onClick={() => setSelectedApp(app)}
                                whileHover={{ borderColor: `rgba(${app.accentRgb}, 0.4)` }}
                            >
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                                    style={{ boxShadow: `inset 0 0 0 1px rgba(${app.accentRgb},0.2), 0 0 20px rgba(${app.accentRgb},0.05)` }}
                                />

                                <div className="flex items-center gap-4 p-4 pr-5">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: `rgba(${app.accentRgb}, 0.1)`, color: app.accent, border: `1px solid rgba(${app.accentRgb}, 0.15)` }}
                                    >
                                        {app.icon}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{app.name}</span>
                                            {app.badge && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                                                    style={{ background: `rgba(${app.accentRgb}, 0.12)`, color: app.accent }}>
                                                    {app.badge}
                                                </span>
                                            )}
                                            {rel && <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>v{rel.version}</span>}
                                        </div>
                                        <p className="text-xs leading-relaxed truncate" style={{ color: 'var(--muted)' }}>{app.description}</p>

                                        {isDownloading && (
                                            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                                <motion.div className="h-full rounded-full" style={{ background: app.accent }}
                                                    initial={{ width: 0 }} animate={{ width: `${prog.percent}%` }} transition={{ duration: 0.2 }} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownload(app) }}
                                            disabled={isDownloading || isDone}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 active:scale-95"
                                            style={{
                                                background: isDone ? 'rgba(52,211,153,0.1)' : `rgba(${app.accentRgb}, 0.1)`,
                                                color: isDone ? '#34d399' : app.accent,
                                                border: isDone ? '1px solid rgba(52,211,153,0.2)' : `1px solid rgba(${app.accentRgb}, 0.2)`,
                                            }}
                                        >
                                            {isDownloading ? <>{prog.percent}%</>
                                                : isDone ? <><CheckCircle className="w-3.5 h-3.5" /> Installed</>
                                                : <><Download className="w-3.5 h-3.5" /> Download</>}
                                        </button>
                                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--muted)' }} />
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* ── Footer ── */}
                <footer className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-3 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.2)' }}>
                                    <span style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>T</span>
                                </div>
                                <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>ThomasThanos</span>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                                Open-source tools for developers & gamers.
                            </p>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Quick Links</p>
                            <ul className="space-y-2">
                                {apps.map(app => (
                                    <li key={app.key}>
                                        <a href={`https://github.com/thomasthanos/${app.githubSlug ?? app.key}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-60"
                                            style={{ color: 'var(--sub)' }}>
                                            <span style={{ color: app.accent, fontSize: 8 }}>●</span>
                                            {app.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Contact</p>
                            <ul className="space-y-2">
                                <li>
                                    <a href="https://github.com/thomasthanos" target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs transition-opacity hover:opacity-60"
                                        style={{ color: 'var(--sub)' }}>
                                        <Github className="w-3.5 h-3.5" />
                                        All Projects
                                        <ExternalLink className="w-3 h-3" style={{ color: 'var(--muted)' }} />
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>


                </footer>
            </div>

            {/* ── Modal ── */}
            <AnimatePresence>
                {selectedApp && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setSelectedApp(null)}
                    >
                        <motion.div
                            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="w-full max-w-md rounded-2xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="h-1 w-full"
                                style={{ background: `linear-gradient(90deg, transparent, ${selectedApp.accent}, transparent)` }} />

                            <div className="p-5">
                                <div className="flex items-start justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                                            style={{ background: `rgba(${selectedApp.accentRgb}, 0.1)`, color: selectedApp.accent, border: `1px solid rgba(${selectedApp.accentRgb}, 0.2)` }}>
                                            {selectedApp.icon}
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>{selectedApp.name}</h2>
                                            <p className="text-xs" style={{ color: selectedApp.accent }}>{selectedApp.tagline}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedApp(null)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)]">
                                        <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                                    </button>
                                </div>

                                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--sub)' }}>
                                    {selectedApp.longDescription}
                                </p>

                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Features</p>
                                <div className="grid grid-cols-2 gap-1.5 mb-5">
                                    {selectedApp.features.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--sub)' }}>
                                            <span className="shrink-0">{f.icon}</span>
                                            <span className="leading-snug">{f.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => handleDownload(selectedApp)}
                                        disabled={progress[selectedApp.key]?.done}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
                                        style={{ background: `rgba(${selectedApp.accentRgb}, 0.12)`, color: selectedApp.accent, border: `1px solid rgba(${selectedApp.accentRgb}, 0.2)` }}>
                                        {progress[selectedApp.key]?.done
                                            ? <><CheckCircle className="w-4 h-4" /> Installed</>
                                            : <><Download className="w-4 h-4" /> Download</>}
                                    </button>
                                    <a href={`https://github.com/thomasthanos/${selectedApp.githubSlug ?? selectedApp.key}`}
                                        target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                                        <Github className="w-4 h-4" />
                                    </a>
                                </div>

                                {progress[selectedApp.key] && !progress[selectedApp.key].done && (
                                    <div className="mt-3">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Downloading...</span>
                                            <span className="text-xs font-semibold tabular-nums" style={{ color: selectedApp.accent }}>
                                                {progress[selectedApp.key].percent}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                            <motion.div className="h-full rounded-full" style={{ background: selectedApp.accent }}
                                                initial={{ width: 0 }} animate={{ width: `${progress[selectedApp.key].percent}%` }}
                                                transition={{ duration: 0.2 }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
