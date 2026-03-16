export default function PersonaCard({ persona, selected, onClick, multi = false }) {
  return (
    <button
      onClick={() => onClick(persona.id)}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-150 text-center min-w-[110px] ${
        selected
          ? 'border-accent-500 bg-accent-50 dark:bg-accent-950 shadow-md scale-[1.03]'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-accent-300 dark:hover:border-accent-700'
      }`}
    >
      {multi && (
        <span className={`absolute top-2 right-2 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${
          selected
            ? 'bg-accent-500 border-accent-500 text-white'
            : 'border-slate-300 dark:border-slate-600'
        }`}>
          {selected ? '✓' : ''}
        </span>
      )}
      <span className="text-3xl" role="img" aria-label={persona.name}>{persona.avatar}</span>
      <div>
        <p className={`text-xs font-semibold leading-tight ${selected ? 'text-accent-700 dark:text-accent-300' : 'text-slate-800 dark:text-slate-200'}`}>
          {persona.name}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
          {persona.domain}
        </p>
      </div>
    </button>
  )
}
