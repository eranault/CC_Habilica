import { useEffect, useState } from 'react'
import { partnersApi } from '../api/partners'

// ---------------------------------------------------------------------------
// Invite modal
// ---------------------------------------------------------------------------
function InviteModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [shareNames, setShareNames] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await partnersApi.invite(email.trim(), shareNames)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invite.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Invite a partner</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your partner must already have a Streakr account. They can see your weekly completion rate — nothing more, unless you opt in below.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="partner-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Partner's email
            </label>
            <input
              id="partner-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="input w-full"
              autoFocus
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shareNames}
              onChange={e => setShareNames(e.target.checked)}
              className="mt-0.5 accent-accent-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Share my habit names (only public habits are shared)
            </span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Partner card
// ---------------------------------------------------------------------------
const STATUS_BADGE = {
  pending:  'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  accepted: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  declined: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
}

function PartnerCard({ partner, onRemove }) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    if (!confirm(`Remove ${partner.partner_email} as a partner?`)) return
    setRemoving(true)
    try {
      await partnersApi.remove(partner.id)
      onRemove(partner.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar initials */}
        <div className="w-9 h-9 rounded-full bg-accent-100 dark:bg-accent-900 flex items-center justify-center text-accent-700 dark:text-accent-300 font-semibold text-sm shrink-0">
          {partner.partner_email[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {partner.partner_email}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Joined {new Date(partner.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
            {partner.share_habit_names ? ' · sharing habit names' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${STATUS_BADGE[partner.status] || STATUS_BADGE.pending}`}>
          {partner.status}
        </span>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm"
          aria-label={`Remove ${partner.partner_email}`}
          title="Remove partner"
        >
          {removing ? '…' : '×'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PartnersPage() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const load = async () => {
    try {
      const res = await partnersApi.list()
      setPartners(res.data.data || [])
    } catch {
      // keep empty list
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleInviteSuccess = () => {
    setShowInvite(false)
    load()
  }

  const handleRemove = (id) => {
    setPartners(prev => prev.filter(p => p.id !== id))
  }

  const canInvite = partners.filter(p => p.status !== 'declined').length < 3

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accountability Partners</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Up to 3 partners — entirely optional.
          </p>
        </div>
        {canInvite && (
          <button onClick={() => setShowInvite(true)} className="btn-primary text-sm">
            + Invite
          </button>
        )}
      </div>

      {loading ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {[1, 2].map(i => (
            <div key={i} className="px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="text-5xl block mb-4" aria-hidden="true">🤝</span>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">No partners yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Invite a friend to cheer you on. They'll see your weekly completion rate — nothing else unless you opt in.
          </p>
          <button onClick={() => setShowInvite(true)} className="btn-primary mx-auto">
            Invite a partner
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {partners.map(p => (
            <PartnerCard key={p.id} partner={p} onRemove={handleRemove} />
          ))}
          {!canInvite && (
            <div className="px-6 py-3 text-xs text-slate-400 dark:text-slate-500">
              Maximum 3 partners reached.
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}
