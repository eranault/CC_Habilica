import EmptyState from '../components/EmptyState'

export default function PartnersPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Accountability Partners</h1>
      <EmptyState
        icon="🤝"
        title="No partners yet"
        description="Invite up to 3 friends to cheer you on — completely optional."
        action={
          <button className="btn-primary">Invite a partner</button>
        }
      />
    </div>
  )
}
