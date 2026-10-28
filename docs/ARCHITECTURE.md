# Arsitektur Microservices — Penjelasan untuk Pemula

## 1. Apa bedanya dengan monolith?
Monolith: satu program backend berisi semua fitur, satu database. Mengubah satu fitur = build dan deploy ulang semuanya,
dan untuk scaling harus menggandakan semuanya.

Microservices: tiap bidang bisnis menjadi program sendiri, di container sendiri, dengan database sendiri.
Bisa di-build, dijalankan, dihentikan, di-restart, dan di-scale sendiri-sendiri.

## 2. Pembagian service (dipecah berdasarkan domain bisnis, bukan berdasarkan role)
| Service | Tanggung jawab | Database | Port internal |
|---|---|---|---|
| api-gateway | Pintu masuk tunggal: cek token, routing, load balancing, request-id | - | 8080 |
| auth-service | Login, token JWT, ganti password, user & role | `auth_db` | 3001 |
| master-data-service | Depot, produk, tangki, personel | `master_data_db` | 3006 |
| report-service | Laporan + 4 aktivitas, finding, corrective action, foto, statistik, PDF | `report_db` | 3003 |
| notification-service | Notifikasi | `notification_db` | 3008 |
| audit-service | Audit log | `audit_db` | 3010 |

Role PETUGAS/ADMIN/SUPERADMIN **bukan** service; role hanya menentukan izin di dalam tiap service.
Finding, corrective action, file, dan statistics sengaja masih berada di report-service pada tahap ini
(PRD menyarankan mulai kecil). Memecahnya adalah latihan lanjutan (bagian 9).

## 3. Alur sebuah request
```
Browser → Nginx (frontend) → api-gateway → (cek JWT, beri X-Request-Id) → service tujuan → database miliknya
```
Frontend tidak tahu service apa saja yang ada; ia hanya memanggil `/api/...` ke gateway. Path publik sama persis dengan
versi monolith, sehingga kode Vue tidak berubah.

## 4. Database per service
Satu server MySQL berisi 5 database. Setiap service punya **user MySQL sendiri** yang hanya berhak atas database-nya
(`docker/mysql/init/01-create-databases.sh`). Jadi report-service *tidak bisa* membaca `auth_db` walaupun mau.

Konsekuensi: tidak ada foreign key antar database. Data milik service lain disimpan sebagai **ID + salinan nama (snapshot)**.
Contoh: laporan menyimpan `depotId` dan `depotName`. Keuntungannya laporan bisa ditampilkan tanpa memanggil service lain;
kekurangannya jika nama depot diganti, laporan lama tetap memakai nama lama (wajar untuk data historis).

## 5. Komunikasi antar service
REST sinkron lewat jaringan internal Docker, memakai **nama service** sebagai alamat (mis. `http://master-data-service:3006`),
bukan `localhost`. Endpoint `/internal/*` hanya untuk antar-service: dilindungi header `X-Internal-Key` dan tidak pernah diteruskan gateway.

| Dari → ke | Untuk apa |
|---|---|
| report → master-data | validasi depot/personel/produk/tangki + ambil namanya saat laporan dibuat/diubah |
| auth → master-data | validasi depot dan ambil nama saat user dibuat/diubah |
| notification → auth | mencari ADMIN pada suatu depot |
| report/auth/master → audit, notification | mengirim catatan audit & notifikasi (fire-and-forget) |
| report → master/auth | jumlah depot & user untuk dashboard superadmin (bila gagal tampil 0) |

Aturan kegagalan:
- **Wajib hidup:** master-data saat membuat/mengubah laporan → bila mati, pengguna dapat pesan 503 yang jelas.
- **Boleh mati:** audit & notification. Dikirim *setelah* data tersimpan dan tanpa ditunggu; bila mati, laporan tetap berhasil dibuat
  (hanya catatan audit/notifikasinya yang tidak terkirim; kejadiannya tercatat di log).
- Semua panggilan punya timeout 3 detik, GET dicoba ulang 1x, tidak ada retry tanpa batas.

## 6. Autentikasi & otorisasi
1. Login ke auth-service → menerima JWT berisi `id, name, role, depotId, depotName`.
2. Gateway memeriksa JWT sebelum meneruskan request.
3. **Setiap service memeriksa JWT lagi** dan menerapkan aturan role/depot sendiri (mis. ADMIN hanya melihat laporan depotnya),
   sehingga tetap aman bila ada yang memanggil service langsung dari dalam jaringan.

Batasan yang perlu dipahami: karena service tidak bertanya ke auth-service di setiap request, user yang dinonaktifkan
atau diubah rolenya baru berlaku setelah tokennya habis (`JWT_EXPIRES_IN`, default 8 jam). Perbaikan umum: token pendek + refresh token.

## 7. Scaling & load balancing
`report-service` tidak memakai `container_name` dan tidak membuka port host, sehingga bisa digandakan:
`docker compose up -d --scale report-service=3`.
Docker DNS mengembalikan ketiga IP untuk nama `report-service`; gateway membaca daftar IP itu tiap 3 detik dan membagi
request bergiliran (round-robin, `gateway/src/balancer.js`). Setiap respons memuat header `X-Served-By: report-service@<id-container>`
agar terlihat container mana yang melayani. Foto disimpan di volume bersama `uploads_data` sehingga semua instance dapat melayaninya
(cukup untuk satu mesin Docker; untuk banyak mesin dipakai object storage).

## 8. Observability
- Log JSON satu baris per request: `docker compose logs -f <service>`.
- `X-Request-Id` dibuat gateway dan diteruskan ke semua service dan panggilan antar-service → satu request bisa ditelusuri dengan
  `docker compose logs | grep <request-id>`.
- `GET /health` di setiap service; `GET /api/health` di gateway merangkum status semuanya (tetap 200 walau ada yang mati; lihat `data.services`).

## 9. Langkah belajar berikutnya (urutan disarankan)
1. Pisahkan **finding-service** dari report-service (report ↔ finding saling membutuhkan: gunakan endpoint `/internal`).
2. Pisahkan **corrective-action-service**, lalu **file-service** (foto), lalu **statistics-service**.
3. Tambahkan message broker (RabbitMQ/Redis) untuk event seperti REPORT_SUBMITTED agar audit/notifikasi tidak hilang saat service mati.
4. Tambahkan refresh token dan pemisahan user-service dari auth-service.
Setiap langkah: buat service + database + Dockerfile, daftarkan di `docker-compose.yml` dan route di `gateway/src/app.js`, jalankan `node --test tests/integration.test.mjs`.

## 10. Struktur satu service
```
services/report-service/
├── Dockerfile            build image (node:20-slim, non-root, healthcheck)
├── prisma/schema.prisma  skema database MILIK service ini
├── scripts/entrypoint.sh migrate → seed (opsional) → start
└── src/  app.js · server.js · routes/ · controllers/ · services/ · validators/ · utils/ · common/ (salinan _common)
```
Migration awal dibuat otomatis dari `schema.prisma` saat image di-build. Untuk perubahan skema berikutnya gunakan
`npx prisma migrate dev --name <nama>` di komputer Anda lalu commit folder `prisma/migrations`.
