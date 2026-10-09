# Digital Safety Patrol — Backend

Node.js · Express · Prisma ORM · MySQL · JWT. Arsitektur: routes → middleware → controllers → services → Prisma.
Dokumentasi endpoint: `docs/API.md`. Skema database: `prisma/schema.prisma`.

## Menjalankan tanpa Docker
```bash
cp .env.example .env            # isi DATABASE_URL & JWT_SECRET
npm install
npx prisma generate
# Migration awal (sekali): buat dari schema lalu terapkan
mkdir -p prisma/migrations/00000000000000_init
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/00000000000000_init/migration.sql
printf 'provider = "mysql"\n' > prisma/migrations/migration_lock.toml
npx prisma migrate deploy
npm run seed
npm run dev                      # http://localhost:3000/api/health
```
(Alternatif saat development: `npx prisma migrate dev --name init`.)
Perubahan skema selanjutnya: edit `schema.prisma` → `npx prisma migrate dev --name <nama>` → commit folder `prisma/migrations`.

## Docker
Gunakan `docker-compose.yml` di root proyek (lihat `../INSTALASI.txt`).

## Tes integrasi
Setelah API + MySQL aktif dan seed terisi: `BASE_URL=http://localhost:3000 npm test`
(mengikuti alur PRD: login → buat laporan → foto → submit → verifikasi → finding → corrective action → tutup → statistik/PDF/audit).

## Catatan keamanan
Password di-hash (bcryptjs), JWT diverifikasi + user dibaca ulang dari database tiap request, helmet, CORS terbatas ke `FRONTEND_URL`,
rate limit login, validasi zod, upload divalidasi (MIME, ukuran, signature file, nama file dibuat ulang server).
Ganti `JWT_SECRET` dan password seed sebelum production.
