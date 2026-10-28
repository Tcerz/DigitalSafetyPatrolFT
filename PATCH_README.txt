PATCH FITUR "STATUS SISTEM" + PIPELINE CI/CD
============================================
Cara pasang singkat (panduan lengkap ada di dokumen "Panduan Pemasangan Fitur Status Sistem dan CI/CD"):

1. Commit dulu kondisi proyek Anda yang sekarang (git add . && git commit -m "sebelum patch") agar mudah dibatalkan.
2. Salin ISI folder cicd-patch/ ke folder ROOT proyek (yang berisi docker-compose.yml). Pilih "Replace / Timpa" bila diminta.
   Folder tersembunyi .github harus ikut tersalin.
3. Edit file .env (BUKAN .env.example): tambahkan  DOCKERHUB_USERNAME=<username Docker Hub Anda>
4. Jalankan:  docker compose up --build -d
5. Login sebagai admin/superadmin -> menu "Status Sistem".

File BARU : VERSION, .github/workflows/ci-cd.yml, docker-compose.hub.yml,
            frontend/src/views/SystemStatusView.vue, gateway/tests/gateway.test.mjs
File DIUBAH: .env.example, frontend/Dockerfile, frontend/src/router/index.js, frontend/src/components/AppLayout.vue,
            gateway/Dockerfile, gateway/src/app.js, gateway/package.json,
            INSTALASI.txt, README.md, docs/*.md, tests/integration.test.mjs (perbaikan perintah tes untuk Node 22)
