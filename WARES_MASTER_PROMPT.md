# MASTER PROMPT — WARES (Warehouse Request System)

> **Catatan revisi:** dokumen ini menyimpan spesifikasi prototype awal. Untuk pekerjaan lanjutan,
> keputusan di [`WARES_PROJECT_MEMORY.md`](WARES_PROJECT_MEMORY.md) dan implementasi aktual memiliki
> prioritas. Khususnya, Google Sheets kini menjadi sumber stok dan tidak ada workflow status.

> **Cara pakai:** paste seluruh isi file ini ke Claude Code sebagai instruksi awal, di dalam folder project yang sudah berisi aset (lihat bagian 3). Ikuti build **fase demi fase** — jangan lompat fase. Target akhir fase ini: **prototype jalan di `localhost:3000`**, belum publish ke Vercel.

---

## 0. PERAN & ATURAN MAIN

Kamu adalah senior full-stack engineer. Bangun aplikasi web internal **WARES — Warehouse Request System** untuk **Departemen Pergudangan & Pengantongan, Petrokimia Gresik**. Ini digitalisasi dokumen **"Surat Pengambilan Barang"** (requisition barang gudang). Ini **bukan** e-commerce: tidak ada harga/pembayaran.

Aturan wajib:
- Bahasa UI: **Indonesia**. Komentar kode boleh Inggris.
- Bangun **bertahap** (Fase 1 → 6). Setelah tiap fase, pastikan `npm run dev` tetap jalan tanpa error sebelum lanjut.
- **Jangan** deploy ke Vercel di fase ini. Target: prototype di localhost.
- **Jangan** menghapus/menimpa aset asli di root. Salin ke `/public`.
- Kalau ada langkah manual yang harus dikerjakan manusia (mis. bikin project Supabase), **cetak instruksi jelas** untuk user, jangan diam.
- Setiap kredensial masuk lewat `.env.local` — **jangan** hardcode key di kode.

---

## 1. RINGKASAN PRODUK

Alur inti:
1. Karyawan **login** (username + password).
2. Isi **form requisition**: pilih jenis pekerjaan (multi-kategori) → isi Pekerjaan & Lokasi → tambah barang (dari katalog) tanpa batas.
3. **Preview** di layar → **konfirmasi** → data tersimpan ke Supabase (dengan timestamp).
4. **Generate & download PDF** yang meniru format Surat Pengambilan Barang, untuk diprint & ditandatangani basah (offline).
5. User bisa melihat **Riwayat** requisition miliknya; hanya **admin** yang boleh mengedit permintaan.
6. **Admin** punya **Dashboard** analitik dan halaman **Input Stok**.

Aturan terbaru: **Permintaan** dan **Diberikan** adalah dua nilai berbeda. Diberikan tidak boleh melebihi
Permintaan maupun stok real-time Google Sheets. Stok berkurang berdasarkan jumlah Diberikan. Google
Sheets adalah sumber utama stok; lihat `WARES_PROJECT_MEMORY.md` untuk keputusan produk terbaru.

---

## 2. TECH STACK (WAJIB)

- **Next.js 14+ (App Router) + TypeScript**
- **Tailwind CSS + shadcn/ui** (komponen bersih, formal minimalis)
- **Supabase** (Auth + Postgres + RLS) — free tier
- **@supabase/supabase-js** (client) & **@supabase/ssr** (session di App Router)
- **@react-pdf/renderer** untuk PDF (client-side: preview pakai `PDFViewer`, download pakai `PDFDownloadLink`)
- **recharts** untuk chart dashboard
- **react-hook-form + zod** untuk form & validasi
- Font: **Plus Jakarta Sans** via `next/font/google`

---

## 3. FOLDER & ASET

Folder project sudah berisi file berikut di root (nama apa adanya, ada spasi/kurung):
- `Area-Pabrik-1A-Petrokimia-Gresik.jpeg` → **background halaman login**
- `Desain tanpa judul (54).png` → **logo Petrokimia Gresik** (banteng hijau-emas)
- `Desain tanpa judul (55).png` → **logo Departemen Pergudangan & Pengantongan** (wordmark hitam + ikon gudang)
- `FORM PENGAMBILAN BARANG 2026.pdf` → **referensi visual layout PDF** (buka & tiru layout-nya untuk komponen PDF)
- `DESNO.xlsx` → sumber asli katalog (**abaikan untuk seeding**, sudah diekstrak ke `catalog.json`)
- `catalog.json` → **1.271 item katalog bersih** (dipakai untuk seed). Field: `id, nama_barang, kategori, lokasi, satuan, stok`.

