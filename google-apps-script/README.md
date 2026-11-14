# WARES Google Sheets API

API ini dijalankan sebagai **container-bound Apps Script** pada spreadsheet stok. Spreadsheet tetap menjadi sumber utama stok; Next.js hanya mengaksesnya dari server.

## Deploy

1. Buka spreadsheet dummy, pilih **Extensions → Apps Script**.
2. Impor `RACK GUDANG.xlsx` sebagai tab bernama persis `RACK GUDANG` dengan header `RACK` dan `AREA`.
3. Salin `Code.gs` dan `appsscript.json` ke project tersebut.
4. Di **Project Settings → Script Properties**, buat `WARES_API_SECRET` dengan nilai acak yang panjang (minimal 32 karakter).
   Bila daftar rack berada di spreadsheet terpisah, tambahkan `WARES_RACK_SPREADSHEET_ID`.
   Jika tab `RACK GUDANG` (header `RACK`, `AREA`) ada di workbook utama, properti ini tidak diperlukan.
5. Jalankan `migrateLegacyRackDataSafely()` satu kali untuk menormalkan hanya label Rack yang deterministik.
6. Jalankan `installMonthlyTrigger()` satu kali dan izinkan akses. Trigger mencoba membuat sheet bulan baru pada tanggal 1 pukul 00.00 zona `Asia/Jakarta`; setiap request API juga menjalankan pemeriksaan fallback bila trigger Google terlambat.
7. Pilih **Deploy → New deployment → Web app**. Jalankan sebagai pemilik spreadsheet. Untuk pola secret-auth ini, pilih akses **Anyone** agar server Vercel dapat memanggil endpoint tanpa sesi browser Google. Jika kebijakan Workspace melarang opsi tersebut, gunakan deployment/service account internal sebagai pengganti sebelum produksi.
8. Simpan URL deployment `/exec` sebagai `GOOGLE_SHEETS_API_URL` dan secret yang sama sebagai `GOOGLE_SHEETS_API_SECRET` di environment Vercel.

Setelah mengubah Apps Script, buat versi deployment baru. Jangan menaruh secret di variable `NEXT_PUBLIC_*`.

## Kontrak API

Semua request server memakai `POST` JSON:

```json
{ "secret": "…", "action": "stock.get", "payload": {} }
```

Action tersedia: `health`, `stock.get`, `metadata.get`, `rack.get`, `master.list`,
`master.create`, `master.update`, `master.deactivate`, `master.migrate-racks`,
`incoming.record`, `incoming.status`, `outgoing.record`, `outgoing.replace`,
`outgoing.status`, dan `month.ensure`. `outgoing.replace`
idempoten berdasarkan pasangan `requestId` + `syncToken`; transaksi permintaan selalu memiliki
minimal satu baris barang.

`incoming.status` adalah pemeriksaan read-only berdasarkan `transactionId`. Action ini sengaja tidak
mengambil global lock agar Next.js dapat memastikan apakah baris `MASUK` sudah tercatat setelah
respons `incoming.record` terlambat. Pemeriksaan status tidak menulis atau mengirim ulang transaksi.

`outgoing.status` juga read-only dan tidak memakai global lock. Status baru `found: true` setelah
seluruh baris versi transaksi dengan `syncToken` yang sama sudah tertulis. Dengan begitu, timeout
HTTP tidak memicu rollback atau pengiriman ulang otomatis. Endpoint `GET /exec` hanya menampilkan
health check publik tanpa menerima secret melalui query string; seluruh action data tetap memakai
`POST` dan secret pada JSON body.

Action `health` melalui `POST` mengembalikan `spreadsheetId`, `spreadsheetName`,
`apiVersion`, sumber/kelengkapan 50 Rack, serta kesiapan tab `MASTER DATA`. Skrip
`npm run backfill:master` memeriksa nilai ini sebelum menulis ke Postgres, sehingga
URL deployment milik workbook lama tidak dapat tercampur tanpa sengaja. Setelah
memperbarui `Code.gs`, selalu pilih **Deploy → Manage deployments → Edit → New
version → Deploy**; sekadar menyimpan kode tidak mengubah versi `/exec` yang aktif.

Kolom tampak pada `MASUK`/`KELUAR` tidak diubah. API menambahkan kolom teknis tersembunyi untuk ID transaksi, kode material, jumlah permintaan, dan timestamp. Jangan menghapus kolom-kolom `_WARES_*` tersebut.

CRUD `MASTER DATA` hanya menulis kolom `A:H` dan `P` (`STATUS`). Kolom rumus/catatan
`I:O` tidak pernah ditulis. Material baru memakai slot kosong pertama yang telah tersedia;
script tidak menyisipkan, menghapus, atau mengurutkan baris fisik. `master.deactivate`
menulis `NONAKTIF` (bukan menghapus baris), sedangkan STATUS kosong dibaca sebagai `AKTIF`.

Utility `migrateLegacyRackDataSafely()`/action `master.migrate-racks` hanya menormalkan
label deterministik `RACK 1` sampai `RACK 50` dan mengisi AREA dari tab referensi.
Nilai legacy lain, termasuk Rack 52, dibiarkan untuk diperiksa admin.

Sheet bulanan mengikuti template tetap `Juli 2026 - DATA BASE LAPORAN HARIAN`. Saat bulan berganti, stok awal berasal dari `Stok Akhir` bulan sebelumnya; material tambahan dari bulan sebelumnya digabungkan ke template. Mutasi masuk ditulis positif dan mutasi keluar negatif pada tanggal terkait.
