import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Login — Admin" }],
  }),

  // logout=1 dikirim oleh NavUser setelah logout berhasil.
  // login-page.tsx membaca ini untuk menampilkan toast konfirmasi.
  validateSearch: (search: Record<string, unknown>) => ({
    logout: search["logout"] === "1",
  }),
  component: () => <Outlet />,
});
