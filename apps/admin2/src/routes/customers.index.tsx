import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/customers/')({
  component: CustomersIndexComponent,
})

function CustomersIndexComponent() {
  return <div>Select a customer.</div>
}
