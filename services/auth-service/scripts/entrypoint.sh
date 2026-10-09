#!/bin/sh
set -e
# 1) Terapkan migration ke database milik service ini (menunggu MySQL siap bila perlu)
i=0
until npx prisma migrate deploy; do
  i=$((i+1)); [ "$i" -ge 30 ] && { echo "Migration gagal setelah 30 percobaan."; exit 1; }
  echo "Menunggu database ($i/30) ..."; sleep 3
done
# 2) Seed data awal (hanya service yang punya prisma/seed.js dan SEED_ON_START=true)
if [ "$SEED_ON_START" = "true" ] && [ -f prisma/seed.js ]; then node prisma/seed.js; fi
# 3) Jalankan service
exec node src/server.js
