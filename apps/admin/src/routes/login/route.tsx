import { createFileRoute, Outlet } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";

import { loginSearchSchema } from "@/lib/search-schemas";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Login — Admin" }],
  }),

  // logout=1 dikirim oleh NavUser setelah logout berhasil.
  // login-page.tsx membaca ini untuk menampilkan toast konfirmasi.
  validateSearch: valibotValidator(loginSearchSchema),

  component: () => <Outlet />,
});
