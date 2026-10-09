#!/bin/sh
# Menyalin _common/ ke src/common/ di setiap service (tiap service harus bisa di-build mandiri).
# Jalankan ulang setiap kali file di _common/ diubah.
cd "$(dirname "$0")/.."
for d in services/*/ gateway; do
  mkdir -p "$d/src/common"
  cp _common/*.js "$d/src/common/"
done
echo "Sinkronisasi _common selesai."
