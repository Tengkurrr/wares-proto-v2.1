-- ============================================================
-- WARES — Warehouse Request System
-- Dept. Pergudangan & Pengantongan, Petrokimia Gresik
--
-- Jalankan seluruh isi file ini di Supabase → SQL Editor.
-- Aman dijalankan ulang (idempoten).
-- ============================================================

-- ========== PROFILES ==========
create table if not exists public.profiles (
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
create table if not exists public.catalog_items (
  id bigint primary key,
  nama_barang text not null,
  kategori text not null,
  lokasi text not null,
  satuan text not null,
  stok integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists catalog_items_kategori_idx on public.catalog_items (kategori);
create index if not exists catalog_items_nama_barang_idx on public.catalog_items (nama_barang);

-- ========== REQUESTS (header surat) ==========
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pekerjaan text not null,
  lokasi_pekerjaan text not null,            -- lokasi PEKERJAAN (beda dari lokasi gudang item)
  kategori text[] not null default '{}',     -- multi-select jenis pekerjaan (checkbox)
  nama_penyerah text not null default '',    -- diketik manual (petugas yang menyerahkan)
  nama_penerima text not null default '',    -- diketik manual (karyawan penerima)
  status text not null default 'submitted',  -- legacy: penanda tersimpan, bukan alur approval
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists requests_user_id_idx on public.requests (user_id);
create index if not exists requests_created_at_idx on public.requests (created_at desc);

-- ========== REQUEST ITEMS (baris barang) ==========
create table if not exists public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  catalog_item_id bigint references public.catalog_items(id),
  kode_barang text,
  kategori_barang text not null default '',
  lokasi_barang text not null default '',
  nama_barang text not null,
  satuan text not null,
  jumlah_permintaan integer not null check (jumlah_permintaan > 0),
  jumlah_diberikan integer not null check (
    jumlah_diberikan >= 0 and jumlah_diberikan <= jumlah_permintaan
  ),
  jumlah integer not null check (jumlah > 0),   -- legacy alias jumlah_permintaan
  urutan integer not null default 0
);
create index if not exists request_items_request_id_idx on public.request_items (request_id);
create index if not exists request_items_catalog_item_id_idx on public.request_items (catalog_item_id);

-- ========== MIGRASI KOMPATIBEL UNTUK INSTALASI LAMA ==========
-- Kolom lama `jumlah` dipertahankan sementara agar data dan deployment lama tetap
-- dapat dibaca. Nilainya selalu diselaraskan dengan jumlah_permintaan oleh trigger.
alter table public.requests add column if not exists nama_penyerah text;
update public.requests set nama_penyerah = '' where nama_penyerah is null;
alter table public.requests alter column nama_penyerah set default '';
alter table public.requests alter column nama_penyerah set not null;

-- Pemisahan penyerah/penerima: migrasi data instalasi lama + definisi RPC yang
-- memakai kedua kolom ada di migrations/2026-08-04-penyerah-penerima.sql.
-- Jalankan berkas itu SETELAH schema.sql (baris di bawah hanya menyiapkan kolom).
alter table public.requests add column if not exists nama_penerima text;
update public.requests set nama_penerima = '' where nama_penerima is null;
alter table public.requests alter column nama_penerima set default '';
alter table public.requests alter column nama_penerima set not null;

alter table public.request_items add column if not exists kode_barang text;
alter table public.request_items add column if not exists kategori_barang text;
alter table public.request_items add column if not exists lokasi_barang text;
alter table public.request_items add column if not exists jumlah_permintaan integer;
alter table public.request_items add column if not exists jumlah_diberikan integer;
create index if not exists request_items_kode_barang_idx on public.request_items (kode_barang);

update public.request_items
set kategori_barang = coalesce(kategori_barang, ''),
    lokasi_barang = coalesce(lokasi_barang, '')
where kategori_barang is null or lokasi_barang is null;
alter table public.request_items alter column kategori_barang set default '';
alter table public.request_items alter column lokasi_barang set default '';
alter table public.request_items alter column kategori_barang set not null;
alter table public.request_items alter column lokasi_barang set not null;

update public.request_items
set jumlah_permintaan = coalesce(jumlah_permintaan, jumlah),
    jumlah_diberikan = coalesce(jumlah_diberikan, jumlah)
where jumlah_permintaan is null or jumlah_diberikan is null;

alter table public.request_items alter column jumlah_permintaan set not null;
alter table public.request_items alter column jumlah_diberikan set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.request_items'::regclass
      and conname = 'request_items_jumlah_permintaan_check'
  ) then
    alter table public.request_items
      add constraint request_items_jumlah_permintaan_check check (jumlah_permintaan > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.request_items'::regclass
      and conname = 'request_items_jumlah_diberikan_check'
  ) then
    alter table public.request_items
      add constraint request_items_jumlah_diberikan_check check (
        jumlah_diberikan >= 0 and jumlah_diberikan <= jumlah_permintaan
      );
  end if;
