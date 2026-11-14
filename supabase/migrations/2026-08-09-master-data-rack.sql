-- ============================================================
-- WARES — Rack/Area untuk sumber stok Postgres.
-- Aman dijalankan ulang. Jalankan sebelum deploy yang mengirim p_rack/p_area.
-- Fungsi 9-parameter lama sengaja dipertahankan selama masa rollout; route baru
-- memilih overload ini lewat nama parameter p_rack dan p_area.
-- ============================================================

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
    alter table public.stock_ledger
      add constraint stock_ledger_rack_known_range check (rack is null or rack between 1 and 50);
  end if;
end $$;

-- Kolom lama dipertahankan pada urutan yang sama; rack/area ditambahkan di
-- belakang agar CREATE OR REPLACE kompatibel dengan view yang sudah terpasang.
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
),
storage_meta as (
  select distinct on (item_key)
    item_key, rack, area
  from public.stock_ledger
  where rack is not null or btrim(area) <> ''
  order by item_key, occurred_at desc, created_at desc
)
select
  m.kode_barang,
  m.nama_barang,
  m.kategori,
  m.lokasi,
  m.satuan,
  a.stok,
  s.rack,
  coalesce(s.area, '') as area
from agg a
join meta m using (item_key)
left join storage_meta s using (item_key);

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
          'stok', stok,
          'rack', rack,
          'area', area
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
    coalesce(btrim(p_satuan), ''), p_rack, coalesce(btrim(p_area), ''),
    p_jumlah, coalesce(btrim(p_keterangan), ''), 'input_stok',
    nullif(btrim(p_transaction_id), ''), nullif(btrim(p_transaction_id), ''),
    v_occurred, auth.uid()
  )
  on conflict (transaction_id) do nothing;

  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0)
    into v_stok
    from public.stock_ledger
   where item_key = v_key;

  return jsonb_build_object(
    'ok', true,
    'transactionId', p_transaction_id,
    'stock', coalesce(v_stok, 0),
    'rack', p_rack,
    'area', coalesce(btrim(p_area), '')
  );
end;
$$;

-- Menjaga mode Postgres tetap satu identitas ketika admin mengubah material
-- number/nama/rack pada MASTER DATA Sheets.
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
language plpgsql
security definer
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

notify pgrst, 'reload schema';
