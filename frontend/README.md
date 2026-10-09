# Digital Safety Patrol — Frontend

Aplikasi web frontend untuk Digital Safety Patrol (Fuel Terminal), dibuat sesuai PRD Frontend v1.0.

**Stack:** Vue 3 · Vite · Vue Router · Pinia · Axios · lucide-vue-next (ikon)

Frontend tidak terhubung ke database. Seluruh data berasal dari REST API backend (`VITE_API_BASE_URL`).
Backend yang memenuhi kontrak di bawah ada di folder `../backend` (dokumentasi: `../backend/docs/API.md`). Panduan pemasangan: `../INSTALASI.txt`.

## Struktur

```
src/
├── api.js                 Axios instance + interceptor (token, pesan error 401/403/404/500)
├── services/index.js      authService, reportService, userService, depotService, productService,
│                          tankService, personnelService, statisticsService,
│                          correctiveActionService, notificationService, auditService
├── stores/                auth (login/logout/me), report (list, filter, pagination), ui (toast)
├── router/index.js        Route + guard login & role
├── lib/                   util.js (format, konstanta status), cruds.js (konfigurasi master data)
├── components/            AppLayout, Badge, DataState (loading/empty/error), Pagination,
│                          ConfirmModal, BarList, ConditionDonut
└── views/                 Login, Dashboard, ReportList, ReportForm, ReportDetail, Statistics,
                           CorrectiveList, CorrectiveDetail, Notifications, Profile, CrudView
```

`CrudView` dipakai bersama untuk Users, Depots, Products, Tanks, Personnel (CRUD) dan Audit Log (read-only),
dikonfigurasi lewat `src/lib/cruds.js`.

## Role dan menu

| Role | Halaman |
|---|---|
| PETUGAS | Dashboard, Laporan Saya, Buat Laporan, Notification, Profile |
| ADMIN | Dashboard, Laporan, Corrective Action, Statistics, Notification, Profile |
| SUPERADMIN | Semua di atas + Depot, Personnel, Product, Tank, Users, Audit Log |

Route dijaga oleh guard (belum login → `/login`; role tidak sesuai → `/dashboard`).
Otorisasi final tetap di backend.

## Alur laporan

Create Report (7 langkah: General Information → Loading → Discharge → Penyaluran → Storage → Documentation → Review)
→ Save Draft / Submit → Verification → Corrective Action → Resolved → Closed.

- Kondisi "Tidak Aman" memunculkan field *Deskripsi Temuan* (wajib).
- Depot Petugas terkunci sesuai profil; Tangki dan Personel difilter berdasarkan depot.
- Foto: validasi tipe (JPG/PNG/WEBP), ukuran (maks 5 MB), jumlah (maks 10), kategori per foto.
- Peringatan "Perubahan belum disimpan" saat meninggalkan form.

## Kontrak API (sudah diimplementasikan backend)

Semua respons: `{ "success": true, "data": ..., "pagination": { page, limit, total, totalPages } }`.
Autentikasi: `Authorization: Bearer <token>` (token dari `data.token` saat login) dan/atau cookie sesi.

**Auth**
- `POST /api/auth/login` body `{username, password}` (username boleh email) → `data: { token, user }`
- `GET /api/auth/me` → `data: user` (`id, name, username, email, role, depotId, depotName, status`)
- `POST /api/auth/logout`
- `PUT /api/auth/password` body `{currentPassword, newPassword}`

**Reports**
- `GET /api/reports` query: `page, limit, search, depotId, tanggal, status, priority, condition, picId, activity, sortBy, sortDir`
  → item: `id, reportNumber, tanggal, depotName, picName, kondisi (AMAN|TIDAK_AMAN), priority, status`
- `GET /api/reports/:id` → item di atas + `jamPatrol, depotId, picPatrolId, createdByName, photos[{id,url,category}],`
  `findings[{id,title,description,location,priority,recommendation,photoUrl,correctiveAction{id,action,picName,targetDate,status,afterPhotoUrl}}],`
  `statusHistory[{status,byName,note,createdAt}]` dan 4 objek aktivitas:
  - `loading`, `discharge`: `kondisi, personnelId, personnelName, jetty1, jetty2, productId, productName, catatan, finding`
  - `penyaluran`: `kondisi, personnelId, personnelName, jamMulai, jamSelesai, catatan, finding`
  - `storage`: `kondisi, personnelId, personnelName, tankIds[], tankNames[], statusTangki (LOADING|DISCHARGE|PENYALURAN|AKTIF_IDLE|OFF), catatan, finding`
- `POST /api/reports` (status `DRAFT`) · `PUT /api/reports/:id` · `DELETE /api/reports/:id`
- `PUT /api/reports/:id/status` body `{status, note}` — status: `DRAFT, SUBMITTED, VERIFIED, IN_PROGRESS, RESOLVED, CLOSED`
- `POST /api/reports/:id/photos` (multipart: `file`, `category`) · `DELETE /api/photos/:id`
- `GET /api/reports/:id/pdf` → file PDF (blob)

**Statistics** (`GET /api/statistics/{summary|activity|trend|tanks|personnel|products}`, query: `depotId, from, to, activity, status, priority, range`)
- `summary`: `totalPatrol, draft, submitted, needVerification, inProgress, resolved, safe, unsafe, openFinding, overdue, totalDepot, totalUser, depots[{name,totalPatrol,unsafe,resolved,overdue}]`
- `activity`: `[{activity, count}]` · `trend`: `[{label, count}]` · `tanks`: `[{tank, count}]` · `personnel`, `products`: `[{name, count}]`

**Lainnya**
- `/api/corrective-actions` (GET/POST/PUT/DELETE) item: `id, reportId, reportNumber, findingTitle, action, picName, targetDate, status (OPEN|IN_PROGRESS|RESOLVED|CLOSED), priority, notes, beforePhotoUrl, afterPhotoUrl, history[]`
- `/api/users`, `/api/depots`, `/api/products`, `/api/tanks`, `/api/personnel` — CRUD standar (item memuat field flat seperti `depotName`, `productName`)
- `GET /api/notifications` (`unread=true` untuk filter) → `id, message, link, read, createdAt` · `PUT /api/notifications/:id/read` · `PUT /api/notifications/read-all`
- `GET /api/audit-logs` query: `user, action, entity, date` → `createdAt, userName, action, entity, description`

## Cakupan build ini

Tersedia: P0 (login, role, dashboard, daftar/buat/detail/edit/hapus laporan, 4 aktivitas, foto, search, filter, pagination),
P1 (statistik, draft, workflow status, PDF, finding, corrective action), dan P2 (notifikasi, before/after, audit log, depot comparison).
Belum ada: unit test otomatis, upload foto *after* dari UI corrective action, dan lightbox foto (foto dibuka di tab baru).
Grafik dibuat dengan CSS murni (tanpa library chart).
