# WARES — Warehouse Request System

WARES mendigitalisasi pencatatan **Surat Pengambilan Barang** untuk Departemen Pergudangan &
Pengantongan, PT Petrokimia Gresik.

Google Sheets adalah sumber utama stok. Supabase dipakai untuk login, peran pengguna, data
permintaan, dan riwayat aplikasi. Tidak ada alur persetujuan atau status permintaan: data yang
disimpan langsung dianggap sebagai pencatatan barang keluar.

## Fitur revisi

- Pengguna yang berhasil login masuk ke homepage WARES dan memilih layanan dari kartu menu sesuai
  perannya.
- Semua pengguna yang sudah login dapat melihat stok terkini dari Google Sheets.
- Karyawan dan admin dapat membuat permintaan dengan jumlah **Diminta** dan **Diberikan** yang
  berbeda. Jumlah diberikan tidak boleh melebihi jumlah diminta atau stok tersedia.
- Stok berkurang berdasarkan jumlah yang benar-benar diberikan.
- Nama penyerah mengikuti akun yang login dan tidak dapat diedit; PIC/nama penerima diisi manual.
- Hanya admin yang dapat mengedit permintaan tersimpan. Koreksi stok dilakukan berdasarkan selisih
  dan aman terhadap retry dengan ID transaksi yang idempoten.
- Hanya admin yang dapat membuka **Input Stok**. Keterangan berasal dari riwayat sheet `MASUK` dan
  menyediakan pilihan **Lainnya** untuk input manual.
- Hanya admin yang dapat membuka **Master Data** untuk menambah, mengedit, menonaktifkan, atau
  mengaktifkan kembali material. Baris spreadsheet tidak dihapus agar formula laporan tetap aman.
- Rack dan Area berasal dari tab `RACK GUDANG`. Input Stok mewajibkan Rack, mengisi Area otomatis,
  dan tetap menyediakan pilihan Area lain dari daftar resmi untuk kebutuhan operasional.
- Informasi stok serta pilihan material menampilkan `Rack / Area` agar pengguna langsung mengetahui
  lokasi penyimpanan barang.
- Timeout Input Stok tidak langsung dianggap gagal. Website memeriksa ID transaksi yang sama tanpa
  mengirim ulang stok, lalu menampilkan status mengirim, memeriksa, berhasil, gagal, atau belum pasti
  secara jelas.
- Timeout formulir permintaan diperlakukan dengan cara yang sama: jurnal diperiksa memakai ID dan
  token sinkronisasi yang sama, tanpa rollback atau POST/PATCH otomatis yang berisiko menggandakan stok.
- Sheet `MASUK` dan `KELUAR` menjadi jurnal keseluruhan. Laporan bulanan mengikuti template
  `Juli 2026 - DATA BASE LAPORAN HARIAN`.
- Pada pergantian bulan, stok awal berasal dari **Stok Akhir** bulan sebelumnya. Trigger dijadwalkan
  pada tanggal 1 pukul 00.00 WIB dan dilengkapi fallback pada akses pertama bulan baru.

Keputusan produk lengkap dicatat di [`WARES_PROJECT_MEMORY.md`](WARES_PROJECT_MEMORY.md).

## Arsitektur data

```text
Browser pengguna
  ├─ Supabase Auth (login dan peran)
  └─ Next.js API di Vercel
       ├─ Supabase Postgres (permintaan dan riwayat)
       └─ Google Apps Script (secret hanya di server)
            └─ Google Sheets (stok, MASUK, KELUAR, laporan bulanan)
```

Secret Apps Script tidak pernah dikirim ke browser dan tidak boleh memakai awalan `NEXT_PUBLIC_`.

## Menjalankan di lokal

### 1. Instal dependency

Gunakan Node.js 20.9 atau lebih baru (hingga versi 24).

```bash
npm install
```

### 2. Konfigurasi Supabase

1. Buat/buka project Supabase.
2. Pada **Authentication → Sign In / Providers → Email**, matikan konfirmasi email. WARES memakai
   email sintetis internal `username@wares.local`.
3. Buka **SQL Editor**, salin seluruh isi [`supabase/schema.sql`](supabase/schema.sql), lalu jalankan.
   Skrip bersifat idempoten dan juga memigrasikan instalasi WARES lama.
4. Untuk deployment Postgres yang sudah ada, jalankan juga
   [`supabase/migrations/2026-08-09-master-data-rack.sql`](supabase/migrations/2026-08-09-master-data-rack.sql)
   sebelum aplikasi versi baru dipakai. Migrasi ini menambahkan metadata Rack/Area pada ledger,
   snapshot, dan RPC Input Stok.