end $$;

create or replace function public.normalize_request_item_quantities() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.jumlah_permintaan := coalesce(new.jumlah_permintaan, new.jumlah);
    new.jumlah_diberikan := coalesce(new.jumlah_diberikan, new.jumlah_permintaan, new.jumlah);
  elsif new.jumlah is distinct from old.jumlah
    and new.jumlah_permintaan is not distinct from old.jumlah_permintaan
    and new.jumlah_diberikan is not distinct from old.jumlah_diberikan then
    -- Kompatibilitas untuk klien lama yang hanya mengubah `jumlah`.
    new.jumlah_permintaan := new.jumlah;
    new.jumlah_diberikan := new.jumlah;
  end if;

  -- `jumlah` tetap mengikuti jumlah yang diminta, bukan stok yang benar-benar keluar.
  new.jumlah := new.jumlah_permintaan;
  new.kode_barang := nullif(btrim(new.kode_barang), '');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_request_items_quantities on public.request_items;
create trigger trg_request_items_quantities
  before insert or update on public.request_items
  for each row execute function public.normalize_request_item_quantities();

-- ========== updated_at trigger ==========
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_requests_updated on public.requests;
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
$$ language sql stable security definer set search_path = public, pg_temp;

-- RLS saja tidak membatasi kolom yang boleh diubah. Trigger ini mencegah pengguna
-- biasa menaikkan `is_admin` miliknya lewat REST API Supabase.
create or replace function public.protect_profile_admin_flag() returns trigger as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah hak akses.' using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_profiles_protect_admin on public.profiles;
create trigger trg_profiles_protect_admin before update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

-- Header dan seluruh item disimpan dalam satu transaksi database. Integrasi Google
-- Sheets dilakukan oleh route Next.js dengan request id yang sama sebagai kunci
-- idempotensi.
drop function if exists public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz);
drop function if exists public.create_request_transaction(uuid, text, text, text[], text, jsonb);
create function public.create_request_transaction(
  p_request_id uuid,
  p_pekerjaan text,
  p_lokasi_pekerjaan text,
  p_kategori text[],
  p_nama_penyerah text,
  p_items jsonb,
  p_created_at timestamptz default now()
) returns uuid as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_existing_user_id uuid;
  v_item jsonb;
  v_urutan integer := 0;
  v_permintaan integer;
  v_diberikan integer;
