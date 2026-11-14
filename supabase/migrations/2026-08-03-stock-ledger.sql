-- ============================================================
-- WARES — Migrasi stok berbasis Postgres (opsi B, sumber stok pindah dari
-- Google Sheets ke Postgres; Sheets tetap dipakai sebagai mirror/laporan).
--
-- Aman dijalankan ulang (idempoten). Jalankan SELURUH file ini di
-- Supabase → SQL Editor SEBELUM menyalakan env STOCK_SOURCE=postgres.
--
-- Model: satu jurnal append-only `stock_ledger` berisi baris MASUK & KELUAR.
--   stok berjalan = Σ(masuk) − Σ(keluar) per barang (view `stock_current`).
--   - MASUK  : dari Input Stok (fungsi record_stock_incoming) + saldo awal backfill.
--   - KELUAR : otomatis mengikuti `request_items` lewat trigger (tanpa mengubah RPC
--              permintaan yang sudah ada). Satu baris ledger per item permintaan.
-- ============================================================

-- Kunci identitas barang yang konsisten di seluruh jurnal: pakai kode barang bila
-- ada, kalau kosong pakai nama barang yang dinormalisasi.
create or replace function public.stock_item_key(p_kode text, p_nama text)
returns text language sql immutable as $$
  select coalesce(nullif(btrim(p_kode), ''), lower(btrim(coalesce(p_nama, ''))));
$$;

-- ========== JURNAL STOK ==========
create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('masuk', 'keluar')),
  item_key text not null,
  kode_barang text,
  nama_barang text not null,
  kategori text not null default '',
  lokasi text not null default '',
  satuan text not null default '',
  jumlah numeric not null check (jumlah >= 0),
  keterangan text not null default '',
  ref_type text,                       -- 'saldo_awal' | 'input_stok' | 'request_item'
  ref_id text,                         -- id sumber (mis. request_items.id) untuk sinkronisasi
  transaction_id text unique,          -- idempotensi Input Stok (null diperbolehkan berulang)
  occurred_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_ledger_item_key_idx on public.stock_ledger (item_key);
create index if not exists stock_ledger_ref_idx on public.stock_ledger (ref_type, ref_id);
create index if not exists stock_ledger_jenis_idx on public.stock_ledger (jenis);

-- ========== STOK BERJALAN ==========
-- Metadata (nama/kategori/lokasi/satuan) diambil dari baris terbaru per barang.
create or replace view public.stock_current as
with agg as (
  select
    item_key,
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
)
select
  m.kode_barang,
  m.nama_barang,
  m.kategori,
  m.lokasi,
  m.satuan,
  a.stok
from agg a
join meta m using (item_key);

-- ========== SNAPSHOT (bentuk sama dengan StockSnapshot dari Sheets) ==========
create or replace function public.stock_snapshot()
returns jsonb
language sql
stable
security definer
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
          'stok', stok
        )
        order by nama_barang
      )
      from public.stock_current
    ), '[]'::jsonb),
    'keterangan', coalesce((
      select jsonb_agg(k order by k)
      from (
        select distinct btrim(keterangan) as k
        from public.stock_ledger
        where jenis = 'masuk' and btrim(keterangan) <> ''
      ) s
    ), '[]'::jsonb),
    'reportSheet', ''::text,
    'generatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
$$;