5. Pada project Supabase yang sudah ada, jalankan pula
   [`supabase/migrations/2026-08-10-master-items-postgres.sql`](supabase/migrations/2026-08-10-master-items-postgres.sql).
   Migrasi ini membuat sumber baca Master Data yang cepat. Jangan mengaktifkan
   `MASTER_SOURCE=postgres` sebelum bagian **Isi Master Data Postgres dari spreadsheet FINAL** selesai.

### 3. Deploy integrasi Google Sheets

Gunakan spreadsheet dummy terbaru yang sudah disepakati sebagai project pengembangan:
`14rUshtHE2lF9QM0SlCB4djMfuzlLt3XK7zhcBi5VxSY`.

1. Buka Google Sheet lalu pilih **Extensions → Apps Script**.
2. Impor `RACK GUDANG.xlsx` ke workbook FINAL sebagai tab bernama persis `RACK GUDANG` dengan
   header `RACK` dan `AREA`. Mapping embedded di kode hanya berfungsi sebagai cadangan terverifikasi.
3. Salin [`google-apps-script/Code.gs`](google-apps-script/Code.gs) dan isi manifest dengan
   [`google-apps-script/appsscript.json`](google-apps-script/appsscript.json).
4. Di **Project Settings → Script Properties**, buat `WARES_API_SECRET` dengan nilai acak minimal
   32 karakter.
5. Jalankan `migrateLegacyRackDataSafely()` satu kali, lalu jalankan
   `installMonthlyTrigger()` satu kali dari editor dan berikan izin yang diminta.
6. Pilih **Deploy → New deployment → Web app**. Jalankan sebagai pemilik spreadsheet dan pilih
   akses **Anyone** agar server Vercel dapat memanggilnya tanpa sesi Google. Secret panjang tadi tetap
   diwajibkan oleh setiap request. Jika kebijakan Workspace melarang opsi ini, integrasi perlu memakai
   service account/OAuth internal sebelum produksi.
7. Simpan URL deployment yang berakhiran `/exec` dan secret tadi untuk langkah environment.

Panduan dan kontrak API lebih rinci tersedia di
[`google-apps-script/README.md`](google-apps-script/README.md).

### 4. Isi environment lokal

Salin `.env.local.example` menjadi `.env.local`, lalu isi seluruh nilai wajib.

```bash
cp .env.local.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SHEETS_API_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=14rUshtHE2lF9QM0SlCB4djMfuzlLt3XK7zhcBi5VxSY

# Gunakan sheets hanya selama penyiapan awal; ubah ke postgres setelah backfill.
MASTER_SOURCE=sheets
STOCK_SOURCE=sheets

ADMIN_USERNAME=PGADMIN
ADMIN_PASSWORD=
ADMIN_NAMA=Administrator WARES
ADMIN_EMAIL=
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai oleh script seed/backfill lokal. Jangan menaruhnya di kode
client atau environment runtime Vercel.

### 5. Isi Master Data Postgres dari spreadsheet FINAL

Tahap ini wajib untuk menjaga halaman Master Data tetap cepat. Pastikan URL Apps
Script berasal dari spreadsheet FINAL, lalu jalankan:

```bash
npm run backfill:master
```

Skrip akan:

1. memeriksa ID workbook Apps Script agar tidak membaca spreadsheet lama;
2. menolak melanjutkan jika tab `MASTER DATA`, daftar 50 Rack, atau tabel Supabase belum siap;
3. mengisi `public.master_items` secara idempoten berdasarkan material number; dan
4. menyimpan nomor baris sheet untuk keperluan mirror edit berikutnya.

Verifikasi hasil melalui Supabase SQL Editor:

```sql
select
  count(*) as total,
  count(*) filter (where status = 'AKTIF') as aktif,
  count(*) filter (where sheet_row is not null) as punya_sheet_row,
  count(*) filter (where sheet_sync_status = 'synced') as mirror_tersinkron,
  count(*) filter (where rack between 1 and 50) as rack_terpetakan
