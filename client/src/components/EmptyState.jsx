export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="text-6xl mb-4" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mb-6">{description}</p>
      )}
      {action}
    </div>
  )
}
