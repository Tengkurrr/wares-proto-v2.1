-- ============================================================
-- WARES — 4 Agustus 2026
--   BAGIAN A. Perbaiki error Input Stok: column "item_key" does not exist.
--   BAGIAN B. Pisahkan nama PENYERAH dan PENERIMA (dua-duanya diketik manual).
--
-- Aman dijalankan ulang (idempoten). Jalankan SELURUH file ini di
-- Supabase → SQL Editor. Boleh dijalankan sebelum kode baru ter-deploy:
-- fungsi di bawah tetap melayani panggilan versi lama (lihat catatan BAGIAN B).
-- ============================================================


-- ============================================================
-- BAGIAN A — FIX INPUT STOK
-- ============================================================
-- Penyebab: baris terakhir fungsi membaca `stock_current.item_key`, padahal view
-- `stock_current` tidak mengekspos kolom item_key (hanya kode/nama/kategori/
-- lokasi/satuan/stok). Akibatnya setiap "Tambahkan Stok" gagal, walau barisnya
-- sebenarnya sudah masuk ke jurnal. Perbaikannya: hitung saldo langsung dari
-- `stock_ledger` memakai item_key yang memang ada di tabel itu.
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

  -- PERBAIKAN: dihitung dari stock_ledger (punya item_key), bukan dari view.
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0)
    into v_stok
    from public.stock_ledger
   where item_key = v_key;

  return jsonb_build_object(
    'ok', true,
    'transactionId', p_transaction_id,
    'stock', coalesce(v_stok, 0)
  );
end;
$$;

revoke all on function public.record_stock_incoming(text, text, text, text, text, text, text, numeric, text) from public;
grant execute on function public.record_stock_incoming(text, text, text, text, text, text, text, numeric, text) to authenticated;


-- ============================================================
-- BAGIAN B — PENYERAH & PENERIMA TERPISAH
-- ============================================================
-- Sebelumnya kolom `nama_penyerah` justru MENYIMPAN nama penerima, sementara
-- penyerah diambil otomatis dari akun yang login. Sekarang keduanya diketik
-- manual, jadi butuh kolom sendiri-sendiri.
do $$
declare
  v_kolom_baru boolean;
begin
  v_kolom_baru := not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'requests'
       and column_name = 'nama_penerima'
  );

  if v_kolom_baru then
    alter table public.requests add column nama_penerima text;

    -- 1) Isi penerima dari kolom lama (di situlah nama penerima selama ini disimpan).
    update public.requests set nama_penerima = nama_penyerah;

    -- 2) Baru isi penyerah dengan nama pemilik akun pembuat — itulah nama yang
    --    selama ini TAMPIL sebagai penyerah pada surat, jadi data lama tetap utuh.
    update public.requests r
       set nama_penyerah = coalesce(nullif(btrim(p.nama_lengkap), ''), 'Tidak diketahui')
      from public.profiles p
     where p.id = r.user_id;
  end if;
end $$;

update public.requests set nama_penerima = '' where nama_penerima is null;
alter table public.requests alter column nama_penerima set default '';
alter table public.requests alter column nama_penerima set not null;


-- ---------- RPC: buat permintaan ----------
-- p_nama_penerima sengaja punya default NULL agar versi kode LAMA (yang belum
-- mengirim parameter ini) tetap berjalan selama deploy: bila NULL, fungsi
-- memakai perilaku lama — p_nama_penyerah dianggap berisi nama penerima dan
-- penyerah diambil dari profil akun. Jadi tidak ada jeda error saat rilis.
drop function if exists public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz);
drop function if exists public.create_request_transaction(uuid, text, text, text[], text, jsonb);
drop function if exists public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz, text);