from public.master_items;
```

Untuk workbook FINAL dummy saat ini, hasil awal yang diharapkan adalah `total=1299`,
`aktif=1299`, `punya_sheet_row=1299`, `mirror_tersinkron=1299`, dan sekitar
`rack_terpetakan=454`.

Setelah jumlahnya benar, isi `MASTER_SOURCE=postgres` pada Vercel dan lakukan
redeploy. Jangan menyalakan mode Postgres sebelum tahap ini; katalog kosong akan
ditolak sebagai konfigurasi yang belum selesai, bukan ditampilkan sebagai “0 material”.

### 6. Siapkan admin

```bash
npm run seed
```

Script ini idempoten. Katalog Supabase lama tetap diisi untuk kompatibilitas data historis. Sumber
angka stok aktif mengikuti `STOCK_SOURCE`. `ADMIN_PASSWORD` wajib unik, minimal 12 karakter,
dan tidak mempunyai nilai bawaan. Menjalankan seed kembali juga merotasi password akun admin yang
sudah ada sesuai nilai environment tersebut.

### 7. Jalankan aplikasi

```bash
npm run dev
```

Buka <http://localhost:3000> dan login memakai akun yang sudah dibuat.

## Konfigurasi Vercel

Tambahkan variabel berikut pada project Vercel untuk Production/Preview sesuai kebutuhan, lalu
redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_SHEETS_API_URL`
- `GOOGLE_SHEETS_API_SECRET`
- `MASTER_SOURCE` — isi `postgres` setelah migration + backfill Master Data selesai
- `STOCK_SOURCE` — ikuti mode stok yang sudah disiapkan pada deployment

`SUPABASE_SERVICE_ROLE_KEY` tidak dibutuhkan oleh runtime aplikasi saat ini; tambahkan hanya jika
proses deployment memang menjalankan seed. Setelah perubahan source di-push ke branch deployment,
Vercel akan membangun versi baru seperti biasa.

## Perintah verifikasi

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server pengembangan |
| `npm run typecheck` | Memeriksa tipe TypeScript |
| `npm run lint` | Menjalankan ESLint |
| `npm run build` | Membuat build produksi |
| `npm run test:unit` | Memeriksa konfigurasi sumber Master Data dan daftar Rack kanonik |
| `npm run seed` | Membuat/memperbarui katalog kompatibilitas dan akun admin |
| `npm run backfill:master` | Mengisi Master Data Postgres dari spreadsheet yang sudah diverifikasi |
| `npm audit` | Memeriksa advisori keamanan dependency |

## Struktur penting

```text
google-apps-script/             API dan otomasi pada spreadsheet
src/app/api/stock/             endpoint baca stok dan input stok admin
src/app/api/requests/          transaksi permintaan + sinkronisasi KELUAR
src/app/(app)/home/            homepage setelah login dan menu berbasis peran
src/app/(app)/stok/            informasi stok untuk semua pengguna
src/app/(app)/input-stok/      pencatatan material masuk khusus admin
src/app/(app)/master-data/     editor Master Data khusus admin
src/app/(app)/buat-permintaan/ form permintaan
src/app/(app)/riwayat/         riwayat dan edit khusus admin
src/app/(app)/dashboard/       analitik jumlah yang benar-benar diberikan
supabase/schema.sql            skema, migrasi, RPC transaksional, dan RLS
WARES_PROJECT_MEMORY.md        keputusan produk terbaru
```

## Catatan keamanan dan operasional

- Username WARES wajib diawali `PG`.
- Jangan commit `.env.local`, secret Apps Script, service-role key, atau kredensial akun.
- Kolom teknis `_WARES_*` yang ditambahkan dan disembunyikan pada `MASUK`/`KELUAR` diperlukan untuk
  idempotensi; jangan dihapus.
- CRUD Master Data hanya menulis `A:H` dan `P`. Jangan memindahkan kolom `STATUS` dari `P`, menghapus
  slot template, atau mengurutkan baris fisik karena laporan bulanan merujuk nomor baris Master Data.
- Konfirmasi timeout Input Stok memakai action `incoming.status` yang membaca ID transaksi tanpa
  mengambil lock global. Action ini tidak mengirim ulang `incoming.record`.
- Konfirmasi timeout permintaan memakai action `outgoing.status`; hasil baru dianggap berhasil ketika
  seluruh baris jurnal dan riwayat Supabase sudah terkonfirmasi.
- Apps Script memakai `LockService` untuk mencegah dua transaksi stok saling menimpa.
- Setelah mengubah `Code.gs`, buat versi deployment Apps Script baru agar URL `/exec` menjalankan kode
  terbaru.
- Pada mode Postgres, status mirror Master Data dicatat sebagai `pending`, `synced`, atau `failed`.
  UI memeriksa status ringan ini di Postgres; pemeriksaan tersebut tidak mengirim ulang request Apps
  Script dan tidak menggandakan material.
- Self-signup masih aktif untuk kebutuhan prototype. Sebelum dipakai sebagai sistem produksi, tentukan
  kebijakan identitas resmi (akun dibuat admin, undangan email perusahaan, atau SSO) dan rate limit.
