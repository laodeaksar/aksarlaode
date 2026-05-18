import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/audit-logs/')({
  component: AuditLogsIndexComponent,
})

function AuditLogsIndexComponent() {
  return <div>Dashboard page.</div>
}
