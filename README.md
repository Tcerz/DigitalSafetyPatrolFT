# Digital Safety Patrol — Microservices

Aplikasi pengelolaan Safety Patrol untuk operasional Fuel Terminal, dijalankan dengan Docker.

```
Browser ─► frontend (Vue + Nginx) ─► api-gateway ─┬─► auth-service ──────► auth_db
                                                   ├─► master-data-service ► master_data_db
                                                   ├─► report-service ─────► report_db  (+ volume foto)
                                                   ├─► notification-service ► notification_db
                                                   └─► audit-service ──────► audit_db
                                          (satu server MySQL, lima database terpisah)
```

| Folder | Isi |
|---|---|
| `frontend/` | Vue 3 + Vite (tidak berubah; hanya bicara dengan gateway) |
| `gateway/` | API Gateway: pintu masuk, cek token, routing, load balancing, request-id |
| `services/auth-service` | Login, token, password, manajemen user |
| `services/master-data-service` | Depot, produk, tangki, personel |
| `services/report-service` | Laporan patrol, aktivitas, finding, corrective action, foto, statistik, PDF |
| `services/notification-service` | Notifikasi |
| `services/audit-service` | Audit log |
| `_common/` | Kode bersama (disalin ke tiap service oleh `scripts/sync-common.sh`) |
| `docker-compose.yml` | Menjalankan semuanya |
| `docs/` | `ARCHITECTURE.md` (penjelasan konsep) dan `LATIHAN_DOCKER.md` (latihan demo) |
| `legacy-monolith/` | Backend monolith lama, hanya untuk referensi |

Mulai dari **`INSTALASI.txt`**. Untuk memahami arsitekturnya, baca **`docs/ARCHITECTURE.md`**.

## Akun demo (hasil seed, hanya development)
`superadmin`, `admin`, `petugas` — password dari `SEED_PASSWORD` (default `Password123!`).

## Yang sudah dan belum
- **Tahap 1 (ini):** 6 service (gateway + 5), database per service, komunikasi antar-service lewat REST, load balancing di gateway, dan isolasi kegagalan.
- **Latihan berikutnya:** memecah `report-service` lagi menjadi finding, corrective-action, file, dan statistics (urutan di `docs/ARCHITECTURE.md`).
- **Status pengujian:** gateway, auth-service, dan report-service diuji dengan database tiruan (routing, token, role, validasi, isolasi 503). **Belum dijalankan dengan Docker dan MySQL sungguhan**, karena sandbox pengembangan tidak bisa menjalankannya. Jalankan `docker compose up --build` lalu `node --test tests/integration.test.mjs` untuk membuktikan seluruh alur; kirim log bila ada error.
