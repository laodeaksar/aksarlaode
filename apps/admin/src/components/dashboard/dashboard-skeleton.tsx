export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-muted h-8 w-48 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