begin
  if auth.uid() is null then
    raise exception 'Sesi login tidak ditemukan.' using errcode = '42501';
  end if;

  select user_id into v_existing_user_id
  from public.requests
  where id = v_request_id;
  if found then
    if v_existing_user_id = auth.uid() then
      return v_request_id;
    end if;
    raise exception 'Idempotency-Key sudah digunakan oleh permintaan lain.'
      using errcode = '23505';
  end if;
  if char_length(btrim(coalesce(p_pekerjaan, ''))) < 3 then
    raise exception 'Pekerjaan wajib diisi.' using errcode = '22023';
  end if;
  if char_length(btrim(p_pekerjaan)) > 200 then
    raise exception 'Pekerjaan maksimal 200 karakter.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_lokasi_pekerjaan, ''))) < 2 then
    raise exception 'Lokasi pekerjaan wajib diisi.' using errcode = '22023';
  end if;
  if char_length(btrim(p_lokasi_pekerjaan)) > 120 then
    raise exception 'Lokasi pekerjaan maksimal 120 karakter.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_nama_penyerah, ''))) < 2 then
    raise exception 'Nama penyerah wajib diisi.' using errcode = '22023';
  end if;
  if char_length(btrim(p_nama_penyerah)) > 120 then
    raise exception 'Nama penerima maksimal 120 karakter.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_kategori, 1), 0) = 0 then
    raise exception 'Minimal satu kategori wajib dipilih.' using errcode = '22023';
  end if;
  if array_length(p_kategori, 1) > 20
    or exists (select 1 from unnest(p_kategori) as kategori where char_length(kategori) > 80) then
    raise exception 'Kategori pekerjaan tidak valid.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu barang wajib dipilih.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Maksimal 50 barang per permintaan.' using errcode = '22023';
  end if;

  begin
    insert into public.requests (
      id, user_id, pekerjaan, lokasi_pekerjaan, kategori, nama_penyerah, status, created_at
    ) values (
      v_request_id,
      auth.uid(),
      btrim(p_pekerjaan),
      btrim(p_lokasi_pekerjaan),
      p_kategori,
      btrim(p_nama_penyerah),
      'submitted',
      coalesce(p_created_at, now())
    );
  exception when unique_violation then
    -- Dua request dengan key sama dapat tiba bersamaan. Setelah penunggu unique
    -- index dilepas, kembalikan request yang menang bila pemiliknya sama.
    select user_id into v_existing_user_id
    from public.requests
    where id = v_request_id;
    if found and v_existing_user_id = auth.uid() then
      return v_request_id;
    end if;
    raise exception 'Idempotency-Key sudah digunakan oleh permintaan lain.'
      using errcode = '23505';
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_permintaan := (v_item ->> 'jumlah_permintaan')::integer;
    v_diberikan := (v_item ->> 'jumlah_diberikan')::integer;

    if v_permintaan <= 0 or v_diberikan < 0 or v_diberikan > v_permintaan then
      raise exception 'Jumlah diberikan harus berada di antara 0 dan jumlah permintaan.'
        using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(v_item ->> 'nama_barang', ''))) = 0
      or char_length(btrim(coalesce(v_item ->> 'satuan', ''))) = 0 then
      raise exception 'Nama barang dan satuan wajib diisi.' using errcode = '22023';
    end if;
    if char_length(btrim(v_item ->> 'nama_barang')) > 200
      or char_length(btrim(v_item ->> 'satuan')) > 40
      or char_length(btrim(coalesce(v_item ->> 'kode_barang', ''))) > 100
      or char_length(btrim(coalesce(v_item ->> 'kategori_barang', ''))) > 120
      or char_length(btrim(coalesce(v_item ->> 'lokasi_barang', ''))) > 120 then
      raise exception 'Data barang melebihi batas karakter.' using errcode = '22023';
    end if;

    insert into public.request_items (
      request_id,
      catalog_item_id,
      kode_barang,
      kategori_barang,
      lokasi_barang,
      nama_barang,
      satuan,
      jumlah_permintaan,
      jumlah_diberikan,
      jumlah,
      urutan
    ) values (
      v_request_id,
      nullif(v_item ->> 'catalog_item_id', '')::bigint,
      nullif(btrim(v_item ->> 'kode_barang'), ''),
      coalesce(btrim(v_item ->> 'kategori_barang'), ''),
      coalesce(btrim(v_item ->> 'lokasi_barang'), ''),
      btrim(v_item ->> 'nama_barang'),
      btrim(v_item ->> 'satuan'),
      v_permintaan,
      v_diberikan,
      v_permintaan,
      v_urutan
    );
    v_urutan := v_urutan + 1;
  end loop;

  return v_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.update_request_transaction(
  p_request_id uuid,
  p_pekerjaan text,
  p_lokasi_pekerjaan text,
  p_kategori text[],
  p_nama_penyerah text,
  p_items jsonb
) returns uuid as $$
declare
  v_item jsonb;
  v_urutan integer := 0;
  v_permintaan integer;
  v_diberikan integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah permintaan.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.requests where id = p_request_id) then
    raise exception 'Permintaan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_pekerjaan, ''))) < 3
    or char_length(btrim(coalesce(p_lokasi_pekerjaan, ''))) < 2
    or char_length(btrim(coalesce(p_nama_penyerah, ''))) < 2
    or coalesce(array_length(p_kategori, 1), 0) = 0
    or coalesce(jsonb_typeof(p_items), '') <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'Data permintaan tidak lengkap.' using errcode = '22023';
  end if;
  if char_length(btrim(p_pekerjaan)) > 200
    or char_length(btrim(p_lokasi_pekerjaan)) > 120
    or char_length(btrim(p_nama_penyerah)) > 120
    or array_length(p_kategori, 1) > 20
    or exists (select 1 from unnest(p_kategori) as kategori where char_length(kategori) > 80)
    or jsonb_array_length(p_items) > 50 then
    raise exception 'Data permintaan melebihi batas yang diizinkan.' using errcode = '22023';
  end if;

  update public.requests
  set pekerjaan = btrim(p_pekerjaan),
      lokasi_pekerjaan = btrim(p_lokasi_pekerjaan),
      kategori = p_kategori,
      nama_penyerah = btrim(p_nama_penyerah)
  where id = p_request_id;

  delete from public.request_items where request_id = p_request_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_permintaan := (v_item ->> 'jumlah_permintaan')::integer;
    v_diberikan := (v_item ->> 'jumlah_diberikan')::integer;

    if v_permintaan <= 0 or v_diberikan < 0 or v_diberikan > v_permintaan then
      raise exception 'Jumlah diberikan harus berada di antara 0 dan jumlah permintaan.'
        using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(v_item ->> 'nama_barang', ''))) = 0
      or char_length(btrim(coalesce(v_item ->> 'satuan', ''))) = 0 then
      raise exception 'Nama barang dan satuan wajib diisi.' using errcode = '22023';
    end if;
    if char_length(btrim(v_item ->> 'nama_barang')) > 200
      or char_length(btrim(v_item ->> 'satuan')) > 40
      or char_length(btrim(coalesce(v_item ->> 'kode_barang', ''))) > 100
      or char_length(btrim(coalesce(v_item ->> 'kategori_barang', ''))) > 120
      or char_length(btrim(coalesce(v_item ->> 'lokasi_barang', ''))) > 120 then
      raise exception 'Data barang melebihi batas karakter.' using errcode = '22023';
    end if;

    insert into public.request_items (
      request_id,
      catalog_item_id,
      kode_barang,
      kategori_barang,
      lokasi_barang,
      nama_barang,
      satuan,
      jumlah_permintaan,
      jumlah_diberikan,
      jumlah,
      urutan
    ) values (
      p_request_id,
      nullif(v_item ->> 'catalog_item_id', '')::bigint,
      nullif(btrim(v_item ->> 'kode_barang'), ''),
      coalesce(btrim(v_item ->> 'kategori_barang'), ''),
      coalesce(btrim(v_item ->> 'lokasi_barang'), ''),
      btrim(v_item ->> 'nama_barang'),
      btrim(v_item ->> 'satuan'),
      v_permintaan,
      v_diberikan,
      v_permintaan,
      v_urutan
    );
    v_urutan := v_urutan + 1;
  end loop;

  return p_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz) from public;
