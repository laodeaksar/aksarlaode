# Todo List — Admin Panel

> Dibuat dari ANALYSIS_REPORT.md · Skor saat ini: **8.2/10**
> Urutan: P1 → P2 → P3

---

## 🔴 P1 — Prioritas Tinggi ✅ SELESAI

### Security
- [x] **CSP Headers** — ditambahkan `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` di `__root.tsx` head() dan `vite.config.ts` server headers
- [x] **Input sanitization** — `product.description` dirender sebagai plain text (`{product.description}`), bukan `dangerouslySetInnerHTML` → tidak ada risiko XSS
- [x] **Confirm modal destruktif** — semua aksi destruktif (delete customer, deactivate user, delete product, restore user) sudah menggunakan `<AlertDialog>` dengan konfirmasi dua langkah

### Accessibility
- [x] **ARIA labels** — semua `<MoreHorizontal>` button icon-only sudah punya `<span className="sr-only">` di semua kolom tabel. `DataTable` ditambahkan prop `ariaLabel` + `aria-busy` + `scope="col"` pada header
- [x] **Keyboard navigation** — dihandle otomatis oleh Radix UI (DropdownMenu, AlertDialog, Dialog)
- [x] **Focus management** — dihandle otomatis oleh Radix UI; focus kembali ke trigger setelah dialog tutup

### Error Handling & Performance
- [x] **Error boundary dev mode** — `error-boundary.tsx` ditingkatkan: menampilkan `<details>` dengan stack trace + component stack di DEV, tersembunyi di production
- [x] **Server function error mapping** — `_utils.ts` sudah menggunakan `decodeOrThrow()` yang melempar `ValidationError` bertipe
- [x] **Strip TanStack Query Devtools di production** — sudah di-guard dengan `{import.meta.env.DEV && ...}` di `root-document.tsx`
- [x] **Virtual scrolling** — `DataTable` mendukung prop `virtualize` menggunakan `@tanstack/react-virtual`; diaktifkan di halaman orders dan audit-logs dengan `containerHeight="640px"`

### Bug fixes (ditemukan saat mengerjakan P1)
- [x] **Bug order-columns** — `Number(getValue)` diperbaiki menjadi `Number(getValue() as number)` sehingga kolom Amount menampilkan nilai yang benar

---

## 🔴 P1 — Konsistensi Kodebase (Analisis Mei 2026) ✅ SELESAI

> Hasil analisis lengkap ada di `CONTRIBUTING.md`.
> Skor sebelum fix: 6.5/10 rata-rata 6 dimensi.

### P0 Auto-Fixes (sudah diterapkan)
- [x] **[P0-1] `src/lib/query-keys.ts`** — buat registry terpusat semua query keys; export dari `@/lib`; eliminasi raw string literals yang rawan typo
- [x] **[P0-2] Bahasa konsisten — modul users** — 4 file (`deactivate-user-button`, `restore-user-button`, `edit-user-role-dialog`, `invite-user-dialog`) diubah dari English ke Bahasa Indonesia agar konsisten dengan modul customers/orders/products
- [x] **[P0-3] `queue-activity` invalidation** — setelah retry/resend, `["queue-activity"]` sekarang di-invalidate di `retry-job-button.tsx` (RetryJobButton + RetryAllButton) dan `resend-email-dialog.tsx` → activity log langsung refresh
- [x] **[P0-4] `FilterInput` + `FilterSelect` components** — ekstrak `SELECT_CLS` duplikat dari `audit-logs/-page.tsx` dan `queue/-page.tsx` ke komponen shared `src/components/shared/filter-input.tsx`; export dari `@/components/shared`
- [x] **[P0-5] Import path fixes** — `products/-page.tsx`: `from "@/components"` → `from "@/components/data-table"` · `retry-job-button.tsx`: `from "@/lib/toast"` → `from "@/lib"`

---

## 🟡 P2 — Konsistensi Lanjutan (backlog dari analisis)

### Query Keys — migrasi ke `queryKeys.*`
- [ ] **Migrasi `route.tsx` loaders** — ganti raw strings di semua `ensureQueryData` calls di route loaders dengan `queryKeys.*` constants (`products/$productId/route.tsx`, `orders/$orderId/route.tsx`, `customers/$userId/route.tsx`)
- [ ] **Migrasi komponen** — update semua `useQuery` dan `invalidateQueries` di komponen untuk pakai `queryKeys.*` (20+ call sites)
- [ ] **Migrasi `command-palette.tsx`** — `["products-search", query]` → `queryKeys.products.search(query)`

