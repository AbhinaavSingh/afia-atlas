import { ExternalLink, Eye, EyeOff, LoaderCircle, LogOut, Pencil, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getAdminMemories,
  getPublicExperience,
  setMemoryVisibility,
  updateMemory,
  updateReveal,
} from '../../lib/api'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { Memory } from '../../types'

function Login({ onReady }: { onReady: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) {
      onReady()
      return
    }
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setBusy(false)
    if (authError) setError(authError.message)
    else onReady()
  }

  return (
    <main className="admin-login">
      <form onSubmit={signIn}>
        <p className="eyebrow">Private curation room</p>
        <h1>Welcome back.</h1>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : 'Enter the constellation'}
        </button>
        {!isSupabaseConfigured && <p className="demo-note">Demo mode: use any email and password.</p>}
      </form>
    </main>
  )
}

function MemoryEditor({
  memory,
  onClose,
  onSaved,
}: {
  memory: Memory
  onClose: () => void
  onSaved: (memory: Memory) => void
}) {
  const [draft, setDraft] = useState(memory)
  const [busy, setBusy] = useState(false)
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await updateMemory(memory.id, draft)
    onSaved(draft)
    setBusy(false)
    onClose()
  }
  return (
    <div className="admin-editor-wrap" role="dialog" aria-modal="true">
      <form className="admin-editor" onSubmit={save}>
        <button type="button" className="icon-button" onClick={onClose}><X /></button>
        <h2>Edit moment</h2>
        <div className="form-grid two">
          <label>Contributor<input value={draft.contributorName} onChange={(event) => setDraft({ ...draft, contributorName: event.target.value })} /></label>
          <label>Relationship<input value={draft.relationship ?? ''} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} /></label>
        </div>
        <label>Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Story<textarea rows={7} value={draft.story} onChange={(event) => setDraft({ ...draft, story: event.target.value })} /></label>
        <label>Date or era<input value={draft.happenedAt ?? ''} onChange={(event) => setDraft({ ...draft, happenedAt: event.target.value })} /></label>
        <label>Display location<input value={draft.locationName} onChange={(event) => setDraft({ ...draft, locationName: event.target.value })} /></label>
        <div className="form-grid two">
          <label>City<input value={draft.city ?? ''} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></label>
          <label>State / region<input value={draft.regionName ?? ''} onChange={(event) => setDraft({ ...draft, regionName: event.target.value })} /></label>
        </div>
        <label>Country code<input maxLength={2} value={draft.countryCode ?? ''} onChange={(event) => setDraft({ ...draft, countryCode: event.target.value.toUpperCase() })} /></label>
        <div className="form-grid two">
          <label>Latitude<input type="number" step="any" value={draft.latitude} onChange={(event) => setDraft({ ...draft, latitude: Number(event.target.value) })} /></label>
          <label>Longitude<input type="number" step="any" value={draft.longitude} onChange={(event) => setDraft({ ...draft, longitude: Number(event.target.value) })} /></label>
        </div>
        <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  )
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(!isSupabaseConfigured)
  const [memories, setMemories] = useState<Memory[]>([])
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const [items, experience] = await Promise.all([
        getAdminMemories(),
        getPublicExperience(),
      ])
      setMemories(items)
      setRevealed(experience.settings.revealed)
    } catch {
      setError('The atlas entries could not be loaded.')
    }
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setAuthenticated(Boolean(session)),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authenticated) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [authenticated])

  const setVisible = async (memory: Memory, visible: boolean) => {
    setBusyId(memory.id)
    setError('')
    try {
      await setMemoryVisibility(memory.id, visible)
      setMemories((current) =>
        current.map((item) =>
          item.id === memory.id
            ? { ...item, status: visible ? 'approved' : 'rejected' }
            : item,
        ),
      )
    } catch {
      setError('That action did not complete. Please try again.')
    } finally {
      setBusyId('')
    }
  }

  const toggleReveal = async () => {
    const next = !revealed
    setRevealed(next)
    try {
      await updateReveal(next)
    } catch {
      setRevealed(!next)
      setError('The reveal setting could not be changed.')
    }
  }

  if (!authenticated) return <Login onReady={() => setAuthenticated(true)} />

  const hidden = memories.filter((memory) => memory.status !== 'approved').length
  const visible = memories.length - hidden
  const contributorStats = [
    ...memories.reduce((contributors, memory) => {
      const key = memory.contributorName.trim().toLocaleLowerCase()
      const existing = contributors.get(key)
      contributors.set(key, {
        name: existing?.name ?? memory.contributorName.trim(),
        count: (existing?.count ?? 0) + 1,
        visible: (existing?.visible ?? 0) + (memory.status === 'approved' ? 1 : 0),
      })
      return contributors
    }, new Map<string, { name: string; count: number; visible: number }>())
      .values(),
  ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">Afia · XXX</p><h1>Atlas entries</h1></div>
        <div className="admin-header-actions">
          <a className="secondary-button" href="/?preview=1" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Preview</a>
          <button className="secondary-button" onClick={() => supabase?.auth.signOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <section className="admin-toolbar">
        <div><strong>{memories.length}</strong><span>total moments</span></div>
        <div><strong>{contributorStats.length}</strong><span>contributors</span></div>
        <div><strong>{visible}</strong><span>visible moments</span></div>
        <div><strong>{hidden}</strong><span>hidden · recoverable</span></div>
        <button className={`reveal-toggle ${revealed ? 'live' : ''}`} onClick={toggleReveal}>
          {revealed ? <Eye size={18} /> : <EyeOff size={18} />}
          <span><strong>{revealed ? 'Experience is live' : 'Experience is locked'}</strong><small>Click to {revealed ? 'lock' : 'reveal'}</small></span>
        </button>
      </section>

      <section className="admin-contributors">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Contribution overview</p>
            <h2>Who added to her atlas</h2>
          </div>
          <span>{contributorStats.length} {contributorStats.length === 1 ? 'person' : 'people'} · {memories.length} {memories.length === 1 ? 'moment' : 'moments'}</span>
        </div>
        <div className="contributor-list">
          {contributorStats.map((contributor, index) => (
            <article key={contributor.name}>
              <span className="contributor-rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="contributor-avatar">{contributor.name.charAt(0).toUpperCase()}</span>
              <strong>{contributor.name}</strong>
              <span>
                {contributor.count} {contributor.count === 1 ? 'moment' : 'moments'}
                {contributor.visible !== contributor.count
                  ? ` · ${contributor.count - contributor.visible} hidden`
                  : ''}
              </span>
            </article>
          ))}
          {!contributorStats.length && (
            <p className="contributors-empty">Contributor statistics will appear after the first submission.</p>
          )}
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}
      <section className="admin-list">
        {memories.map((memory) => (
          <article className="admin-memory" key={memory.id}>
            <div className="admin-thumb">
              {memory.thumbnailUrl ? <img src={memory.thumbnailUrl} alt="" /> : <span>{memory.contributorName.charAt(0)}</span>}
            </div>
            <div className="admin-memory-copy">
              <span className={`status-badge ${memory.status}`}>
                {memory.status === 'approved' ? 'visible' : 'hidden'}
              </span>
              <p className="location-line">{memory.locationName}</p>
              <h2>{memory.title}</h2>
              <p>{memory.story}</p>
              <small>From {memory.contributorName}{memory.relationship ? ` · ${memory.relationship}` : ''}</small>
            </div>
            <div className="admin-actions">
              <button onClick={() => setEditing(memory)}><Pencil size={15} /> Edit</button>
              {memory.status === 'approved' ? (
                <button className="reject" disabled={busyId === memory.id} onClick={() => setVisible(memory, false)}><EyeOff size={15} /> Hide</button>
              ) : (
                <button className="approve" disabled={busyId === memory.id} onClick={() => setVisible(memory, true)}><RotateCcw size={15} /> Restore</button>
              )}
            </div>
          </article>
        ))}
        {!memories.length && <div className="admin-empty">No moments have arrived yet.</div>}
      </section>

      {editing && (
        <MemoryEditor
          memory={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setMemories((current) => current.map((item) => item.id === updated.id ? updated : item))}
        />
      )}
    </main>
  )
}
