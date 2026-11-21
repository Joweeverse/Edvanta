---
title: "Edvanta Classroom Service"
subtitle: "README: layanan inti Tugas Besar TST × PWAM (Education & Learning Tools)"
---

# 1. Ringkasan

Edvanta Classroom Service adalah microservice untuk kelas digital: mentor membuat kelas, materi, dan kuis; siswa mendaftar, mengerjakan kuis yang dinilai otomatis di server, dan melihat progres belajar. Layanan berjalan di STB (Docker) dan dibuka ke internet lewat Cloudflare Tunnel.

- Base URL: `https://edvanta.stei.site/api`
- Kelas: K02
- Dokumentasi mesin-baca: `openapi.yaml` dan `Edvanta.postman_collection.json` di repositori
- Repositori: https://github.com/Joweeverse/Edvanta (private; akses diberikan kepada asisten)

# 2. Arsitektur

```
Internet --> Cloudflare Tunnel --> Nginx gateway (port 80) --> core-service (PocketBase)
                                       |                              |
                              cek X-API-Key / Bearer           SQLite (volume core_data)
                              rate limit 10 req/s per IP       pb_hooks: penilaian kuis
```

| Komponen | Teknologi | Peran | Batas sumber daya |
|---|---|---|---|
| gateway | Nginx 1.28 (Alpine) | Satu pintu masuk, cek kunci akses, rate limit | 64 MB, 0,25 CPU |
| core-service | PocketBase (Docker) | Data dan aturan akses, logika kuis (`pb_hooks`) | 256 MB, 0,5 CPU |
| tunnel | cloudflared | Akses publik tanpa membuka port | Dikelola di host STB |

Koleksi data: `users` (role: student/mentor), `classes`, `lessons`, `quizzes`, `enrollments`, `attempts`, `discussions`.

# 3. Cara mendapatkan akses

Ada dua jenis pemanggil:

| Pemanggil | Autentikasi | Cara mendapat |
|---|---|---|
| Kelompok lain (server ke server) | Header `X-API-Key: <kunci>` | Minta satu kunci per kelompok kepada kami; kunci bisa dicabut kapan saja |
| Pengguna aplikasi | Header `Authorization: Bearer <token>` | Login lewat `POST /auth/auth-with-password` |

Kami juga menyediakan satu akun uji mentor dan satu akun uji siswa untuk kelompok yang meminta (diberikan lewat pesan langsung, tidak dicantumkan di dokumen ini).

Tanpa X-API-Key atau Bearer token, endpoint data mengembalikan `401`. `GET /health` dan endpoint `/auth/...` terbuka dengan batas laju.

# 4. Daftar endpoint

| Metode | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | Terbuka | Cek gateway |
| POST | `/auth/records` | Terbuka | Daftar akun (role student atau mentor) |
| POST | `/auth/auth-with-password` | Terbuka | Login, mengembalikan `token` |
| POST | `/auth/auth-refresh` | Bearer | Perbarui token |
| GET | `/classes`, `/classes/{id}` | API key atau Bearer | Daftar dan detail kelas |
| POST | `/classes` | Bearer (mentor) | Buat kelas |
| PATCH, DELETE | `/classes/{id}` | Bearer (mentor pemilik) | Ubah, hapus kelas |
| GET | `/lessons`, `/lessons/{id}` | API key atau Bearer | Materi kelas |
| POST, PATCH, DELETE | `/lessons`, `/lessons/{id}` | Bearer (mentor) | Kelola materi |
| GET | `/quizzes`, `/quizzes/{id}` | API key atau Bearer | Kuis (kunci jawaban disembunyikan dari non-mentor) |
| POST, PATCH, DELETE | `/quizzes`, `/quizzes/{id}` | Bearer (mentor) | Kelola kuis |
| POST | `/quizzes/{id}/submit` | Bearer (siswa terdaftar) | Kirim jawaban, dinilai otomatis |
| GET, POST, DELETE | `/enrollments` | Bearer | Daftar ke kelas, lihat progres |
| GET | `/attempts` | Bearer | Riwayat percobaan kuis |
| GET, POST, PATCH, DELETE | `/discussions` | Bearer | Diskusi publik dan pesan privat |

Parameter umum untuk daftar: `page`, `perPage`, `filter`, `sort`, `expand`, `fields` (format PocketBase). Respons daftar berbentuk `{ page, perPage, totalItems, totalPages, items: [...] }`.

Aturan domain:

1. Hanya mentor pembuat yang dapat mengubah kelasnya.
2. Materi dibuka berurutan: siswa baru dapat mengirim kuis suatu materi setelah materi sebelumnya selesai.
3. Hasil kuis bersifat pribadi: hanya siswa yang bersangkutan dan mentor kelas yang melihatnya.
4. Progres kelas (`progress`, 0 sampai 100) dihitung dari materi yang sudah lulus kuis.

# 5. Contoh request

Cek kesehatan:

```
curl https://edvanta.stei.site/api/health
```

Daftar kelas (kelompok lain, dengan API key):

```
curl https://edvanta.stei.site/api/classes?perPage=10 \
  -H "X-API-Key: KUNCI_ANDA"
```

Login siswa:

```
curl -X POST https://edvanta.stei.site/api/auth/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"siswa@example.com","password":"PASSWORD"}'
```

Daftar ke kelas, lalu kirim jawaban kuis:

```
curl -X POST https://edvanta.stei.site/api/enrollments \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"user":"ID_SISWA","class":"ID_KELAS"}'

curl -X POST https://edvanta.stei.site/api/quizzes/ID_KUIS/submit \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"answers":[0,2,1]}'
```

Contoh respons submit:

```
{"score":100,"passed":true,"correct":3,"total":3,"progress":50}
```

# 6. Cara menjalankan sendiri

```
git clone https://github.com/Joweeverse/Edvanta.git
cd Edvanta
cp .env.example .env
cp gateway/api_keys.conf.example gateway/api_keys.conf   # isi kunci API
docker compose up -d --build
```

Dashboard PocketBase: port 8094 (jaringan lokal). Buat akun superuser dengan:

```
docker compose exec core-service /usr/local/bin/pocketbase superuser upsert EMAIL PASSWORD --dir=/pb_data
```

Berkas `.env` dan `gateway/api_keys.conf` tidak disimpan di Git.
