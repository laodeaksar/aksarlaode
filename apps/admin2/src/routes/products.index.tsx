import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/products/')({
  component: ProductsIndexComponent,
})

function ProductsIndexComponent() {
  return <div>Select a products.</div>
}
