# Migrasi Sumber Stok: Google Sheets → Postgres (opsi B)

Tujuan: menghilangkan lambatnya baca/tulis stok yang bergantung pada Google Apps
Script (single-thread lock, cold start 1–3 dtk/panggilan). Stok berjalan pindah ke
jurnal Postgres yang kilat; **Google Sheets tetap dipakai sebagai mirror** untuk
kenyamanan admin dan laporan bulanan.

Perubahan ini **di belakang feature-flag `STOCK_SOURCE`** dan **default `sheets`**,
jadi merge/deploy PR ini TIDAK mengubah perilaku produksi sampai Anda menyalakannya.

## Arsitektur

- `supabase/migrations/2026-08-03-stock-ledger.sql` — jurnal `stock_ledger`
  (append-only, baris MASUK & KELUAR), view `stock_current` (stok = Σmasuk − Σkeluar),
  fungsi `stock_snapshot()` (bentuk sama dengan snapshot Sheets), `record_stock_incoming()`
  (Input Stok, idempoten, admin), dan **trigger** yang menyinkronkan baris KELUAR dari
  `request_items` otomatis — **RPC permintaan yang ada tidak diubah**.
- `STOCK_SOURCE=postgres` → `/api/stock`, `/api/stock/keterangan`, dan Input Stok
  membaca/menulis dari Postgres. Input Stok mem-mirror ke Sheets di latar (`after()`).
- `STOCK_SOURCE=sheets` (default) → perilaku lama persis, tak tersentuh.

Cakupan (mode `postgres`): **semua pembacaan stok** (info stok, form, combobox),
**Input Stok**, dan **penyimpanan/edit permintaan** kini Postgres-primary — Sheets
di-mirror di latar (`after()`) untuk laporan bulanan. Alur sync-token Sheets-primary
tetap ada dan dipakai saat mode `sheets`.

## Urutan menyalakan (saat siap, transaksi dihentikan sementara)

1. **Jalankan** seluruh `supabase/migrations/2026-08-03-stock-ledger.sql` di
   Supabase → SQL Editor, lalu jalankan migrasi lanjutan
   `2026-08-04-penyerah-penerima.sql` dan `2026-08-09-master-data-rack.sql`.
   Semuanya aman diulang. Migrasi 9 Agustus menambahkan metadata Rack/Area ke
   ledger, snapshot, dan RPC Input Stok.
2. **Backfill saldo awal** dari stok Sheets saat ini:
   ```bash
   npm run backfill:stock
   ```
   (butuh `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GOOGLE_SHEETS_API_URL`, `GOOGLE_SHEETS_API_SECRET` di `.env.local`). Skrip ini
   mengosongkan `stock_ledger` lalu menulis satu baris saldo awal per barang.
3. **Set env** `STOCK_SOURCE=postgres` di Vercel (Production) lalu redeploy.
4. **Uji** di dummy: buka /stok (harus instan), Input Stok satu kali (cek angka naik),
   buat permintaan (cek angka turun sesuai jumlah diberikan).

## Rollback

Set `STOCK_SOURCE=sheets` (atau hapus env) → redeploy. Kembali ke Sheets seketika.
Data jurnal Postgres tetap aman untuk dicoba lagi.

## Batasan yang diketahui (opsi B fase ini)

- Saldo awal = stok bersih Sheets saat backfill. **Mengedit permintaan LAMA** (dibuat
  sebelum backfill) sesudah pindah bisa mengurangi stok dobel karena efeknya sudah
  termasuk di saldo awal. Untuk data REAL nanti, lakukan cutover saat sepi + backfill
  ulang, atau replay penuh riwayat.
- Mirror Sheets bersifat best-effort (`after()`); kalau Sheets down saat Input Stok,
  jurnal Postgres tetap benar tapi baris Sheets bisa terlewat (laporan bulanan perlu
  rekonsiliasi manual). Sumber kebenaran stok = Postgres.
