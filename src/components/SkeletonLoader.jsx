export function SkeletonCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: '#252B3D' }}>
      <div className="shimmer h-8 w-16 rounded-lg mb-3" />
      <div className="shimmer h-4 w-24 rounded" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 8 }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#252B3D' }}>
      <div className="shimmer h-12 w-full mb-0.5" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="shimmer h-14 w-full mb-0.5" style={{ opacity: 1 - i * 0.07 }} />
      ))}
    </div>
  )
}

export function SkeletonImageCarousel() {
  return (
    <div className="space-y-3">
      <div className="shimmer rounded-xl" style={{ aspectRatio: '1/1' }} />
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="shimmer rounded-lg" style={{ aspectRatio: '1/1' }} />
        ))}
      </div>
    </div>
  )
}
