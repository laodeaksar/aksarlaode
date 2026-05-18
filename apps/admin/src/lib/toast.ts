// ── lib/toast.ts — shared toast helpers ───────────────────────────────────
// Wrappers terpusat di atas sonner agar setiap call site menggunakan durasi
// dan severity yang sama.
//
// Usage:
//   import { toast } from "@/lib"
//
//   toast.success("Produk berhasil dibuat")
//   toast.error("Gagal menghapus produk", err)   // err opsional
//   toast.warning("Peringatan penting")

import { toast as sonnerToast } from "sonner"

function buildErrorMessage(base: string, err?: unknown): string {
  if (!err) return base
  const detail = err instanceof Error ? err.message : String(err)
  return `${base}: ${detail}`
}

export const toast = {
  /** Aksi berhasil — hijau, 3 detik */
  success: (message: string) =>
    sonnerToast.success(message, { duration: 3_000 }),

  /** Terjadi kesalahan — merah, 5 detik. Append detail error jika disertakan. */
  error: (message: string, err?: unknown) =>
    sonnerToast.error(buildErrorMessage(message, err), { duration: 5_000 }),

  /** Peringatan — kuning, 4 detik */
  warning: (message: string) =>
    sonnerToast.warning(message, { duration: 4_000 }),
}
