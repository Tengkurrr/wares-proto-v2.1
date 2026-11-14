# WARES — Laporan Audit Kesiapan

Tanggal audit: 3 Agustus 2026 (Asia/Jakarta)
Baseline: `debastene/wares-proto` commit `afbcbef`, ditambah revisi pada working copy ini.

## Kesimpulan eksekutif

Alur utama sudah jauh lebih aman untuk demonstrasi: timeout Google Sheets tidak lagi langsung
dianggap gagal, request tidak dikirim ulang otomatis, jurnal dikonfirmasi dengan ID idempoten, dan
status pengguna membedakan proses, pemeriksaan, berhasil, gagal definitif, serta belum pasti.

Build produksi, TypeScript, ESLint, sintaks Apps Script, dan audit dependency sudah lulus. Halaman
login build produksi juga sudah diperiksa melalui browser lokal. Pengujian transaksi end-to-end ke
Supabase dan spreadsheet live belum dilakukan karena Apps Script versi baru, migrasi database, dan
deployment Vercel belum diterapkan.

Status yang tepat untuk presentasi: **siap diuji di environment dummy setelah tiga langkah deployment
di bagian akhir dokumen**. Status produksi penuh masih membutuhkan keputusan identitas pengguna dan
penguatan boundary Supabase yang dicatat sebagai risiko tersisa.

Review regresi tidak menemukan temuan P0. Dua risiko P1 arsitektural yang masih tersisa adalah edit
serentak lintas Sheets/Supabase dan hak tulis Supabase langsung oleh role client; keduanya dijelaskan
secara terbuka di bawah agar demo tidak disalahartikan sebagai kesiapan produksi penuh.

## Perbaikan yang sudah diterapkan

### Konsistensi transaksi dan timeout

- Permintaan baru/edit memakai `requestId` dan `syncToken` yang stabil.
- Jurnal `KELUAR` di-flush sebelum pekerjaan laporan; pemeriksaan `outgoing.status` bersifat read-only
  dan tidak menunggu global lock.
- Hasil HTTP ambigu tidak memicu rollback atau POST/PATCH otomatis kedua.
- Setelah Sheets terkonfirmasi, endpoint status dapat menyelesaikan riwayat Supabase yang respons
  awalnya terputus.
- Input Stok memakai pola yang sama dengan `transactionId` dan `incoming.status`.
- Timestamp pembuatan yang sama dipakai pada Sheets dan Supabase agar transaksi di batas pergantian
  bulan tidak masuk ke dua periode berbeda.

### Performa dan UX

- Validasi stok membaca jurnal `MASUK`/`KELUAR` secara batch.
- Laporan bulan berjalan disinkronkan satu kali secara batch, bukan per barang.
- Rollover bulan memiliki marker `BUILDING/READY`, dapat dilanjutkan setelah eksekusi terputus, dan
  reset material dilakukan secara batch.
- Cache sinkronisasi edit jurnal manual dipersingkat dari lima menit menjadi 60 detik.
- Form permintaan tidak lagi melakukan polling stok terus-menerus ketika pengguna mengisi/menyimpan.
- Combobox berbagi cache dan request aktif; halaman stok berhenti polling saat tab tersembunyi.
- Transaksi yang belum pasti dipulihkan setelah refresh dengan ID/token lama, disimpan maksimum 24
  jam, dan dipisahkan berdasarkan ID akun pada perangkat yang dipakai bersama.
- Navigasi server mempunyai loading skeleton dan kegagalan database mempunyai halaman retry yang jelas.
- Error awal halaman stok tidak lagi ditampilkan bersamaan dengan empty state yang menyesatkan.
- Filter kategori dashboard berasal dari kategori material aktual, bukan kategori pekerjaan.

### Keamanan dan validasi

- Next.js dinaikkan dari 14.2.35 yang EOL ke 15.5.22 yang masih didukung.
- PostCSS dan Sharp dipatok ke versi aman; `npm audit` saat audit ini menemukan 0 vulnerability.
- Header `nosniff`, anti-frame, Referrer-Policy, Permissions-Policy, COOP, HSTS, dan CSP dasar aktif;
  header identitas framework dinonaktifkan.
