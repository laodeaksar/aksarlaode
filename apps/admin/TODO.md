# Admin App — Audit Todo List

Generated from deep audit (2026-05-17). Ordered by priority.

---

## P0 — Critical (fix sebelum deploy)

- [x] **P0-A** `SessionProvider` tidak di-mount di `__root.tsx` ✓
  - `useSession()` selalu mengembalikan `{ session: null }` → semua RBAC check `false`
  - Akibat: tombol Edit/Delete tidak pernah muncul untuk siapapun
  - Fix: hapus `SessionProvider` + `useEffect`, seed `SessionContext` dari `beforeLoad` via `Route.useRouteContext()` di `RootDocument`
  - File: `src/routes/__root.tsx`, `src/lib/session-context.tsx`

- [x] **P0-B** `columns: ColumnDef[]` didefinisikan di body komponen tanpa `useMemo` ✓
  - Dibuat ulang setiap render → TanStack Table re-initialize saat page/search berubah
  - Fix: `useMemo(() => [...], [canWrite])`
  - File: `src/routes/products/products-page.tsx`

- [x] **P0-C** Search input tanpa debounce ✓
  - Setiap keystroke langsung trigger `queryKey` baru → server function call → HTTP request
  - Fix: debounce 300ms dengan `useRef` + `useCallback`, pisahkan `search` (display) dan `debouncedSearch` (query key)
  - File: `src/routes/products/products-page.tsx`

- [x] **P0-D** `onSubmit: (data: any)` di `ProductForm` ✓
  - Caller melakukan `data as NewProductInput` — unsafe cast, tidak ada validasi di form
  - Fix: ganti dengan `(data: ProductFormValues) => void`, tambah 4 client-side guard, caller pakai `satisfies`
  - File: `src/components/forms/product-form.tsx`, `products/new.tsx`, `products/$productId.tsx`

---

## P1 — High (dalam sprint ini)

- [x] **P1-A** Route-level RBAC tidak di-enforce ✓
  - Hanya sidebar link yang disembunyikan; FINANCE role bisa buka `/audit-logs` via URL langsung
  - Fix: `beforeLoad` guard di 4 route: `/products/`, `/products/new`, `/products/$productId`, `/audit-logs/`
  - FINANCE → redirect `/dashboard`; non-write roles di product edit → redirect `/products`
  - File: semua 4 route file di atas

- [x] **P1-B** Session di-fetch dua kali per navigation ✓
  - `beforeLoad` memanggil `getSession()` (SSR), lalu `SessionProvider.useEffect` memanggil lagi (client)
  - Fix: resolved bersama P0-A — `SessionProvider` dihapus, context di-seed dari `beforeLoad`
  - File: `src/lib/session-context.tsx`, `src/routes/__root.tsx`

- [ ] **P1-C** Dashboard, Orders, Customers, Audit Logs tidak punya SSR loader
  - Semua data di-fetch client-side setelah hydration → blank → skeleton → data (client waterfall)
  - Fix: tambah `loader:` di masing-masing route yang memanggil server function atau `queryClient.prefetchQuery`
  - File: `src/routes/dashboard/index.tsx`, `src/routes/orders/index.tsx`, `src/routes/audit-logs/index.tsx`

- [ ] **P1-D** Product thumbnail tanpa `width`, `height`, dan `loading="lazy"`
  - Menyebabkan CLS (layout shift) saat gambar load di products table
  - Fix: tambah `width={40} height={40} loading="lazy"` pada `<img>` di kolom product
  - File: `src/routes/products/products-page.tsx:50–54`

- [ ] **P1-E** Header name tidak konsisten antara `Services.ts` dan `AuditMiddleware.ts`
  - `Services.ts` mengirim `x-internal-token`, `AuditMiddleware.ts` menggunakan `INTERNAL_SERVICE_TOKEN` untuk header yang belum diverifikasi namanya
  - Fix: verifikasi header yang di-expect product-service, seragamkan ke satu nama (`x-service-token`)
  - File: `src/effect/Services.ts:126`, `src/effect/AuditMiddleware.ts:84`, `src/effect/Audit.ts`

---

## P2 — Nice to have

- [ ] **P2-A** Hapus `zod` dari `package.json` — tidak dipakai (Effect Schema digunakan seluruhnya)
  - File: `package.json`

- [ ] **P2-B** Pin `nitro: "latest"` ke versi spesifik (e.g., `"2.x.x"`)
  - File: `package.json`

- [ ] **P2-C** `totalPages` dihitung dua kali di `DataTable` (baris 25 dan 28)
  - Fix: hapus salah satu, pakai variable yang sama
  - File: `src/components/data-table/data-table.tsx:25,28`

- [ ] **P2-D** Seragamkan bahasa UI — campur Indonesian dan English
  - "Hapus Produk", "Batal" vs "New Product", "Save Product"
  - Pilih satu bahasa dan apply konsisten ke seluruh komponen

- [ ] **P2-E** Duplikasi tipe `Product` antara `@repo/common` dan `src/effect/Services.ts`
  - `Services.ts` menduplikasi tipe dengan komentar "mirrors @repo/common" — risiko type drift
  - Fix: re-export langsung dari `@repo/common` atau pastikan ada automated check
  - File: `src/effect/Services.ts:13`

- [ ] **P2-F** Tidak ada test coverage sama sekali (unit, integration, e2e)
  - Tambah minimal: unit test untuk `rbac.ts` (permission matrix), `Errors.ts` (userMessage), dan `Audit.ts` (action map + sanitizeInput)

- [ ] **P2-G** `<input>` search tidak punya `aria-label` (hanya `placeholder`)
  - Fix: tambah `aria-label="Search products"`
  - File: `src/routes/products/products-page.tsx:135`

- [ ] **P2-H** Tombol Edit/Delete tidak punya `aria-label` untuk screen reader
  - Fix: tambah `aria-label="Edit product"` / `aria-label="Delete product"`
  - File: `src/routes/products/products-page.tsx:112,116`

---

## Catatan Implementasi

**Urutan aman tanpa break production:**
1. P0-D (isolated, tidak ada dependency)
2. P0-B + P0-C (isolated, hanya products-page)
3. P1-E (verify + fix header name — cek dulu di product-service)
4. P0-A + P1-B (harus barengan — refactor SessionContext sekaligus eliminasi double-fetch)
5. P1-A (butuh P0-A selesai dulu agar session tersedia di route context)
6. P1-C (SSR loaders — bisa paralel per route)
7. P1-D + P2-A–H (cleanup sprint)
