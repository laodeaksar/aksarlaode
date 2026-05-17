import { env } from "@repo/env/admin"

export function Topbar() {
  const handleLogout = async () => {
    await fetch(`${env.PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
    window.location.href = "/login"
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <button
        aria-label="Logout"
        onClick={handleLogout}
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        Logout
      </button>
    </header>
  )
}
