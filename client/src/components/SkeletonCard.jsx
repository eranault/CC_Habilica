export default function SkeletonCard({ lines = 2 }) {
  return (
    <div className="card p-4 space-y-3" aria-busy="true" aria-label="Loading...">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3 w-full" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}
