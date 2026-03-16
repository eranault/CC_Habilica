export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null
  return (
    <div
      className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300"
      role="alert"
    >
      <span className="text-base flex-shrink-0" aria-hidden="true">⚠️</span>
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-red-600 dark:text-red-400 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
