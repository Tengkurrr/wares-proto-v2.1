# WARES — Project Memory

Dokumen ini adalah sumber keputusan produk terbaru untuk revisi WARES. Jika bertentangan dengan
`WARES_MASTER_PROMPT.md` atau `README.md`, dokumen ini yang berlaku.

Terakhir diperbarui: 10 Agustus 2026 (Asia/Jakarta).

## Status sumber dan deployment

- Repository utama: `https://github.com/debastene/wares-proto.git`.
- Baseline GitHub terbaru yang diaudit adalah branch `main`, commit `5f243e5` (`Master Data pindah
  ke Postgres, Sheets jadi mirror`). Kandidat perbaikan konfigurasi/backfill disiapkan pada branch
  `fix-master-data-sync` dan harus melalui review, deployment Apps Script, migrasi Supabase, serta
  smoke test dummy sebelum digabungkan ke `main`.
- Website Production dapat diakses di `https://wares-proto.vercel.app`.
- Website Production sudah memuat halaman Master Data/Rack, tetapi pada pemeriksaan 10 Agustus 2026
  halaman admin menampilkan `0 material`. Berdasarkan source aktif, kondisi ini paling konsisten
  dengan `MASTER_SOURCE=postgres` yang dinyalakan sebelum tabel `master_items` selesai di-backfill.
  Domain, login, dan proteksi API tetap hidup; sumber data Production harus diverifikasi dari sesi
  admin/Vercel/Supabase sebelum dianggap pulih.
- Halaman publik `/login` dan `/signup` sudah diperiksa langsung pada 3 Agustus 2026: keduanya dapat
  dimuat, form tampil normal, dan tidak ada error/warning console yang terlihat.
- Halaman internal live belum diperiksa melalui browser karena membutuhkan sesi login. Struktur dan
  perilaku internal terbaru dipelajari dari source `origin/main`.

Fitur yang sudah tersedia pada source GitHub terbaru:

- integrasi server Google Sheets dan paket Google Apps Script;
- homepage terautentikasi sebagai tujuan setelah login, dengan menu sesuai peran;
- halaman informasi stok untuk seluruh pengguna login;
- halaman Input Stok khusus admin;
- halaman Master Data khusus admin untuk menambah, mengedit, menonaktifkan, dan mengaktifkan kembali
  material tanpa mengubah posisi baris spreadsheet;
- data Rack/Area terintegrasi pada Master Data, Input Stok, informasi stok, dan pilihan material;
- jumlah Permintaan/Diberikan terpisah pada form, riwayat, detail, dashboard, dan PDF;
- nama penyerah serta PIC/penerima yang benar;
- edit permintaan khusus admin dengan koreksi stok;
- jurnal dan rollover laporan bulanan yang idempoten;
- migrasi Supabase untuk kolom dan RPC baru;
- kunci idempotensi untuk retry permintaan serta input stok;
- konfirmasi input stok berdasarkan ID transaksi apabila respons Google Sheets terlambat, tanpa
  mengirim ulang transaksi secara otomatis;
- konfirmasi permintaan keluar berdasarkan `requestId` + `syncToken`, tanpa rollback atau pengiriman
  ulang otomatis ketika respons terputus;
- pemulihan transaksi permintaan/Input Stok setelah refresh memakai ID lama, disimpan maksimum 24 jam,
  dan dipisahkan berdasarkan ID akun agar pengguna perangkat bersama tidak saling melihat transaksi;
- cache snapshot stok Google Sheets untuk mempercepat halaman stok dan combobox;
- deduplikasi pembacaan profil pada satu render server dengan React `cache()`.

Revisi ini juga menaikkan aplikasi ke Next.js 15.5.22, menambah header keamanan, memperketat validasi,
menutup open redirect, menetralkan formula injection, dan menyediakan laporan audit di
`WARES_AUDIT_REPORT.md`.

## Produk dan akses

