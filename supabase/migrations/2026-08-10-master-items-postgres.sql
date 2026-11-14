-- ============================================================
-- WARES — Master Data pindah ke Postgres sebagai SUMBER UTAMA.
--
-- Alasannya sama seperti stok: satu klik Simpan di Master Data memicu Apps
-- Script membaca seluruh MASTER DATA, jurnal MASUK/KELUAR, dan laporan bulanan
-- sekaligus, sehingga sering melewati batas 30 detik. Dengan Postgres sebagai
-- sumber utama, tulis/baca jadi milidetik dan Sheets cukup jadi mirror yang
-- dikerjakan di latar (`after()`), persis pola stock_ledger.
--
-- Aman dijalankan ulang (idempoten). Jalankan SEBELUM menyalakan
-- env MASTER_SOURCE=postgres.
-- ============================================================

create table if not exists public.master_items (
  id uuid primary key default gen_random_uuid(),
  -- Nomor urut tampilan; mengikuti urutan baris di spreadsheet saat backfill.
  no integer not null default 0,
  material_number text not null,
  nama_barang text not null,
  kategori text not null default '',
  klasifikasi text not null default '',
  lokasi text not null default '',
  rack integer,
  area text not null default '',
  -- Di spreadsheet kolom ini hasil rumus dan tidak pernah ditulis lewat CRUD;
  -- disimpan di sini supaya katalog stok tetap menampilkan satuan yang benar
  -- untuk material yang belum punya transaksi apa pun.
  satuan text not null default '',
  status text not null default 'AKTIF' check (status in ('AKTIF', 'NONAKTIF')),
  -- Baris asal di sheet MASTER DATA, dipakai mirror agar menulis ke baris yang sama.
  sheet_row integer,
  sheet_sync_status text not null default 'pending',
  sheet_sync_error text,
  sheet_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kolom generated memberi PostgREST target ON CONFLICT yang nyata sekaligus
-- mempertahankan aturan identitas case-insensitive + trim.
alter table public.master_items
  add column if not exists material_number_normalized text
  generated always as (upper(btrim(material_number))) stored;

-- Upgrade aman untuk tabel yang sempat dibuat oleh revisi sebelumnya. Status
-- awal hanya dianggap synced bila nomor baris mirror memang sudah diketahui.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'master_items'
      and column_name = 'sheet_sync_status'
  ) then
    alter table public.master_items
      add column sheet_sync_status text not null default 'pending';
    alter table public.master_items add column sheet_sync_error text;
    alter table public.master_items add column sheet_synced_at timestamptz;
    update public.master_items
       set sheet_sync_status = case when sheet_row is null then 'pending' else 'synced' end,
           sheet_synced_at = case when sheet_row is null then null else updated_at end;
  end if;
end $$;

alter table public.master_items add column if not exists sheet_sync_error text;
alter table public.master_items add column if not exists sheet_synced_at timestamptz;
update public.master_items set sheet_sync_status = 'pending' where sheet_sync_status is null;
alter table public.master_items alter column sheet_sync_status set default 'pending';
alter table public.master_items alter column sheet_sync_status set not null;

-- Material number adalah identitas kanonik; huruf besar/kecil tidak membedakan.
create unique index if not exists master_items_material_number_key
  on public.master_items (upper(btrim(material_number)));
-- Target konflik eksplisit untuk backfill PostgREST. Berbeda kapital/spasi tetap
-- menunjuk baris yang sama karena nilai kolomnya generated dan ternormalisasi.
create unique index if not exists master_items_material_number_normalized_key
  on public.master_items (material_number_normalized);
create index if not exists master_items_status_idx on public.master_items (status);
create index if not exists master_items_nama_idx on public.master_items (nama_barang);
create index if not exists master_items_sheet_row_idx on public.master_items (sheet_row);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.master_items'::regclass
       and conname = 'master_items_rack_known_range'
  ) then
    alter table public.master_items
      add constraint master_items_rack_known_range
      check (rack is null or rack between 1 and 50);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.master_items'::regclass
       and conname = 'master_items_sheet_sync_status_check'
  ) then
    alter table public.master_items
      add constraint master_items_sheet_sync_status_check
      check (sheet_sync_status in ('pending', 'synced', 'failed'));
  end if;
end $$;

create or replace function public.touch_master_items()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_master_items_touch on public.master_items;
create trigger trg_master_items_touch
  before update on public.master_items
  for each row execute function public.touch_master_items();

-- ========== RLS ==========
-- Semua pengguna login boleh MEMBACA: snapshot stok meng-overlay master data
-- memakai sesi pengguna, jadi mekanik pun perlu select agar daftar barang tampil.
-- MENULIS hanya admin.
alter table public.master_items enable row level security;

drop policy if exists "master: baca semua login" on public.master_items;
create policy "master: baca semua login" on public.master_items
  for select using (auth.uid() is not null);

drop policy if exists "master: tulis admin" on public.master_items;
create policy "master: tulis admin" on public.master_items
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on table public.master_items from anon;
grant select, insert, update on table public.master_items to authenticated;

notify pgrst, 'reload schema';
