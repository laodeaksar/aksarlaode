# Todo List — Admin Panel

> Dibuat dari ANALYSIS_REPORT.md · Skor saat ini: **8.2/10**
> Urutan: P1 → P2 → P3

---

## 🔴 P1 — Prioritas Tinggi

### Security
- [ ] **CSP Headers** — tambahkan `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` di response apps/admin
- [ ] **Input sanitization** — sanitasi field `description` produk sebelum di-render sebagai HTML (potensi XSS)
- [ ] **Confirm modal destruktif** — delete customer, deactivate user, cancel order harus ada konfirmasi dialog sebelum action dieksekusi

### Accessibility
- [ ] **ARIA labels** — tambahkan `aria-label` di semua `<button>` icon-only (edit, delete, view) di setiap DataTable
- [ ] **Keyboard navigation** — semua dropdown menu (role selector, status filter) harus bisa dioperasikan sepenuhnya via keyboard
- [ ] **Focus management** — setelah dialog tutup, fokus kembali ke trigger button

### Error Handling & Performance
- [ ] **Error boundary dev mode** — tampilkan stack trace + file location di development, bukan hanya pesan generik
- [ ] **Server function error mapping** — beberapa server function masih throw raw error; bungkus dengan typed `AppError`
- [ ] **Strip TanStack Query Devtools di production** — wrap dengan `import.meta.env.DEV` guard agar tidak ikut di-bundle
- [ ] **Virtual scrolling** — tabel orders dan audit logs pakai `@tanstack/react-virtual` untuk handle ratusan row per page

---

## 🟡 P2 — Prioritas Menengah

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
- [ ] **Hilangkan `SELECT_CLS` inline string** — pindahkan ke `cn()` utility atau komponen `Select` terpusat di `@repo/ui`
- [ ] **Unit tests komponen kritis** — `InviteUserDialog`, `DataTable`, server functions di `apps/admin/src/server/`
- [ ] **Refactor duplikasi filter pattern** — ekstrak ke hook `useTableFilters()` karena setiap halaman list reimplementasi sendiri

---

## Urutan Pengerjaan yang Disarankan

```
1. P1: Security  →  CSP + sanitasi + confirm modal
2. P1: Accessibility  →  ARIA + keyboard + focus
3. P1: Error boundary dev mode + strip Devtools
4. P2: Empty states + Tooltips  (UX cepat, high-impact)
5. P2: Bulk actions  →  orders + email queue
6. P2: Export CSV orders + audit logs
7. P1: Virtual scrolling  (jika data sudah besar)
8. P3: Chart dashboard
9. P3: Notifikasi real-time
10. P3: Import CSV + 2FA
```
