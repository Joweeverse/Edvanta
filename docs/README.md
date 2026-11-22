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

Koleksi data: `users` (role student atau mentor, plus `credibility_points`, `bio`, `portfolio_url`), `classes`, `lessons`, `quizzes`, `enrollments`, `attempts`, `discussions`, `certificates`.

Logika di server (`pb_hooks`): penilaian kuis, penyembunyian kunci jawaban, penyembunyian isi materi dari non-peserta, poin kredibilitas mentor (saat siswa mendaftar dan saat siswa menyelesaikan kelas), penerbitan sertifikat, dan statistik kelas. Kelas dapat membawa gambar template sertifikat (`classes.certificate_template`) yang diunduh dari `/api/files/`.

# 3. Cara mendapatkan akses

Ada dua jenis pemanggil:

| Pemanggil | Autentikasi | Cara mendapat |
|---|---|---|
| Kelompok lain (server ke server) | Header `X-API-Key: <kunci>`, hanya untuk membaca `/classes` | Minta satu kunci per kelompok kepada kami; kunci bisa dicabut kapan saja |
| Pengguna aplikasi | Header `Authorization: Bearer <token>` | Login lewat `POST /auth/auth-with-password` |

Kami juga menyediakan satu akun uji mentor dan satu akun uji siswa untuk kelompok yang meminta (diberikan lewat pesan langsung, tidak dicantumkan di dokumen ini).

Endpoint selain `/classes` memerlukan Bearer token. Tanpa X-API-Key atau Bearer token, endpoint data mengembalikan `401`. `GET /health` dan endpoint `/auth/...` terbuka dengan batas laju.

# 4. Daftar endpoint

| Metode | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | Terbuka | Cek gateway |
| GET | `/files/classes/{id}/{nama}` | Terbuka (GET saja) | Gambar template sertifikat kelas |
| POST | `/auth/records` | Terbuka | Daftar akun (role student atau mentor) |
| GET | `/auth/records/{id}` | Bearer | Profil publik pengguna: nama, peran, bio, portofolio, poin mentor (email orang lain tidak terlihat) |
| PATCH | `/auth/records/{id}` | Bearer (pemilik akun) | Ubah nama, bio, tautan portofolio |
| POST | `/auth/auth-with-password` | Terbuka | Login, mengembalikan `token` |
| POST | `/auth/auth-refresh` | Bearer | Perbarui token |
| GET | `/classes`, `/classes/{id}` | API key atau Bearer | Daftar dan detail kelas |
| POST | `/classes` | Bearer (mentor) | Buat kelas |
| PATCH, DELETE | `/classes/{id}` | Bearer (mentor pemilik) | Ubah, hapus kelas |
| GET | `/lessons`, `/lessons/{id}` | Bearer | Daftar materi untuk semua pengguna login; isi materi hanya untuk mentor pemilik dan siswa terdaftar |
| POST, PATCH, DELETE | `/lessons`, `/lessons/{id}` | Bearer (mentor) | Kelola materi |
| GET | `/quizzes`, `/quizzes/{id}` | Bearer | Kuis (kunci jawaban disembunyikan dari non-mentor) |
| POST, PATCH, DELETE | `/quizzes`, `/quizzes/{id}` | Bearer (mentor) | Kelola kuis |
| POST | `/quizzes/{id}/submit` | Bearer (siswa terdaftar) | Kirim jawaban, dinilai otomatis |
| GET, POST, DELETE | `/enrollments` | Bearer | Daftar ke kelas, lihat progres |
| GET | `/attempts` | Bearer | Riwayat percobaan kuis |
| POST | `/classes/{id}/certificate` | Bearer (siswa terdaftar) | Terbitkan atau ambil sertifikat setelah semua materi selesai |
| GET | `/classes/{id}/stats` | Bearer (mentor pemilik) | Jumlah peserta, jumlah lulus, rata-rata progres, poin mentor |
| GET, POST, PATCH, DELETE | `/discussions` | Bearer | Diskusi publik dan pesan privat |

Parameter umum untuk daftar: `page`, `perPage`, `filter`, `sort`, `expand`, `fields` (format PocketBase). Respons daftar berbentuk `{ page, perPage, totalItems, totalPages, items: [...] }`.

Aturan domain:

1. Hanya mentor pembuat yang dapat mengubah kelasnya.
2. Materi dibuka berurutan: siswa baru dapat mengirim kuis suatu materi setelah materi sebelumnya selesai.
3. Hasil kuis bersifat pribadi: hanya siswa yang bersangkutan dan mentor kelas yang melihatnya.
4. Progres kelas (`progress`, 0 sampai 100) dihitung dari materi yang sudah lulus kuis, dan hanya dapat berubah lewat penilaian kuis.
5. Isi materi hanya terlihat oleh mentor pemilik kelas dan siswa terdaftar; mentor lain hanya melihat kurikulum.
6. Poin kredibilitas mentor bertambah 1 setiap siswa baru mendaftar ke kelasnya, dan bertambah 2 saat progres seorang siswa pertama kali mencapai 100%. Bonus penyelesaian hanya diberikan sekali per siswa dan kelas. Mentor yang mendaftar ke kelasnya sendiri tidak mendapat poin.
7. Sertifikat hanya terbit setelah seluruh materi kelas selesai, dan setiap siswa hanya mendapat satu sertifikat per kelas. Mentor dapat memakai gambar template sendiri; tanpa itu dipakai template bawaan. Nama siswa tercetak otomatis.

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

