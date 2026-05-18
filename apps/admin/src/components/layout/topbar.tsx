import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { authApi } from "@/lib/api"

export function Topbar() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      queryClient.clear()
      navigate({ to: "/login" })
    },
  })

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <button
        aria-label="Logout"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? "Keluar..." : "Logout"}
      </button>
    </header>
  )
}
