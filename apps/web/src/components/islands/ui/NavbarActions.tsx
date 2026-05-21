import { useEffect, useState } from "react";

// Lightweight client-side auth state — avoids an extra API call on every page.
// Login / Register forms write `ec_user` to localStorage after a successful
// server response.  Logout clears it.  The value is display-only; the real
// session is the HttpOnly cookie managed by the auth service.
type StoredUser = { name: string };

function safeParseUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("ec_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof (parsed as { name: unknown }).name === "string"
    ) {
      return parsed as StoredUser;
    }
  } catch {
    /* storage unavailable or malformed JSON */
  }
  return null;
}

export function NavbarActions() {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(safeParseUser());
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* best-effort */
    }
    localStorage.removeItem("ec_user");
    window.location.href = "/";
  };

  if (!user) {
    return (
      <a
        href="/account/login"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Login
      </a>
    );
  }

  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex items-center gap-3">
      <a
        href="/account/orders"
        className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:block"
      >
        Hi, {firstName}
      </a>
      <button
        onClick={handleLogout}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Logout
      </button>
    </div>
  );
}
