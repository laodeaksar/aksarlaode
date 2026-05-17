import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders/')({
  component: OrdersIndexComponent,
})

function OrdersIndexComponent() {
  return <div>Select a orders.</div>
}