- WARES tetap memakai login Supabase.
- Ada dua peran: karyawan dan admin.
- Tidak ada proses persetujuan, verifikasi jabatan, atau status workflow permintaan. Permintaan yang
  disimpan dianggap sudah disetujui dan hanya berfungsi sebagai pencatatan.
- Semua pengguna login boleh membuat permintaan.
- Hanya admin yang boleh mengedit permintaan yang sudah tersimpan.
- Hanya admin yang boleh menggunakan halaman **Input Stok**.
- Hanya admin yang boleh membuka dan mengubah **Master Data**.
- Setelah login atau pendaftaran berhasil, pengguna masuk ke **Beranda** (`/home`) dan memilih
  halaman kerja dari menu yang sesuai dengan perannya.

## Aturan permintaan barang

- Setiap item memiliki dua angka terpisah: **Jumlah Permintaan** dan **Jumlah Diberikan**.
- Admin maupun karyawan mengisi kedua angka ketika membuat permintaan.
- `0 <= jumlah diberikan <= jumlah permintaan`.
- Jumlah diberikan tidak boleh melebihi stok spreadsheet yang tersedia.
- Stok berkurang berdasarkan **Jumlah Diberikan**, bukan Jumlah Permintaan.
- **Nama Penyerah** mengikuti profil akun yang login dan bersifat read-only. Source terbaru
  menganggap akun tersebut sebagai petugas gudang.
- **Nama Penerima/PIC** diinput manual pada formulir dan wajib diisi.
- Di jurnal `KELUAR`, `EQUIPMENT` diisi dari lokasi pekerjaan dan `PIC` adalah nama penerima.
- Untuk kompatibilitas tanpa migrasi database, kolom Supabase legacy `nama_penyerah` saat ini
  menyimpan **nama penerima manual**. Pada detail/PDF, nama penyerah diambil dari profil pemilik
  permintaan dan nama penerima diambil dari kolom legacy tersebut.
- Ketika admin mengedit permintaan, stok dikoreksi sebesar selisih jumlah diberikan. Operasi harus
  idempoten agar retry tidak mengurangi stok dua kali.
- Saat respons Sheets tidak pasti, UI hanya memeriksa status secara berurutan. UI tidak boleh otomatis
  mengirim ulang POST/PATCH. Pengiriman ulang manual tetap memakai `requestId` dan `syncToken` lama.

## Google Sheets sebagai sumber stok utama

Spreadsheet dummy pengembangan terbaru:
https://docs.google.com/spreadsheets/d/14rUshtHE2lF9QM0SlCB4djMfuzlLt3XK7zhcBi5VxSY/edit

- Google Sheets adalah sumber utama stok; Supabase menyimpan akun, permintaan, item permintaan, dan
  riwayat aplikasi.
- Sheet `MASUK` adalah jurnal kronologis seluruh material masuk.
- Sheet `KELUAR` adalah jurnal kronologis seluruh material keluar.
- Informasi stok untuk semua pengguna berasal dari Google Sheets dan ditampilkan secara near-real-time
  melalui cache server, bukan pembacaan Apps Script baru pada setiap request.
- Snapshot server memakai `unstable_cache` dengan revalidasi 15 detik dan tag
  `wares-stock-snapshot`. Endpoint `/api/stock` mengirim cache browser privat 5 detik dengan
  `stale-while-revalidate=30`.
- Cache stok di-invalidasi setelah permintaan baru, edit permintaan, atau Input Stok berhasil
  dikonfirmasi. Halaman Informasi Stok menyegarkan data setiap 60 detik hanya ketika tab terlihat;
  form permintaan tidak melakukan polling stok terus-menerus ketika pengguna mengisi atau menyimpan.
- Combobox material berbagi cache browser dan request aktif selama 15 detik agar perpindahan field
  tidak membuat pembacaan Sheets berulang.
- Integrasi tulis harus dilakukan di server; secret Google Sheets tidak boleh dikirim ke browser.

## Master Data dan lokasi Rack