revoke all on function public.update_request_transaction(uuid, text, text, text[], text, jsonb) from public;
grant execute on function public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz) to authenticated;
grant execute on function public.update_request_transaction(uuid, text, text, text[], text, jsonb) to authenticated;

-- profiles
drop policy if exists "profil sendiri: baca" on public.profiles;
create policy "profil sendiri: baca" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profil sendiri: update" on public.profiles;
create policy "profil sendiri: update" on public.profiles for update using (id = auth.uid());

drop policy if exists "profil: insert saat signup" on public.profiles;
create policy "profil: insert saat signup" on public.profiles for insert
  with check (id = auth.uid() and is_admin = false);

-- catalog: semua user login boleh baca; tulis hanya admin
drop policy if exists "katalog: baca" on public.catalog_items;
create policy "katalog: baca" on public.catalog_items for select using (auth.role() = 'authenticated');

drop policy if exists "katalog: tulis admin" on public.catalog_items;
create policy "katalog: tulis admin" on public.catalog_items for all using (public.is_admin()) with check (public.is_admin());

-- requests: user membuat/membaca miliknya; hanya admin boleh mengubah
drop policy if exists "request: baca sendiri/admin" on public.requests;
create policy "request: baca sendiri/admin" on public.requests for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "request: insert sendiri" on public.requests;
create policy "request: insert sendiri" on public.requests for insert with check (user_id = auth.uid());

