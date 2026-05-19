export function SkeletonCard({ G }) {
  const bg = G?.dk ? "#221F1C" : "#FFFFFF"
  const border = G?.border || "#EDE8DE"
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px" }}>
      <div className="shimmer" style={{ height: 28, width: 64, borderRadius: 6, marginBottom: 10 }} />
      <div className="shimmer" style={{ height: 12, width: 96, borderRadius: 4 }} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer" style={{ height: 14, borderRadius: 4, width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 8, G }) {
  const bg = G?.dk ? "#221F1C" : "#FFFFFF"
  const border = G?.border || "#EDE8DE"
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
      <div className="shimmer" style={{ height: 48, width: "100%", marginBottom: 2 }} />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 56, width: "100%", marginBottom: 2, opacity: 1 - i * 0.07 }} />
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
