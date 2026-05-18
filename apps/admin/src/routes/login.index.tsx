import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login/')({
  component: LoginIndexComponent,
})

function LoginIndexComponent() {
  return <div>Please login.</div>
}
