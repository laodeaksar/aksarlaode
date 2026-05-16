import { Link } from "@tanstack/react-router"
import { useSession } from "@/lib/session-context"
import { can }        from "@/lib/rbac"

export function Sidebar() {
  const { session } = useSession()
  const role        = session?.role ?? "CUSTOMER"

  const navItems = [
    { href: "/dashboard",   label: "Dashboard"  },
    { href: "/products",    label: "Products"   },
    { href: "/orders",      label: "Orders"     },
    { href: "/customers",   label: "Customers"  },
    // FIX ADM-06b: Audit Log link — only visible to ADMIN/OWNER (not FINANCE)
    ...(can(role, "audit:read") ? [{ href: "/audit-logs", label: "Audit Log" }] : []),
  ]

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-lg font-bold">Admin Panel</span>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {navItems.map(item => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center px-3 py-2 text-sm rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            activeProps={{ className: "flex items-center px-3 py-2 text-sm rounded-lg text-white bg-gray-800" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