- Untuk pengalaman admin yang cepat, `public.master_items` di Supabase menjadi sumber utama Master
  Data ketika `MASTER_SOURCE=postgres`. Google Sheets tetap menerima mirror perubahan untuk formula
  dan laporan; Sheets tidak dibaca ulang pada setiap buka halaman.
- `MASTER_SOURCE` wajib dipilih secara eksplisit (`postgres` atau `sheets`). Mode Postgres hanya boleh
  dinyalakan setelah migrasi `2026-08-10-master-items-postgres.sql` dan `npm run backfill:master`
  selesai. Respons Postgres kosong sebelum backfill adalah kondisi konfigurasi, bukan “0 material”
  yang sah; UI harus menyembunyikan tombol tambah agar tidak terjadi duplikasi.
- Backfill memverifikasi ID deployment Apps Script terhadap spreadsheet FINAL, menolak source kosong,
  menyimpan `sheet_row`, dan aman diulang sebelum cutover berdasarkan `material_number`.
- Setiap perubahan Master Data pada mode Postgres menyimpan status mirror `pending/synced/failed`.
  Browser memeriksa status ini lewat Postgres selama beberapa detik tanpa memanggil ulang Apps Script,
  sehingga admin dapat membedakan “database berhasil”, “Sheets berhasil”, dan “Sheets gagal”.
- Sheet `MASTER DATA` memakai header pada baris 8. Website hanya boleh menulis kolom `A:H` serta
  `P` (`STATUS`); kolom `I:O` berisi formula/data turunan/catatan dan tidak boleh disentuh.
- Kolom yang dikelola admin: `NO.`, `KATEGORI`/`KATAGORI`, `MATERIAL NUMBER`, `RACK`,
  `KLASIFIKASI`, `AREA`, `NAMA BARANG`, `LOKASI`, dan `STATUS`.
- Nomor urut mengikuti posisi baris. Material baru memakai slot template kosong pertama; aplikasi
  tidak boleh menyisipkan, menghapus, atau mengurutkan baris fisik karena laporan bulanan merujuk
  langsung ke nomor baris Master Data.
- Penghapusan bersifat lunak: `STATUS=NONAKTIF`. Status kosong pada data lama dibaca sebagai
  `AKTIF`. Material nonaktif tidak muncul di stok maupun pilihan transaksi.
- `MATERIAL NUMBER` adalah identitas unik. Nama barang bukan key karena terdapat nama duplikat.
- Referensi Rack berasal dari tab `RACK GUDANG`: Rack berupa angka 1–50 dan Area berupa nama.
  Memilih Rack mengisi Area otomatis, tetapi admin boleh memilih Area lain dari daftar resmi.
- Audit workbook menemukan 454 label `RACK 1`–`RACK 50` yang dapat dinormalkan secara deterministik.
  Perubahan tersebut baru dianggap terpasang setelah admin mengimpor tab `RACK GUDANG`, men-deploy
  Apps Script terbaru, lalu menjalankan `migrateLegacyRackDataSafely()`. Data lokasi lama yang tidak dapat dipetakan tidak
  ditebak: Rack dibiarkan kosong dan label lama dipertahankan sebagai Area untuk dikoreksi admin.
  Delapan entri legacy `RACK 52` juga ditandai belum terpetakan karena daftar resmi hanya 1–50.

## Input Stok admin

- Variabel: tanggal, barang, Rack, Area, jumlah masuk, dan keterangan.
- Rack wajib dipilih dari daftar resmi. Area terisi otomatis dari Rack dan boleh diganti ke Area lain
  yang masih berasal dari daftar `RACK GUDANG`.
- Keterangan memakai dropdown dari nilai yang pernah muncul di `MASUK`.
- Dropdown memiliki pilihan **Lainnya** yang membuka input manual.
- Material yang belum ada pada laporan bulan berjalan boleh ditambahkan otomatis.
- Form selalu menjelaskan status transaksi: sedang mengirim, sedang memeriksa, berhasil, gagal
  definitif, atau belum dapat dipastikan.
