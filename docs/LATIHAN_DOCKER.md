# Latihan Docker (demo untuk tugas DevOps)

Pastikan sistem sudah berjalan (`docker compose up --build -d`) dan semua service healthy (`docker compose ps`).
Port gateway untuk uji langsung: `http://localhost:8000`.

## Latihan 1 — Menjalankan semuanya
`docker compose up --build -d` lalu `docker compose ps`. Perhatikan: hanya `frontend` (8080) dan `api-gateway` (8000) yang punya port ke host.
MySQL dan service lain hanya ada di jaringan internal.

## Latihan 2 — Scaling report-service
```
docker compose up -d --scale report-service=3
docker compose ps                      # ada 3 container report-service
```
Lihat pembagian beban (butuh token; ambil dulu dengan login):
```
TOKEN=$(curl -s localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Password123!"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -D - localhost:8000/api/reports -H "Authorization: Bearer $TOKEN" | grep -i x-served-by; done
```
Nilai `X-Served-By` akan berganti-ganti antar container (pembaruan daftar IP di gateway bisa butuh sekitar 3 detik). Kembali: `--scale report-service=1`.

## Latihan 3 — Mematikan notification-service
```
docker compose stop notification-service
```
Login sebagai `petugas`, buat dan submit laporan → tetap berhasil. Lihat `docker compose logs report-service` ada peringatan "event gagal dikirim".
Hidupkan lagi: `docker compose start notification-service`. Coba juga `docker compose stop audit-service`.

## Latihan 4 — Update satu service tanpa menyentuh yang lain
Ubah sedikit pesan di `services/auth-service/src/...`, lalu:
```
docker compose up -d --build auth-service
```
Hanya auth-service yang dibuild dan di-restart; service lain tidak berubah (`docker compose ps` — lihat kolom "created/uptime").

## Latihan 5 — Restart dan data tetap ada
```
docker compose restart report-service
docker compose down && docker compose up -d      # tanpa -v
```
Data masih ada karena MySQL memakai volume `mysql_data_ms` dan foto di `uploads_data`.

## Latihan 6 — Menelusuri satu request
Buat request, catat header `X-Request-Id` dari responsnya, lalu: `docker compose logs | grep <request-id>`
→ muncul di gateway dan service tujuan.

## Latihan 7 — Isolasi database
`docker compose exec mysql mysql -ureport_user -p -e "SHOW DATABASES;"` (password = DB_PASSWORD) → hanya `report_db` yang terlihat.
