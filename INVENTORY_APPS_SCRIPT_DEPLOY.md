# Deploy modul Inventory (WARES v2) via Apps Script

Modul inventory (Dashboard status, Detail SKU, Proyeksi stok) membaca **hasil model**
dari workbook *WARES Reliability x Inventory Management* lewat Apps Script —
**read-only**, website hanya mencerminkan angka yang dihitung rumus Excel.

Selama langkah di bawah belum dilakukan, website otomatis memakai **fixture lokal**
(angka nyata hasil ekstraksi Excel, sudah diverifikasi identik dengan output Apps
Script). Badge **"Sumber"** di tiap halaman menandai mana yang sedang dipakai.

---

## Keputusan sebelum mulai

Apps Script membaca sheet dari **spreadsheet tempat skrip itu terpasang**. Pilih salah satu:

- **Opsi A (disarankan, paling sederhana):** taruh ke-5 sheet model di **spreadsheet
  WARES yang sama** dengan SPB/stok/KPI. Satu Web App URL melayani semuanya → cukup
  pakai `GOOGLE_SHEETS_API_URL` yang sudah ada.
- **Opsi B:** biarkan workbook reliability jadi spreadsheet terpisah dengan Web App
  sendiri. Kalau ini yang dipilih, **beri tahu saya** — perlu env khusus
  `INVENTORY_SHEETS_API_URL` + `INVENTORY_SHEETS_API_SECRET` (belum dibuat).

Langkah di bawah untuk **Opsi A**.

---

## Langkah

1. **Siapkan sheet model** di spreadsheet target. Nama sheet **harus persis** (perhatikan spasi):
   - `DASHBOARD`
   - `RM_HASIL`
   - `DATA_DEMAND (RM)`
   - `OP_STOK`
   - `DATA_SKU TERPAKAI`

   Pertahankan tata letak & rumusnya. Parser mencari **header berdasarkan teksnya**,
   jadi jangan mengubah tulisan header kunci (lihat "Kontrak header" di bawah).

2. **Pasang Code.gs terbaru.** Di spreadsheet itu: **Extensions → Apps Script**, lalu
   ganti isi `Code.gs` dengan `google-apps-script/Code.gs` dari repo (sudah memuat
   action `inv.*`). **Deploy ulang** Web App (Deploy → Manage deployments → edit →
   New version), atau buat deployment baru (Web app, *Execute as me*, *Who has access: Anyone*).

3. **Script Property** `WARES_API_SECRET` harus terisi (secret yang sama dipakai website).

4. **Env di Vercel (Production):**
   - `GOOGLE_SHEETS_API_URL` = URL Web App di atas
   - `GOOGLE_SHEETS_API_SECRET` = secret yang sama
   - `INVENTORY_SOURCE=sheets`  ← saklar yang mengalihkan website dari fixture ke Sheets

5. **Verifikasi** (salah satu):
   - Buka `/dashboard` — badge "Sumber" berubah jadi **Google Sheets** dan angka tetap
     99/2/24/73 (atau angka terbaru dari sheet).
   - Atau panggil Web App:
     ```bash
     curl -s -X POST "<WEB_APP_URL>" -H "Content-Type: application/json" \
       -d '{"secret":"<SECRET>","action":"inv.dashboard","payload":{}}'
     ```
     Harus mengembalikan `{"ok":true,"data":{"ringkasan":{...},"perMesin":[...],"items":[...]}}`.

---

## Action yang ditambahkan

| Action | Sumber sheet | Mengembalikan |
|---|---|---|
| `inv.dashboard` | DASHBOARD | `{ ringkasan, perMesin, items }` |
| `inv.rmhasil` | RM_HASIL | `{ items }` |
| `inv.proyeksi` | OP_STOK | `{ reviewDates, nilaiStok, jumlahKurang, series }` |
| `inv.demand` | DATA_DEMAND (RM) | `{ minggu, items }` |
| `inv.pola` | DATA_SKU TERPAKAI | `{ items }` |

Semua read-only, tanpa `withLock_`, timeout 15 dtk di sisi website.

---

## Kontrak header (jangan diubah tulisannya)

- **DASHBOARD** — tabel SKU: `No.`, `Mesin`, `Sparepart`, `ECR`, `Satuan`,
  `Lead time L (hari)`, `Kebutuhan PM jendela L+R`, `Kuantil RM jendela L+R`,
  `Target S`, `Stok fisik`, `Pesanan dalam perjalanan`, `Posisi persediaan`,
  `Kebutuhan selama L (PM + RM)`, `Status`, `Jumlah pesan (unit)`, `Perkiraan tiba`,
  `Tindak lanjut`. Ringkasan: baris ber-header `Total SKU`/`Kritis`/`Pesan sekarang`/
  `Cukup`/`% Cukup`/`Nilai pesanan (Rp)` (nilai di baris bawahnya). Panel kiri:
  label `Tanggal acuan (review)`, `Periode review R (hari)`, `Service level`.
  Per-mesin: baris ber-header `Mesin`/`Kritis`/`Pesan sekarang`/`Cukup`/`Total`,
  berakhir pada baris `TOTAL`.
- **RM_HASIL** — header di baris 1: `No`, `Kategori`, `Kriteria`, `Nama Barang`,
  `Lead Time (hari)`, `Service Level`, `Total Keluar (35 mgg)`, `Rata-rata / minggu`,
  `Std Dev / minggu`, `Demand selama LT (mu)`, `Std Dev selama LT (sigma)`, `z`,
  `STOK HOLD (ROP) REKOMENDASI`, `SAFETY STOCK (SS) REKOMENDASI`, `Dasar`.
- **DATA_DEMAND (RM)** — baris ber-sel memuat `KEY`; kolom minggu = angka 1..N di kanannya.
- **OP_STOK** — baris `Tanggal review`, `Nilai stok positif (Rp)`,
  `Jumlah SKU kekurangan`; blok per-SKU ber-header `No`/`Bagian`/`Nama sparepart`
  dengan tanggal review di kolom-kolom berikutnya. (Horizon dibatasi 53 review pertama.)
- **DATA_SKU TERPAKAI** — header baris 1: `NAMA BARANG`, `BAGIAN`, `TYPE BARANG`,
  `ADI`, `CV^2`, `Pola Demand`.

> Perubahan tulisan header akan membuat parser gagal menemukan kolom. Regresi dijaga
> oleh `src/lib/inventory/apps-script-inv.test.ts` (menjalankan `Code.gs` di `node:vm`).
