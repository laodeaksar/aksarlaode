import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  component: DasboardIndexComponent,
})

function DashboardIndexComponent() {
  return <div>Dashboard page.</div>
}