- Jika respons penulisan terlambat, aplikasi memeriksa kolom ID transaksi di jurnal `MASUK` tanpa
  mengirim ulang penambahan stok. Pemeriksaan otomatis berjalan berurutan dan berhenti setelah batas
  waktu agar tidak menumpuk eksekusi.
- Jika status masih belum pasti, admin dapat memeriksa ulang atau mengirim ulang secara manual
  memakai ID transaksi yang sama. Isian dikunci supaya retry tetap idempoten dan tidak menggandakan
  stok.
- Refresh atau penutupan tab saat transaksi belum selesai akan memulihkan payload dan memeriksa ID
  lama terlebih dahulu. Transaksi baru tidak diizinkan sampai status transaksi lama diselesaikan.

## Laporan bulanan

- Struktur dan tampilan sheet baru mengikuti template tetap
  `Juli 2026 - DATA BASE LAPORAN HARIAN`.
- Sheet bulan baru dibuat pada tanggal 1 pukul 00.00 WIB. Sistem juga harus memiliki pemeriksaan
  fallback pada akses/transaksi pertama bulan tersebut apabila trigger terjadwal terlambat.
- Penamaan: `<Nama Bulan> <Tahun> - DATA BASE LAPORAN HARIAN`.
- Stok awal bulan baru berasal dari **Stok Akhir** bulan sebelumnya, bukan Stok Opname.
- Kolom mutasi harian langsung diperbarui dari jurnal `MASUK` (positif) dan `KELUAR` (negatif).
- Stok akhir mengikuti rumus stok awal + seluruh mutasi harian.
- Material baru ditambahkan otomatis ke laporan bulan berjalan dan dibawa ke bulan berikutnya.
- Zona waktu spreadsheet, trigger, dan timestamp adalah `Asia/Jakarta`.

## Batasan operasional

- Spreadsheet dummy baru tetap menjadi sumber pengembangan. Jangan beralih ke spreadsheet stok
  gudang nyata tanpa instruksi eksplisit dan pemeriksaan akses/backup.
- Setelah `google-apps-script/Code.gs` berubah, Apps Script harus disimpan sebagai versi deployment
  baru agar URL `/exec` menjalankan kode terbaru.
- Urutan rollout Master Data cepat: impor `RACK GUDANG.xlsx` sebagai tab `RACK GUDANG` pada workbook
  FINAL; deploy versi terbaru `google-apps-script/Code.gs`; jalankan
  `migrateLegacyRackDataSafely()`; lalu jalankan migrasi `2026-08-09-master-data-rack.sql` dan
  `2026-08-10-master-items-postgres.sql`; jalankan `npm run backfill:master`; pastikan jumlah material
  Postgres sesuai spreadsheet dan seluruh `sheet_row` terisi; baru set `MASTER_SOURCE=postgres` di
  Vercel dan redeploy. Sampai verifikasi selesai, gunakan `MASTER_SOURCE=sheets` sebagai pemulihan.
- Kredensial Google, Supabase service-role, atau token lain tidak boleh ditaruh di source control.
- Folder terpilih `wares-proto-main` tidak memiliki metadata `.git`. Working copy Git yang terhubung
  ke remote untuk revisi ini berada di `tmp/remote-main-check`.
- Untuk demonstrasi, hanya satu admin boleh mengedit permintaan yang sama pada satu waktu. Produksi
  memerlukan revision/CAS atau durable outbox agar edit serentak tidak membuat Sheets dan Supabase
  berbeda versi.
- Role Supabase `authenticated` saat ini masih dapat menulis request/RPC secara langsung. Sebelum
  produksi nyata, mutation harus dipindahkan ke server-only boundary, hak tulis client dicabut, dan
  rate limit ditambahkan. Detail risiko lain tercatat di `WARES_AUDIT_REPORT.md`.