-- ========== INPUT STOK (MASUK) ==========
-- Idempoten via transaction_id. Hanya admin. Metadata dipakai untuk menampilkan
-- barang baru yang belum pernah muncul di jurnal.
create or replace function public.record_stock_incoming(
  p_transaction_id text,
  p_tanggal text,          -- 'YYYY-MM-DD'
  p_kode_barang text,
  p_nama_barang text,
  p_kategori text,
  p_lokasi text,
  p_satuan text,
  p_jumlah numeric,
  p_keterangan text
) returns jsonb
language plpgsql
security definer
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
    or char_length(btrim(coalesce(p_keterangan, ''))) > 120 then
    raise exception 'Data input stok melebihi batas karakter.' using errcode = '22023';
  end if;
  if p_jumlah is null or p_jumlah <= 0 or p_jumlah > 1000000000 then
    raise exception 'Jumlah masuk harus lebih dari 0.' using errcode = '22023';
  end if;

  v_key := public.stock_item_key(p_kode_barang, p_nama_barang);
  begin
    v_occurred := coalesce(to_timestamp(nullif(btrim(p_tanggal), ''), 'YYYY-MM-DD'), now());
  exception when others then
    v_occurred := now();
  end;

  insert into public.stock_ledger (
    jenis, item_key, kode_barang, nama_barang, kategori, lokasi, satuan,
    jumlah, keterangan, ref_type, ref_id, transaction_id, occurred_at, created_by
  ) values (
    'masuk', v_key, nullif(btrim(p_kode_barang), ''), btrim(p_nama_barang),
    coalesce(btrim(p_kategori), ''), coalesce(btrim(p_lokasi), ''), coalesce(btrim(p_satuan), ''),
    p_jumlah, coalesce(btrim(p_keterangan), ''), 'input_stok',
    nullif(btrim(p_transaction_id), ''), nullif(btrim(p_transaction_id), ''),
    v_occurred, auth.uid()
  )
  on conflict (transaction_id) do nothing;

  select stok into v_stok from public.stock_current where item_key = v_key;

  return jsonb_build_object(
    'ok', true,
    'transactionId', p_transaction_id,
    'stock', coalesce(v_stok, 0)
  );
end;
$$;

-- ========== KELUAR mengikuti request_items secara otomatis ==========
-- Menjaga satu baris ledger KELUAR per item permintaan tanpa menyentuh RPC
-- create_/update_request_transaction. Edit permintaan = delete+insert item, jadi
-- trigger ini otomatis menyesuaikan ledger.
create or replace function public.sync_stock_ledger_from_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.stock_ledger
      where ref_type = 'request_item' and ref_id = old.id::text;
    return old;
  end if;

  -- INSERT/UPDATE: tulis ulang baris KELUAR barang ini.
  delete from public.stock_ledger
    where ref_type = 'request_item' and ref_id = new.id::text;

  insert into public.stock_ledger (
    jenis, item_key, kode_barang, nama_barang, kategori, lokasi, satuan,
    jumlah, keterangan, ref_type, ref_id, occurred_at, created_by
  )
  select
    'keluar',
    public.stock_item_key(new.kode_barang, new.nama_barang),
    nullif(btrim(new.kode_barang), ''), new.nama_barang,
    coalesce(new.kategori_barang, ''), coalesce(new.lokasi_barang, ''), coalesce(new.satuan, ''),
    new.jumlah_diberikan, 'permintaan',
    'request_item', new.id::text,
    coalesce(r.created_at, now()), r.user_id
  from public.requests r
  where r.id = new.request_id;

  return new;
end;
$$;

drop trigger if exists trg_request_items_stock_ledger on public.request_items;
create trigger trg_request_items_stock_ledger
  after insert or update or delete on public.request_items
  for each row execute function public.sync_stock_ledger_from_item();

-- ========== RLS & hak akses ==========
alter table public.stock_ledger enable row level security;

-- Tulis stok hanya lewat fungsi security-definer di atas. Client langsung hanya
-- boleh membaca bila admin (untuk audit); pembacaan umum lewat stock_snapshot().
drop policy if exists "ledger: admin baca" on public.stock_ledger;
create policy "ledger: admin baca" on public.stock_ledger
  for select using (public.is_admin());

revoke all on function public.record_stock_incoming(text, text, text, text, text, text, text, numeric, text) from public;
grant execute on function public.stock_snapshot() to authenticated;
grant execute on function public.record_stock_incoming(text, text, text, text, text, text, text, numeric, text) to authenticated;