**Langkah pertama:** buat folder `/public/brand/` lalu **salin & rename**:
- `Desain tanpa judul (54).png` → `/public/brand/logo-petrokimia.png`
- `Desain tanpa judul (55).png` → `/public/brand/logo-departemen.png`
- `Area-Pabrik-1A-Petrokimia-Gresik.jpeg` → `/public/brand/bg-pabrik.jpg`

Pindahkan `catalog.json` ke `/scripts/catalog.json`.

---

## 4. DESIGN SYSTEM (formal BUMN, modern-minimalis, light mode saja)

**Warna** (diambil langsung dari logo Petrokimia):
| Token | Hex | Pemakaian |
|---|---|---|
| `brand` (hijau) | `#00A547` | warna utama, tombol primer, header aktif, link |
| `brand-dark` | `#00813A` | hover tombol primer |
| `brand-light` | `#E7F6EE` | background lembut, badge, highlight baris |
| `gold` (emas) | `#FBC800` | aksen sekunder, highlight kecil, ikon status |
| `ink` | `#1A1A1A` | teks utama |
| `muted` | `#6B7280` | teks sekunder |
| `surface` | `#FFFFFF` | kartu/permukaan |
| `bg` | `#F6F7F9` | latar halaman |
| `border` | `#E5E7EB` | garis, pemisah |

Set token ini di `tailwind.config.ts` (extend colors) dan sebagai CSS variables. **Tombol primer selalu hijau**, bukan kuning. Emas hanya aksen tipis.

**Prinsip visual:** banyak ruang putih, sudut membulat lembut (`rounded-xl`), bayangan halus, garis tipis, tabel rapi. Kepadatan **nyaman-lega** (padding cukup, bukan padat). Tidak ada gradient norak, tidak ada dark mode.

**Tipografi:** Plus Jakarta Sans. Heading `font-semibold`/`font-bold`, body `font-normal`. Skala jelas (mis. h1 28–32px, h2 20–24px, body 14–16px).

**Layout aplikasi:** **top bar saja** (tanpa sidebar).
- Kiri: wordmark **WARES** (teks; "WA" bisa diberi aksen hijau) + subteks kecil "Warehouse Request System". Boleh dampingkan logo Petrokimia kecil.
- Tengah/kanan: nav — **Buat Permintaan**, **Riwayat Saya**, dan **Dashboard** (hanya tampil untuk admin).
- Paling kanan: nama user + tombol **Keluar**.
- Konten: kartu putih di atas latar `bg`.

---

## 5. SUPABASE — SETUP (Fase 1)

Karena user **belum punya** project Supabase, lakukan ini dan **cetak instruksi manual** untuk user:

**Instruksi manual untuk user (cetak ke terminal/README):**
1. Buka https://supabase.com → New Project. Catat **Project URL**, **anon key**, **service_role key**.
2. Di **Authentication → Providers → Email**: **matikan "Confirm email"** (karena kita pakai email sintetis internal).
3. Buka **SQL Editor**, paste & jalankan file `supabase/schema.sql` (kamu yang generate, di bawah).
4. Isi `.env.local` (kamu generate `.env.local.example`).
5. Jalankan `npm run seed` untuk mengisi katalog + akun admin.

Buat `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# kredensial admin awal (dipakai script seed)
ADMIN_USERNAME=PGADMIN
# Wajib unik, minimal 12 karakter; jangan simpan password asli di Git.
ADMIN_PASSWORD=
ADMIN_NAMA=Administrator WARES
ADMIN_EMAIL=admin@petrokimia.co.id
```

### 5.1 Skema database — generate `supabase/schema.sql`