Ambil sertifikat dan statistik kelas:

```
curl -X POST https://edvanta.stei.site/api/classes/ID_KELAS/certificate \
  -H "Authorization: Bearer TOKEN_SISWA"

curl https://edvanta.stei.site/api/classes/ID_KELAS/stats \
  -H "Authorization: Bearer TOKEN_MENTOR"
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

# 7. Aplikasi mobile

Aplikasi Edvanta (React Native, Expo) memakai layanan ini sebagai backend. Tampilannya bergaya batik dan kopi (latar krem, warna soga, aksen indigo, judul serif).

**Navigasi.** Sebelum login, stack berisi Login dan Daftar (memilih peran Siswa atau Mentor). Setelah login muncul tab bawah dengan lima layar: Kelas, Favorit, Kelas Saya (siswa) atau Kelas Diampu (mentor), Jelajah, dan Profil. Dari tab, pengguna membuka layar lain lewat navigasi stack: Detail Kelas, Materi, Kuis, Diskusi, serta layar mentor (Buat Kelas, Kelola Kelas, Tambah Materi, Buat Kuis), Profil Pengguna, dan Edit Profil.

| Layar | Peran | Fungsi | Endpoint yang dipanggil |
|---|---|---|---|
| Login | Semua | Masuk dengan email dan password (divalidasi) | `POST /auth/auth-with-password` |
| Daftar | Semua | Buat akun sebagai siswa atau mentor | `POST /auth/records` |
| Kelas | Semua | Daftar kelas dengan pencarian dan penanda favorit | `GET /classes` |
| Favorit | Semua | Kelas favorit, disimpan di perangkat per akun | tidak ada |
| Detail Kelas | Semua | Kurikulum, pendaftaran, progres, unduh sertifikat (PDF) | `GET /lessons`, `GET /enrollments`, `POST /enrollments`, `POST /classes/{id}/certificate`, `GET /files/...` |
| Materi | Siswa, mentor pemilik | Isi materi dan tautan video | `GET /quizzes` |
| Kuis | Siswa | Jawab pertanyaan, dinilai server | `POST /quizzes/{id}/submit` |
| Diskusi | Siswa, mentor | Diskusi publik, pesan privat, balasan privat mentor | `GET /discussions`, `POST /discussions` |
| Kelas Saya | Siswa | Kelas yang diikuti beserta progres | `GET /enrollments` |
| Kelas Diampu | Mentor | Kelas milik sendiri | `GET /classes` |
| Buat Kelas | Mentor | Judul, kategori, deskripsi (divalidasi) | `POST /classes` |
| Kelola Kelas | Mentor | Statistik, daftar materi, template sertifikat, pratinjau | `GET /classes/{id}/stats`, `GET /lessons`, `GET /quizzes`, `PATCH /classes/{id}` |
| Tambah Materi | Mentor | Materi teks dan tautan YouTube | `POST /lessons` |
| Buat Kuis | Mentor | Soal pilihan ganda, kunci jawaban, nilai minimum | `POST /quizzes` |
| Jelajah | Semua | Data dari layanan kelompok lain | API kelompok lain |
| Profil, Edit Profil | Semua | Data akun sendiri, poin kredibilitas (mentor), bio, portofolio; ubah profil | `GET`, `PATCH /auth/records/{id}` |
| Profil Pengguna | Semua | Melihat profil publik pengguna lain (dibuka dari nama mentor di detail kelas atau nama penulis di diskusi) | `GET /auth/records/{id}` |

**Login.** Token dari login disimpan di penyimpanan aman perangkat (SecureStore) dan dikirim sebagai header `Authorization: Bearer` di setiap request. Saat aplikasi dibuka lagi, sesi dipulihkan otomatis. Tombol Keluar menghapus token. Profil pengguna lain hanya menampilkan nama, peran, bio, tautan portofolio, dan poin kredibilitas mentor; email tidak ditampilkan.

**ApiService.js.** Semua request lewat satu berkas yang menangani batas waktu 15 detik, pesan error yang jelas, dan header autentikasi. Layar daftar menampilkan tiga kondisi: memuat, gagal (dengan tombol coba lagi), dan kosong. Layar Jelajah memanggil layanan kelompok lain dengan header `X-API-Key`; kegagalan satu layanan tidak menghentikan yang lain.

**Sertifikat.** Setelah progres 100%, siswa menekan Unduh sertifikat. Aplikasi mengambil data dari server, menyusun halaman A4 dengan nama siswa di tengah (di atas template mentor bila ada, atau template bawaan), lalu membuka dialog cetak sistem untuk disimpan sebagai PDF.

**Pengujian.** Jest menguji validasi form (login, daftar, kelas, materi, kuis, profil), penyusunan sertifikat, dan ApiService (login, header Bearer, penanganan error, pemetaan data kelompok lain, submit kuis, diskusi, sertifikat).