create function public.create_request_transaction(
  p_request_id uuid,
  p_pekerjaan text,
  p_lokasi_pekerjaan text,
  p_kategori text[],
  p_nama_penyerah text,
  p_items jsonb,
  p_created_at timestamptz default now(),
  p_nama_penerima text default null
) returns uuid as $$
declare
  v_request_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_existing_user_id uuid;
  v_item jsonb;
  v_urutan integer := 0;
  v_permintaan integer;
  v_diberikan integer;
  v_penyerah text;
  v_penerima text;
  v_gaya_lama boolean := p_nama_penerima is null;
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

  if v_gaya_lama then
    -- Panggilan kode lama: parameter penyerah sebenarnya berisi nama penerima.
    v_penerima := btrim(coalesce(p_nama_penyerah, ''));
    select coalesce(nullif(btrim(nama_lengkap), ''), 'Tidak diketahui')
      into v_penyerah
      from public.profiles where id = auth.uid();
    v_penyerah := coalesce(v_penyerah, 'Tidak diketahui');
  else
    v_penyerah := btrim(coalesce(p_nama_penyerah, ''));
    v_penerima := btrim(coalesce(p_nama_penerima, ''));
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
  if char_length(v_penerima) < 2 then
    raise exception 'Nama penerima wajib diisi.' using errcode = '22023';
  end if;
  if char_length(v_penerima) > 120 then
    raise exception 'Nama penerima maksimal 120 karakter.' using errcode = '22023';
  end if;
  if not v_gaya_lama then
    if char_length(v_penyerah) < 2 then
      raise exception 'Nama penyerah wajib diisi.' using errcode = '22023';
    end if;
    if char_length(v_penyerah) > 120 then
      raise exception 'Nama penyerah maksimal 120 karakter.' using errcode = '22023';
    end if;
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
      id, user_id, pekerjaan, lokasi_pekerjaan, kategori,
      nama_penyerah, nama_penerima, status, created_at
    ) values (
      v_request_id,
      auth.uid(),
      btrim(p_pekerjaan),
      btrim(p_lokasi_pekerjaan),
      p_kategori,
      v_penyerah,
      v_penerima,
      'submitted',
      coalesce(p_created_at, now())
    );
  exception when unique_violation then
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
      request_id, catalog_item_id, kode_barang, kategori_barang, lokasi_barang,
      nama_barang, satuan, jumlah_permintaan, jumlah_diberikan, jumlah, urutan
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


-- ---------- RPC: ubah permintaan ----------
drop function if exists public.update_request_transaction(uuid, text, text, text[], text, jsonb);
drop function if exists public.update_request_transaction(uuid, text, text, text[], text, jsonb, text);

create function public.update_request_transaction(
  p_request_id uuid,
  p_pekerjaan text,
  p_lokasi_pekerjaan text,
  p_kategori text[],
  p_nama_penyerah text,
  p_items jsonb,
  p_nama_penerima text default null
) returns uuid as $$
declare
  v_item jsonb;
  v_urutan integer := 0;
  v_permintaan integer;
  v_diberikan integer;
  v_penyerah text;
  v_penerima text;
  v_gaya_lama boolean := p_nama_penerima is null;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah permintaan.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.requests where id = p_request_id) then
    raise exception 'Permintaan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_gaya_lama then
    -- Kode lama: parameter penyerah berisi nama penerima; penyerah dipertahankan.
    v_penerima := btrim(coalesce(p_nama_penyerah, ''));
    select nama_penyerah into v_penyerah from public.requests where id = p_request_id;
    v_penyerah := coalesce(nullif(btrim(v_penyerah), ''), 'Tidak diketahui');
  else
    v_penyerah := btrim(coalesce(p_nama_penyerah, ''));
    v_penerima := btrim(coalesce(p_nama_penerima, ''));
  end if;

  if char_length(btrim(coalesce(p_pekerjaan, ''))) < 3
    or char_length(btrim(coalesce(p_lokasi_pekerjaan, ''))) < 2
    or char_length(v_penerima) < 2
    or char_length(v_penyerah) < 2
    or coalesce(array_length(p_kategori, 1), 0) = 0
    or coalesce(jsonb_typeof(p_items), '') <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'Data permintaan tidak lengkap.' using errcode = '22023';
  end if;
  if char_length(btrim(p_pekerjaan)) > 200
    or char_length(btrim(p_lokasi_pekerjaan)) > 120
    or char_length(v_penerima) > 120
    or char_length(v_penyerah) > 120
    or array_length(p_kategori, 1) > 20
    or exists (select 1 from unnest(p_kategori) as kategori where char_length(kategori) > 80)
    or jsonb_array_length(p_items) > 50 then
    raise exception 'Data permintaan melebihi batas yang diizinkan.' using errcode = '22023';
  end if;

  update public.requests
  set pekerjaan = btrim(p_pekerjaan),
      lokasi_pekerjaan = btrim(p_lokasi_pekerjaan),
      kategori = p_kategori,
      nama_penyerah = v_penyerah,
      nama_penerima = v_penerima
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
      request_id, catalog_item_id, kode_barang, kategori_barang, lokasi_barang,
      nama_barang, satuan, jumlah_permintaan, jumlah_diberikan, jumlah, urutan
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

revoke all on function public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz, text) from public;
revoke all on function public.update_request_transaction(uuid, text, text, text[], text, jsonb, text) from public;
grant execute on function public.create_request_transaction(uuid, text, text, text[], text, jsonb, timestamptz, text) to authenticated;
grant execute on function public.update_request_transaction(uuid, text, text, text[], text, jsonb, text) to authenticated;

-- Tanda tangan fungsi berubah, jadi cache skema PostgREST harus dimuat ulang.
-- Tanpa ini API bisa sempat membalas "Could not find the function ... in the
-- schema cache" sampai cache tersegarkan sendiri.
notify pgrst, 'reload schema';