```sql
-- ========== PROFILES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama_lengkap text not null,
  no_hp text,
  email_kerja text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_prefix check (username like 'PG%')
);

-- ========== CATALOG ==========
create table public.catalog_items (
  id bigint primary key,
  nama_barang text not null,
  kategori text not null,
  lokasi text not null,
  satuan text not null,
  stok integer not null default 100,
  created_at timestamptz not null default now()
);
create index on public.catalog_items (kategori);
create index on public.catalog_items (nama_barang);

-- ========== REQUESTS (header surat) ==========
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pekerjaan text not null,
  lokasi_pekerjaan text not null,            -- lokasi PEKERJAAN (beda dari lokasi gudang item)
  nama_penyerah text not null,
  kategori text[] not null default '{}',     -- multi-select jenis pekerjaan (checkbox)
  status text not null default 'submitted',  -- legacy internal; tidak ditampilkan sebagai workflow
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.requests (user_id);

-- ========== REQUEST ITEMS (baris barang) ==========
create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  catalog_item_id bigint references public.catalog_items(id),
  kode_barang text,
  nama_barang text not null,
  kategori_barang text not null default '',
  lokasi_barang text not null default '',
  satuan text not null,
  jumlah_permintaan integer not null check (jumlah_permintaan > 0),
  jumlah_diberikan integer not null check (
    jumlah_diberikan >= 0 and jumlah_diberikan <= jumlah_permintaan
  ),
  urutan integer not null default 0
);
create index on public.request_items (request_id);

-- ========== updated_at trigger ==========
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger trg_requests_updated before update on public.requests
  for each row execute function public.touch_updated_at();

-- ========== RLS ==========
alter table public.profiles enable row level security;
alter table public.catalog_items enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;

-- helper: apakah current user admin
create or replace function public.is_admin() returns boolean as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$ language sql stable security definer;

-- profiles
create policy "profil sendiri: baca" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil sendiri: update" on public.profiles for update using (id = auth.uid());
create policy "profil: insert saat signup" on public.profiles for insert with check (id = auth.uid());

-- catalog: semua user login boleh baca; tulis hanya admin
create policy "katalog: baca" on public.catalog_items for select using (auth.role() = 'authenticated');
create policy "katalog: tulis admin" on public.catalog_items for all using (public.is_admin()) with check (public.is_admin());

-- requests: user CRUD miliknya; admin baca semua
create policy "request: baca sendiri/admin" on public.requests for select using (user_id = auth.uid() or public.is_admin());
create policy "request: insert sendiri" on public.requests for insert with check (user_id = auth.uid());
create policy "request: update sendiri" on public.requests for update using (user_id = auth.uid());
create policy "request: delete sendiri" on public.requests for delete using (user_id = auth.uid());

-- request_items: ikut kepemilikan request induk
create policy "item: baca" on public.request_items for select using (
  exists(select 1 from public.requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())));
create policy "item: tulis" on public.request_items for all using (
  exists(select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid()))
  with check (
  exists(select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid()));
```

### 5.2 Seed — generate `scripts/seed.ts` (dijalankan via `npm run seed`, pakai service_role)

Fungsi seed:
1. Baca `scripts/catalog.json`, upsert seluruh 1.271 item ke `catalog_items`.
2. Buat akun admin: `supabase.auth.admin.createUser` dengan email sintetis `${ADMIN_USERNAME.toLowerCase()}@wares.local`, password `ADMIN_PASSWORD`, `email_confirm: true`. Lalu insert row `profiles` dengan `is_admin = true`, `username = ADMIN_USERNAME`, dst.
3. Idempoten: aman dijalankan berulang (cek eksistensi dulu).

Tambahkan script di `package.json`: `"seed": "tsx scripts/seed.ts"`.

---

## 6. AUTH — username + password via email sintetis (Fase 2)

Supabase Auth berbasis email. Kita sembunyikan itu dari user:
- **Mapping:** `email = username.toLowerCase() + "@wares.local"`. User hanya pernah mengetik **username + password**.
- **Sign-up** (`/signup`): field **username, nama lengkap, no hp, email kerja, password, konfirmasi password**.
  - Validasi (zod): username **wajib diawali "PG"** (regex `^PG.+`), password min 6, email kerja format email, semua wajib kecuali no hp opsional.
  - Proses: `supabase.auth.signUp({ email: synthetic, password })` → lalu insert row `profiles` (id = user.id, username, nama_lengkap, no_hp, email_kerja, is_admin=false).
  - Karena "Confirm email" dimatikan, user langsung bisa login.
- **Login** (`/login`): field **username + password** → konversi ke email sintetis → `signInWithPassword`.
- **Session:** pakai `@supabase/ssr` (middleware + server client) supaya RLS & guard jalan di App Router.
- **Route guard:**
  - Belum login → redirect ke `/login`.
  - Halaman `/dashboard` → hanya `is_admin`; kalau bukan admin, redirect ke `/buat-permintaan` dengan pesan.
- Sediakan tombol **Keluar** (signOut).

**Halaman Login (desain):**
- Kartu di tengah, `max-w-md`, di atas **background `bg-pabrik.jpg`** yang diberi **overlay putih semi-transparan** (mis. `bg-white/70` atau gradient putih) supaya tetap terang & terbaca — **bukan overlay gelap**.
- Di dalam kartu, atas: **dua logo berdampingan** (`logo-petrokimia.png` + `logo-departemen.png`) dengan tinggi seragam.
- Heading "Selamat Datang", subteks "Masuk dengan username & password".
- Field username, password; tombol **"Masuk" hijau** full-width.
- Link kecil ke halaman sign-up. **Tanpa** tombol OneKey/SSO.