drop policy if exists "request: update sendiri" on public.requests;
drop policy if exists "request: update admin" on public.requests;
create policy "request: update admin" on public.requests for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "request: delete sendiri" on public.requests;
drop policy if exists "request: delete admin" on public.requests;
create policy "request: delete admin" on public.requests for delete using (public.is_admin());

-- request_items: ikut kepemilikan request induk
drop policy if exists "item: baca" on public.request_items;
create policy "item: baca" on public.request_items for select using (
  exists(select 1 from public.requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())));

drop policy if exists "item: tulis" on public.request_items;
drop policy if exists "item: insert sendiri" on public.request_items;
create policy "item: insert sendiri" on public.request_items for insert with check (
  exists(
    select 1 from public.requests r
    where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));

drop policy if exists "item: update admin" on public.request_items;
create policy "item: update admin" on public.request_items for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "item: delete admin" on public.request_items;
create policy "item: delete admin" on public.request_items for delete using (public.is_admin());

-- ========== STOCK LEDGER (opsional aktif lewat STOCK_SOURCE=postgres) ==========
create or replace function public.stock_item_key(p_kode text, p_nama text)
returns text language sql immutable as $$
  select coalesce(nullif(btrim(p_kode), ''), lower(btrim(coalesce(p_nama, ''))));
$$;

create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('masuk', 'keluar')),
  item_key text not null,
  kode_barang text,
  nama_barang text not null,
  kategori text not null default '',
  lokasi text not null default '',
  satuan text not null default '',
  rack integer check (rack is null or rack between 1 and 50),
  area text not null default '',
  jumlah numeric not null check (jumlah >= 0),
  keterangan text not null default '',
  ref_type text,
  ref_id text,
  transaction_id text unique,
  occurred_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.stock_ledger add column if not exists rack integer;
alter table public.stock_ledger add column if not exists area text;
update public.stock_ledger set area = '' where area is null;
alter table public.stock_ledger alter column area set default '';
alter table public.stock_ledger alter column area set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_ledger'::regclass
      and conname = 'stock_ledger_rack_known_range'
  ) then
    alter table public.stock_ledger add constraint stock_ledger_rack_known_range
      check (rack is null or rack between 1 and 50);
  end if;
end $$;
create index if not exists stock_ledger_item_key_idx on public.stock_ledger (item_key);
create index if not exists stock_ledger_ref_idx on public.stock_ledger (ref_type, ref_id);
create index if not exists stock_ledger_jenis_idx on public.stock_ledger (jenis);

create or replace view public.stock_current as
with agg as (
  select item_key,
    sum(case when jenis = 'masuk' then jumlah else 0 end)
      - sum(case when jenis = 'keluar' then jumlah else 0 end) as stok
  from public.stock_ledger
  group by item_key
),
meta as (
  select distinct on (item_key)
    item_key, kode_barang, nama_barang, kategori, lokasi, satuan
  from public.stock_ledger
  order by item_key, occurred_at desc, created_at desc
),
storage_meta as (
  select distinct on (item_key) item_key, rack, area
  from public.stock_ledger
  where rack is not null or btrim(area) <> ''
  order by item_key, occurred_at desc, created_at desc
)
select
  m.kode_barang, m.nama_barang, m.kategori, m.lokasi, m.satuan, a.stok,
  s.rack, coalesce(s.area, '') as area
from agg a
join meta m using (item_key)
left join storage_meta s using (item_key);