- Open redirect login dengan URL `//host` ditutup.
- Formula-like text (`=`, `+`, `-`, `@`) dinetralkan pada Google Sheets dan ekspor CSV.
- Payload, panjang teks, jumlah barang, tanggal, dan kuantitas dibatasi di Zod, route server, Apps
  Script, serta RPC database.
- Material barang keluar yang tidak ada pada database stok ditolak.
- Seed tidak mempunyai password admin bawaan, mewajibkan minimal 12 karakter, dan dapat merotasi
  password akun admin yang sudah ada.
- API tidak lagi menggandakan pemeriksaan Supabase Auth melalui middleware dan Route Handler.

## Verifikasi yang sudah lulus

- `npm run typecheck`
- `npm run lint` — tanpa warning/error
- `npm run build` — build produksi Next.js 15.5.22 sukses
- `npm audit` — 0 vulnerability
- Parse sintaks `google-apps-script/Code.gs`
- Browser QA lokal halaman `/login`
- Pemeriksaan response security headers pada build produksi lokal

## Risiko tersisa dan keputusan sebelum produksi

1. **Self-signup masih publik.** Siapa pun yang mengetahui URL dapat membuat username berawalan `PG`.
   Untuk produksi, pilih salah satu: akun dibuat admin, undangan email perusahaan, atau SSO; tambahkan
   rate limit pada auth dan API.
2. **Authenticated client masih dapat menulis Supabase langsung melalui RLS/RPC**, melewati Google
   Sheets. Arsitektur produksi sebaiknya memindahkan write ke server-only client/service role, mencabut
   direct insert/RPC dari role `authenticated`, dan memakai durable outbox/receipt sinkronisasi.
3. **Edit admin serentak pada request yang sama belum mempunyai revision compare-and-set lintas dua
   database.** Untuk demo gunakan satu admin editor pada satu permintaan; produksi perlu versi monotonik
   atau lock/outbox per request.
4. Apps Script masih menahan lock selama batch laporan selesai. Durasi sudah jauh lebih singkat, tetapi
   transaksi bersamaan dapat menerima status sibuk dan harus melanjutkan pemeriksaan ID yang sama.
5. Dashboard dibatasi 5.000 baris dan belum memakai agregasi/pagination database untuk volume besar.
6. Input Stok belum mencatat actor admin pada jurnal audit terpisah.
7. Belum ada automated integration/E2E test dan CI untuk skenario timeout, rollover, RLS, serta race.
8. Endpoint pemeriksaan status belum mempunyai rate limit atau durable pending-intent di database.
   Pengguna login dapat mengirim UUID acak dan menghabiskan kuota baca Apps Script sebelum ownership
   transaksi dapat diverifikasi.
9. `syncToken` belum terikat pada hash payload. Server dan Sheets perlu menyimpan payload hash dan
   menolak token yang sama apabila isi transaksinya berbeda.
10. Jika pembuatan akun Auth berhasil tetapi insert profil gagal, akun tanpa profil masih mungkin
    tertinggal. Alur signup produksi perlu fungsi transaksional/server admin atau proses cleanup.

## Urutan deployment dan smoke test wajib

Selama rollout, hentikan sementara pemakaian form permintaan/Input Stok agar tidak ada transaksi di
antara versi komponen yang berbeda.

1. Jalankan ulang seluruh `supabase/schema.sql` di Supabase SQL Editor.
2. Deploy source web baru ke Vercel.
3. Segera salin `google-apps-script/Code.gs`, simpan, lalu **Deploy → Manage deployments → Edit → New
   version → Deploy** pada Apps Script. URL `/exec` tetap sama.
4. Uji dengan spreadsheet dummy:
   - login karyawan → beranda → buat satu permintaan;
   - jumlah diberikan lebih kecil dari permintaan;
   - angka stok dan jurnal `KELUAR` berubah tepat satu kali;
   - login admin → edit permintaan dan verifikasi koreksi selisih;
   - Input Stok satu kali dan verifikasi `MASUK`, stok, serta pesan berhasil;
   - detail, PDF, riwayat, dashboard, dan ekspor CSV;
   - refresh halaman ketika status masih diperiksa dan pastikan ID lama dilanjutkan, bukan dibuat baru.

Jika salah satu transaksi menampilkan **belum dapat dipastikan**, jangan membuat transaksi baru dengan
data sama. Gunakan **Periksa Status** dan catat ID yang tampil untuk rekonsiliasi.