---

## 7. FORM REQUISITION — `/buat-permintaan` (Fase 3)

Komponen inti aplikasi. Tata letak dalam kartu:

1. **Jenis Pekerjaan (multi-select, WAJIB)** — checkbox/badge 10 kategori:
   `BAGGING MACHINE, LAS FABRIKASI, LISTRIK, MEKANIK, MESIN BAGCODING, MESIN JAHIT, ROBOTIC, SIPIL, TOOLS, UMUM`.
   Kategori yang dicentang berfungsi sebagai **FILTER**: dropdown barang hanya menampilkan item yang `kategori`-nya termasuk yang dicentang. (Kalau belum ada yang dicentang, dropdown barang disabled dengan hint "Pilih jenis pekerjaan dulu".)
2. **Pekerjaan** (text, wajib) dan **Lokasi** (text, wajib) — **dua field terpisah**.
3. **Daftar Barang** — tabel dinamis (react-hook-form `useFieldArray`), **tanpa batas jumlah baris**. Tiap baris:
   - **Nama Barang**: combobox **searchable** dari `catalog_items` (difilter kategori terpilih). Katalog 1.271 item — pakai search yang enteng (server-side query `ilike` dengan limit, atau client-side dengan virtualisasi).
   - **Satuan**: **terisi otomatis** dari item yang dipilih (read-only).
   - **Stok tersedia**: angka real-time dari Google Sheets.
   - **Jumlah Permintaan**: number > 0.
   - **Jumlah Diberikan**: number >= 0, tidak boleh melebihi Permintaan atau stok tersedia.
   - Tombol hapus baris. Tombol **"+ Tambah Barang"**.
4. **Nama Penyerah** (text, wajib). Nama penerima/PIC berasal dari profil user yang login.
5. Tombol **"Preview"** (validasi dulu; kalau invalid, tandai error).

Saat simpan, jurnal `KELUAR` dan laporan bulan berjalan diperbarui berdasarkan jumlah Diberikan.

---

## 8. PREVIEW + PDF — (Fase 4)

**Preview (`/buat-permintaan` step 2 atau modal):**
- Tampilkan ringkasan mirip hasil PDF (header, pekerjaan, lokasi, kategori tercentang, tabel barang).
- Checkbox konfirmasi: **"Saya sudah memeriksa data ini benar."** (harus dicentang untuk lanjut).
- Tombol **"Konfirmasi & Simpan"** → insert `requests` + `request_items` (timestamp otomatis) → arahkan ke halaman sukses/riwayat, tampilkan tombol **Download PDF** + preview PDF (`<PDFViewer>`).
- **Tidak ada cooldown.**

**Komponen PDF (`@react-pdf/renderer`)** — tiru layout `FORM PENGAMBILAN BARANG 2026.pdf` (buka file itu sebagai acuan):
- **Header kiri:** logo Petrokimia + teks "Dept. Pergudangan & Pengantongan".
- **Header kanan:** blok "Kepada: AVP Pengelolaan & Pemeliharaan Gudang / Inbound & Outbound / di Tempat".
- **Judul tengah:** "SURAT PENGAMBILAN BARANG" + subjudul "PEMELIHARAAN PERGUDANGAN".
- Baris "Untuk Pekerjaan & Lokasi: {pekerjaan} — {lokasi}".
- **Baris checkbox 10 kategori**; centang yang dipilih user (kotak diisi/di-tick).
- **Tabel** kolom: `NO | NAMA BARANG | SATUAN | JUMLAH(PERMINTAAN | DIBERIKAN)`.
  - **Dinamis & multi-halaman**: kalau baris banyak, tabel lanjut ke halaman berikutnya dengan **header tabel berulang**. Gunakan `wrap`.
  - Kolom PERMINTAAN dan DIBERIKAN memakai nilainya masing-masing.
- Teks penutup: "Demikian atas bantuan dan kerja samanya yang baik disampaikan terima kasih."
- "Gresik, {tanggal hari ini}".
- Dua blok tanda tangan: **"Yang menyerahkan,"** (cetak nama penyerah dari form) dan **"Yang menerima,"** (cetak **nama lengkap** user di bawah garis).
- **Tanpa nomor surat.** Semua tanda tangan offline.
- Nama file download: `SPB-{username}-{YYYYMMDD-HHmm}.pdf`.

