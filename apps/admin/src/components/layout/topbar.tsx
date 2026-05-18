import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { logoutFn } from "@/server/auth";

export function Topbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => logoutFn(),

    // Sukses: bawa flag logout=1 agar login-page menampilkan toast konfirmasi.
    onSuccess: () => {
      queryClient.clear();
      navigate({ to: "/login", search: { logout: "1" } });
    },

    // Error (misal: network): tetap redirect ke login tanpa toast.
    onError: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

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
  );
}