create or replace function public.stock_snapshot()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kode_barang', kode_barang,
          'nama_barang', nama_barang,
          'kategori', kategori,
          'lokasi', lokasi,
          'satuan', satuan,
          'stok', stok,
          'rack', rack,
          'area', area
        ) order by nama_barang
      ) from public.stock_current
    ), '[]'::jsonb),
    'keterangan', coalesce((
      select jsonb_agg(k order by k)
      from (
        select distinct btrim(keterangan) as k
        from public.stock_ledger
        where jenis = 'masuk' and btrim(keterangan) <> ''
      ) notes
    ), '[]'::jsonb),
    'reportSheet', ''::text,
    'generatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;

create or replace function public.record_stock_incoming(
  p_transaction_id text,
  p_tanggal text,
  p_kode_barang text,
  p_nama_barang text,
  p_kategori text,
  p_lokasi text,
  p_satuan text,
  p_jumlah numeric,
  p_keterangan text,
  p_rack integer,
  p_area text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_occurred timestamptz;
  v_stok numeric;
begin
  if not public.is_admin() then
    raise exception 'Input stok hanya dapat dilakukan admin.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_nama_barang, ''))) = 0 then
    raise exception 'Nama barang wajib diisi.' using errcode = '22023';
  end if;
  if char_length(btrim(p_nama_barang)) > 200
    or char_length(btrim(coalesce(p_kode_barang, ''))) > 100
    or char_length(btrim(coalesce(p_keterangan, ''))) > 120
    or char_length(btrim(coalesce(p_area, ''))) > 120 then
    raise exception 'Data input stok melebihi batas karakter.' using errcode = '22023';
  end if;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > 1000000000 then
    raise exception 'Jumlah masuk harus lebih dari 0.' using errcode = '22023';
  end if;
  if p_rack is null or p_rack < 1 or p_rack > 50 then
    raise exception 'Nomor rack tidak valid.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_area, ''))) = 0 then
    raise exception 'Area wajib dipilih.' using errcode = '22023';
  end if;

  v_key := public.stock_item_key(p_kode_barang, p_nama_barang);
  begin
    v_occurred := coalesce(to_timestamp(nullif(btrim(p_tanggal), ''), 'YYYY-MM-DD'), now());
  exception when others then
    v_occurred := now();
  end;

  insert into public.stock_ledger (
    jenis, item_key, kode_barang, nama_barang, kategori, lokasi, satuan,
    rack, area, jumlah, keterangan, ref_type, ref_id, transaction_id,
    occurred_at, created_by
  ) values (
    'masuk', v_key, nullif(btrim(p_kode_barang), ''), btrim(p_nama_barang),
    coalesce(btrim(p_kategori), ''), coalesce(btrim(p_lokasi), ''),
    coalesce(btrim(p_satuan), ''), p_rack, btrim(p_area), p_jumlah,
    coalesce(btrim(p_keterangan), ''), 'input_stok',
    nullif(btrim(p_transaction_id), ''), nullif(btrim(p_transaction_id), ''),
    v_occurred, auth.uid()
  ) on conflict (transaction_id) do nothing;

  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0)
    into v_stok from public.stock_ledger where item_key = v_key;
  return jsonb_build_object(
    'ok', true, 'transactionId', p_transaction_id,
    'stock', coalesce(v_stok, 0), 'rack', p_rack, 'area', btrim(p_area)
  );
end;
$$;

