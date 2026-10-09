# Dokumentasi API — Digital Safety Patrol

Base URL: `/api` · Format: JSON · Auth: `Authorization: Bearer <token>` (kecuali `/health` dan `/auth/login`).

Respons sukses: `{ "success": true, "message": "...", "data": ..., "pagination": {page,limit,total,totalPages} }`
Respons error: `{ "success": false, "message": "...", "errors": [{field,message}] }`
Status: 200, 201, 400, 401, 403, 404, 409 (duplikat), 422 (validasi/aturan bisnis), 429 (rate limit login), 500, 503 (database tidak tersedia).

Role: **P** = PETUGAS, **A** = ADMIN, **S** = SUPERADMIN. Data selalu dibatasi di backend:
P hanya laporan miliknya · A hanya depotnya (draft tidak terlihat) · S semua depot.

## Auth
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | /health | publik | Cek API + koneksi database |
| POST | /auth/login | publik | `{username, password}` (username boleh email). Rate limit 20 / 15 menit |
| GET | /auth/me | P A S | User saat ini (tanpa password) |
| POST | /auth/logout | P A S | Dicatat di audit; token dibuang client |
| PUT | /auth/password | P A S | `{currentPassword, newPassword}` (min 8) |

## Reports
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | /reports | P A S | Query: `page, limit, search, depotId, status, priority, condition (AMAN/TIDAK_AMAN), activityType, createdBy, picId, tanggal, startDate, endDate, sortBy, sortOrder` (alias frontend: `activity`, `from`, `to`, `sortDir`) |
| POST | /reports | P S | Buat draft (transaksi: laporan + aktivitas + finding + riwayat + audit). Nomor `SP-YYYYMMDD-0001` dibuat server |
| GET | /reports/:id | P A S | Detail + 4 aktivitas + foto + finding + corrective action + riwayat status |
| PUT | /reports/:id | P S | P: hanya DRAFT miliknya · S: selama belum CLOSED |
| DELETE | /reports/:id | P S | Soft delete (P: draft miliknya · S: belum CLOSED) |
| PUT | /reports/:id/status | P A S | `{status, note}`. Hanya satu langkah maju: DRAFT→SUBMITTED→VERIFIED→IN_PROGRESS→RESOLVED→CLOSED (VERIFIED→CLOSED bila tanpa finding). RESOLVED butuh semua corrective action selesai |
| GET | /reports/:id/pdf | P A S | File PDF |
| GET/POST | /reports/:id/activities | P A S / aturan edit | Aktivitas LOADING/DISCHARGE/PENYALURAN/STORAGE |
| PUT/DELETE | /activities/:id | aturan edit | |
| GET | /reports/:id/photos | P A S | |
| POST | /reports/:id/photos | aturan upload | multipart: `file` (JPG/PNG/WEBP, maks `MAX_FILE_SIZE_MB`), `category`, opsional `findingId`, `correctiveActionId` |
| DELETE | /photos/:id | aturan upload | |

Body laporan: `{tanggal, jamPatrol, depotId, picPatrolId, loading, discharge, penyaluran, storage}`; tiap aktivitas
`{kondisi: AMAN|TIDAK_AMAN, personnelId, productId, jetty1, jetty2, jamMulai, jamSelesai, tankIds[], statusTangki, catatan, finding}`.
Aturan: `TIDAK_AMAN` → `finding` wajib. Saat SUBMIT semua aktivitas, personel, produk/tangki/jam wajib lengkap.
Foto: PETUGAS pada draft miliknya; ADMIN/SUPERADMIN selama belum CLOSED.

## Finding & Corrective Action (A S)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | /findings | filter: `status, priority, depotId, reportId, assignedTo` |
| GET/PUT/DELETE | /findings/:id | hapus ditolak bila ada corrective action |
| GET/POST | /corrective-actions | filter: `status, picId, priority, targetDate, depotId`. POST `{reportId, findingId, action, picId, targetDate}`; laporan harus VERIFIED/IN_PROGRESS |
| GET/PUT/DELETE | /corrective-actions/:id | PUT `{action, picId, targetDate, notes, status}` |
| PUT | /corrective-actions/:id/status | OPEN→IN_PROGRESS→COMPLETED(RESOLVED)→CLOSED |

Status `COMPLETED` di database ditampilkan sebagai `RESOLVED`. Overdue dihitung otomatis (`targetDate < hari ini` & belum selesai) dan notifikasi dikirim sekali per item.

## Master data & User
| Endpoint | GET | POST/PUT/DELETE |
|---|---|---|
| /depots, /products, /tanks, /personnel | P A S (dibatasi depot, hanya ACTIVE untuk P/A) | S |
| /users | A (depotnya), S | S |

Query umum: `page, limit (maks 200), search, status, depotId`. Hapus = soft delete.

## Statistics
`GET /statistics/{summary|activity|trend}` (P A S, dibatasi scope) dan `/statistics/{tanks|personnel|products}` (A S).
Filter: `depotId, from|startDate, to|endDate, range (7d|30d|6m|custom), activityType, status, priority`. Dihitung dengan agregasi database.

## Notifications & Audit
`GET /notifications` (`unread=true`), `GET /notifications/unread`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`.
`GET /audit-logs` (S): filter `user, action, entity, date`.
