interface TopProductsListProps {
  items: Array<{ id: string; name: string; salesCount: number }>;
}

export function TopProductsList({ items }: TopProductsListProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada data produk.</p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-foreground">
            {i + 1}. {item.name}
          </span>
          <span className="text-muted-foreground">
            {item.salesCount} terjual
          </span>
        </div>
      ))}
    </div>
  );
}
