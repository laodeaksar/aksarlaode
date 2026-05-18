import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { logoutFn } from "@/server/auth"

export function Topbar() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => logoutFn(),
    onSettled: () => {
      queryClient.clear()
      navigate({ to: "/login" })
    },
  })

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-end px-6">
      <button
        aria-label="Logout"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? "Keluar..." : "Logout"}
      </button>
    </header>
  )
}
