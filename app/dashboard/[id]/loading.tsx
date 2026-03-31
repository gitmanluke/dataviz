export default function DashboardLoading() {
  return (
    <div className="p-6 grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}