---

## 9. RIWAYAT — `/riwayat` (Fase 5)

- Tabel daftar requisition **milik user** (admin: semua), tanpa workflow status.
- Karyawan hanya memiliki aksi **Lihat**. Admin memiliki aksi **Lihat** dan **Edit** untuk semua permintaan.
- **Edit** (`/riwayat/[id]/edit`) hanya admin. Perubahan jumlah Diberikan mengoreksi jurnal `KELUAR`
  dan stok sebesar delta secara idempoten.

---

## 10. DASHBOARD ADMIN — `/dashboard` (Fase 6, admin-only)

Sumber data: agregasi `request_items` join `requests` (barang **keluar** = jumlah Diberikan). Komponen:
- **Filter bar:** rentang tanggal, filter kategori, filter lokasi.
- **KPI cards:** total item keluar (sum jumlah), jumlah surat, jumlah user aktif.
- **Chart (recharts):**
  - Bar: **Top-10 barang** paling banyak keluar (by sum jumlah).
  - Line/Bar: **tren barang keluar per waktu** (harian/bulanan).
  - Donut/Bar: **breakdown per kategori**.
  - Bar: **breakdown per lokasi**.
- Tabel ringkas transaksi terbaru + tombol **Export CSV** (opsional).
- Guard: non-admin tidak bisa akses (redirect).

---

## 11. RENCANA BUILD BERTAHAP (jangan lompat)

- **Fase 1 — Fondasi:** init Next.js+TS+Tailwind+shadcn, design tokens, font, salin aset, layout top bar (statik), `schema.sql`, `seed.ts`, `.env.local.example`. Cetak instruksi setup Supabase. ➜ `npm run dev` tampil landing/login kosong tanpa error.
- **Fase 2 — Auth:** signup, login, session (@supabase/ssr), guard, logout. ➜ bisa daftar & login.
- **Fase 3 — Form requisition:** kategori-filter, item combobox, satuan autofill, tabel dinamis.
- **Fase 4 — Preview + PDF + simpan.**
- **Fase 5 — Riwayat + edit.**
- **Fase 6 — Dashboard admin.**

Setelah tiap fase: pastikan build bersih, lalu ringkas apa yang selesai.

---

## 12. MENJALANKAN DI LOCALHOST (target akhir)

Cetak README dengan langkah:
```
1. npm install
2. buat project Supabase, isi .env.local (lihat .env.local.example)
3. matikan "Confirm email" di Supabase Auth
4. jalankan supabase/schema.sql di SQL Editor
5. npm run seed        # isi katalog + akun admin (PGADMIN)
6. npm run dev         # buka http://localhost:3000
```
Login admin awal: username `PGADMIN`, password dari `.env.local`.

---

## 13. ACCEPTANCE CRITERIA

- [ ] `npm run dev` jalan tanpa error, buka di `localhost:3000`.
- [ ] Bisa **sign-up** (username harus diawali "PG") & **login** dengan username+password.
- [ ] Non-admin **tidak** bisa buka `/dashboard`.
- [ ] Form: centang kategori **memfilter** dropdown barang; pilih barang **mengisi satuan otomatis**; bisa tambah baris **tanpa batas**.
- [ ] Preview → konfirmasi → data masuk Supabase (cek tabel `requests` & `request_items`).
- [ ] **PDF** menampilkan jumlah Permintaan dan Diberikan terpisah, nama penyerah dan penerima, tanpa nomor surat.
- [ ] **Riwayat** karyawan read-only; admin dapat mengedit seluruh permintaan.
- [ ] Stok real-time berasal dari Google Sheets; simpan/edit permintaan memperbarui `KELUAR` dan laporan bulanan.
- [ ] **Input Stok** hanya admin dan memperbarui `MASUK` serta laporan bulanan.
- [ ] **Dashboard** admin menampilkan KPI + chart barang keluar.
- [ ] Warna hijau `#00A547` sebagai primer, emas `#FBC800` aksen; light mode; top bar; tampilan formal-minimalis.

---

## 14. JANGAN

- Jangan hardcode kredensial Supabase.
- Jangan pakai LaTeX/headless-chrome untuk PDF (cukup @react-pdf/renderer).
- Jangan tambah dark mode / warna di luar palet.
- Jangan hardcode secret Google Sheets/Apps Script di browser atau source control.
- Jangan parsing `DESNO.xlsx` untuk seed — pakai `catalog.json`.

**Mulai dari Fase 1 sekarang.**