create or replace function public.sync_stock_master_item(
  p_old_code text,
  p_old_name text,
  p_new_code text,
  p_new_name text,
  p_kategori text,
  p_lokasi text,
  p_rack integer,
  p_area text
) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old_key text;
  v_new_key text;
  v_updated integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menyinkronkan Master Data.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_new_name, ''))) = 0
    or char_length(btrim(coalesce(p_new_code, ''))) = 0 then
    raise exception 'Material number dan nama barang wajib diisi.' using errcode = '22023';
  end if;
  if p_rack is null or p_rack < 1 or p_rack > 50
    or char_length(btrim(coalesce(p_area, ''))) = 0 then
    raise exception 'Rack/Area tidak valid.' using errcode = '22023';
  end if;
  v_old_key := public.stock_item_key(p_old_code, p_old_name);
  v_new_key := public.stock_item_key(p_new_code, p_new_name);

  if v_old_key <> v_new_key
    or btrim(coalesce(p_old_code, '')) <> btrim(coalesce(p_new_code, ''))
    or btrim(coalesce(p_old_name, '')) <> btrim(coalesce(p_new_name, '')) then
    update public.request_items
       set kode_barang = nullif(btrim(p_new_code), ''),
           nama_barang = btrim(p_new_name),
           kategori_barang = coalesce(btrim(p_kategori), ''),
           lokasi_barang = coalesce(btrim(p_lokasi), '')
     where public.stock_item_key(kode_barang, nama_barang) = v_old_key;
  end if;

  update public.stock_ledger
     set item_key = v_new_key,
         kode_barang = nullif(btrim(p_new_code), ''),
         nama_barang = btrim(p_new_name),
         kategori = coalesce(btrim(p_kategori), ''),
         lokasi = coalesce(btrim(p_lokasi), ''),
         rack = p_rack,
         area = btrim(p_area)
   where item_key = v_old_key or item_key = v_new_key;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.sync_stock_ledger_from_item()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.stock_ledger
      where ref_type = 'request_item' and ref_id = old.id::text;
    return old;
  end if;
  delete from public.stock_ledger
    where ref_type = 'request_item' and ref_id = new.id::text;
  insert into public.stock_ledger (
    jenis, item_key, kode_barang, nama_barang, kategori, lokasi, satuan,
    jumlah, keterangan, ref_type, ref_id, occurred_at, created_by
  )
  select
    'keluar', public.stock_item_key(new.kode_barang, new.nama_barang),
    nullif(btrim(new.kode_barang), ''), new.nama_barang,
    coalesce(new.kategori_barang, ''), coalesce(new.lokasi_barang, ''),
    coalesce(new.satuan, ''), new.jumlah_diberikan, 'permintaan',
    'request_item', new.id::text, coalesce(r.created_at, now()), r.user_id
  from public.requests r where r.id = new.request_id;
  return new;
end;
$$;

drop trigger if exists trg_request_items_stock_ledger on public.request_items;
create trigger trg_request_items_stock_ledger
  after insert or update or delete on public.request_items
  for each row execute function public.sync_stock_ledger_from_item();

alter table public.stock_ledger enable row level security;
drop policy if exists "ledger: admin baca" on public.stock_ledger;
create policy "ledger: admin baca" on public.stock_ledger
  for select using (public.is_admin());

revoke all on function public.record_stock_incoming(
  text, text, text, text, text, text, text, numeric, text, integer, text
) from public;
grant execute on function public.stock_snapshot() to authenticated;
grant execute on function public.record_stock_incoming(
  text, text, text, text, text, text, text, numeric, text, integer, text
) to authenticated;
revoke all on function public.sync_stock_master_item(
  text, text, text, text, text, text, integer, text
) from public;
grant execute on function public.sync_stock_master_item(
  text, text, text, text, text, text, integer, text
) to authenticated;

-- ========== MASTER DATA (SUMBER CEPAT POSTGRES) ==========
-- Identitas material diisi pertama kali dari sheet MASTER DATA melalui
-- `npm run backfill:master`. Setelah itu website membaca tabel ini agar halaman
-- Master Data tidak menunggu Apps Script pada setiap kunjungan. Google Sheets
-- tetap menerima mirror perubahan di latar belakang.
create table if not exists public.master_items (
  id uuid primary key default gen_random_uuid(),
  no integer not null default 0,
  material_number text not null,
  nama_barang text not null,
  kategori text not null default '',
  klasifikasi text not null default '',
  lokasi text not null default '',
  rack integer,
  area text not null default '',
  satuan text not null default '',
  status text not null default 'AKTIF' check (status in ('AKTIF', 'NONAKTIF')),
  sheet_row integer,
  sheet_sync_status text not null default 'pending',
  sheet_sync_error text,
  sheet_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.master_items
  add column if not exists material_number_normalized text
  generated always as (upper(btrim(material_number))) stored;

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

create unique index if not exists master_items_material_number_key
  on public.master_items (upper(btrim(material_number)));
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
