#!/bin/bash
# Dijalankan otomatis oleh image MySQL SEKALI saat volume data masih kosong.
# Membuat 1 database + 1 user MySQL per service. Setiap user HANYA berhak atas database miliknya,
# sehingga service tidak bisa membaca database service lain (database-per-service).
set -e
for svc in auth master_data report notification audit; do
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS ${svc}_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${svc}_user'@'%' IDENTIFIED BY '${SERVICE_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${svc}_db.* TO '${svc}_user'@'%';
SQL
done
echo "Database per service berhasil dibuat."