### Form consistency
- [ ] **`InviteUserDialog` → `@formisch/react`** — ganti manual `useState` + `includes("@")` validation dengan Valibot schema `InviteUserSchema` + `useForm`; tambahkan schema ke `src/schemas/forms.ts`
- [ ] **`ResendEmailDialog` → `@formisch/react`** — sama; schema `ResendEmailSchema` dengan proper email validation
- [ ] **Standarisasi pesan error schema** — `schemas/forms.ts`: "Name wajib diisi." (bukan "Name is required"), "Price harus lebih dari 0." (konsisten Bahasa Indonesia)

### Validation messages (schemas/forms.ts)
- [ ] Perbaiki pesan EN → ID di `ProductFormSchema`: `"Name wajib diisi."`, `"SKU wajib diisi."`, `"Price harus lebih dari 0."`, `"Compare price harus lebih dari 0."`, `"Stock tidak boleh negatif."`
- [ ] Perbaiki pesan EN → ID di `SettingsFormSchema`: semua error messages ke Bahasa Indonesia

### Tooling
- [ ] **ESLint config di `apps/admin`** — tambahkan `eslint.config.ts` dengan rule: no-restricted-imports untuk raw query key strings dan `@/lib/toast` direct import
- [ ] **Import order rule** — enforced via ESLint `import/order` plugin agar blank lines between import groups konsisten

---

## 🟡 P2 — UX & Features

### UX Improvements
- [ ] **Empty state per halaman** — ganti "No results found" generik dengan komponen `EmptyState` berisi ilustrasi SVG + pesan kontekstual per modul
- [ ] **Toast persistence** — invite user, bulk status change, retry email job harus ada toast yang tidak hilang sampai user dismiss
- [ ] **Loading skeleton spesifik** — skeleton halaman order detail harus mencerminkan layout aktual, bukan generic gray bars
- [ ] **Tooltips icon actions** — wrap semua icon button di DataTable dengan `<TooltipProvider>` dari `@repo/ui`

### Bulk Actions
- [ ] **Bulk status update orders** — checkbox di tabel orders + dropdown "Ubah status ke..." untuk selected rows
- [ ] **Bulk export orders** — export hanya rows yang dipilih ke CSV, bukan seluruh halaman
- [ ] **Bulk retry email jobs** — saat ini hanya bisa retry satu per satu di queue page

### Search & Export
- [ ] **Global search back-end** — command palette (`⌘K`) tambahkan search endpoint di api-gateway yang query products + orders + customers sekaligus
- [ ] **Search dalam tabel** — debounced search input per-kolom di DataTable (saat ini hanya filter by status/date)
- [ ] **Export orders ke CSV** — saat ini hanya export plain text; tambahkan proper CSV dengan header kolom
- [ ] **Export audit logs** — tambahkan tombol export di halaman audit logs

---

## 🟢 P3 — Prioritas Rendah

### Reporting & Analytics
- [ ] **Chart di dashboard** — line chart revenue 30 hari + bar chart orders per status menggunakan `recharts`
- [ ] **Laporan PDF** — halaman `/reports` dengan order summary yang bisa di-print/download via `window.print()`

### Onboarding & Usability
- [ ] **Help tooltips** — tambahkan `?` icon di samping field yang tidak intuitif (contoh: RBAC role di invite user dialog)
- [ ] **Keyboard shortcuts tambahan** — `N` untuk new product, `E` untuk export; tampilkan sebagai hint di command palette

### Advanced Features
- [ ] **Notifikasi real-time** — SSE endpoint di api-gateway untuk push event (order baru, stok rendah) → badge sidebar + toast popup
- [ ] **Import produk dari CSV** — form upload CSV dengan preview + validation sebelum import di halaman products
- [ ] **2FA untuk OWNER** — TOTP-based 2FA di halaman settings profil (wajib hanya untuk role OWNER)

### Code Quality
- [ ] **Unit tests komponen kritis** — `InviteUserDialog`, `DataTable`, server functions di `apps/admin/src/server/`
- [ ] **Refactor duplikasi filter pattern** — ekstrak ke hook `useTableFilters()` karena setiap halaman list reimplementasi sendiri

---

## Urutan Pengerjaan yang Disarankan

```
1. ✅ P1: Security  →  CSP + sanitasi + confirm modal
2. ✅ P1: Accessibility  →  ARIA + keyboard + focus
3. ✅ P1: Error boundary dev mode + strip Devtools
4. ✅ P1: Virtual scrolling  +  bug fix order-columns
5. ✅ P1: Konsistensi — P0 fixes (query-keys, language, invalidation, shared components)
6. P2: Migrasi queryKeys.* ke seluruh codebase (route loaders + komponen)
7. P2: Form consistency (InviteUserDialog + ResendEmailDialog → formisch)
8. P2: Validation messages Bahasa Indonesia
9. P2: Empty states + Tooltips  (UX cepat, high-impact)
10. P2: Bulk actions  →  orders + email queue
11. P2: Export CSV orders + audit logs
12. P3: Chart dashboard
13. P3: Notifikasi real-time
14. P3: Import CSV + 2FA
```
