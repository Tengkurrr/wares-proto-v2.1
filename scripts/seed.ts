/**
 * Seed WARES: isi katalog barang + buat akun admin awal.
 * Jalankan: npm run seed
 *
 * Butuh SUPABASE_SERVICE_ROLE_KEY di .env.local (melewati RLS).
 * Idempoten: aman dijalankan berulang kali.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

loadEnv({ path: resolve(root, ".env.local") });

type CatalogItem = {
  id: number;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
};

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function fail(msg: string): never {
  console.error(`${c.red}✖ ${msg}${c.reset}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi.\n" +
      "  Salin .env.local.example menjadi .env.local, lalu isi dari Supabase → Project Settings → API."
  );
}

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "PGADMIN").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim();
const ADMIN_NAMA = process.env.ADMIN_NAMA || "Administrator WARES";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@petrokimia.co.id";

if (!ADMIN_USERNAME.startsWith("PG")) {
  fail(`ADMIN_USERNAME harus diawali "PG" (sekarang: ${ADMIN_USERNAME}).`);
}

if (!ADMIN_PASSWORD) {
  fail("ADMIN_PASSWORD wajib diisi di .env.local; tidak ada kata sandi bawaan demi keamanan.");
}

if (ADMIN_PASSWORD.length < 12) {
  fail("ADMIN_PASSWORD minimal 12 karakter.");
}

if (ADMIN_PASSWORD.toLowerCase() === "admin#2026".toLowerCase()) {
  fail("ADMIN_PASSWORD masih memakai contoh lama yang tidak aman. Gunakan kata sandi unik.");
}

const adminAuthEmail = `${ADMIN_USERNAME.toLowerCase()}@wares.local`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedCatalog() {
  const path = resolve(here, "catalog.json");
  let items: CatalogItem[];
  try {
    items = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`Tidak bisa membaca ${path}.`);
  }

  console.log(`${c.dim}→ Mengisi katalog: ${items!.length} item…${c.reset}`);

  const CHUNK = 500;
  for (let i = 0; i < items!.length; i += CHUNK) {
    const batch = items!.slice(i, i + CHUNK).map((it) => ({
      id: it.id,
      nama_barang: it.nama_barang,
      kategori: it.kategori,
      lokasi: it.lokasi,
      satuan: it.satuan,
      stok: it.stok ?? 100,
    }));

    const { error } = await supabase.from("catalog_items").upsert(batch, { onConflict: "id" });
    if (error) fail(`Gagal upsert katalog (batch ${i / CHUNK + 1}): ${error.message}`);
    console.log(`${c.dim}  batch ${i / CHUNK + 1}: ${batch.length} item${c.reset}`);
  }

  const { count, error } = await supabase
    .from("catalog_items")
    .select("id", { count: "exact", head: true });
  if (error) fail(`Gagal menghitung katalog: ${error.message}`);

  console.log(`${c.green}✔ Katalog siap — ${count} item di tabel catalog_items.${c.reset}`);
}

async function findAuthUserByEmail(email: string) {
  // listUsers dipaginasi; katalog user internal kecil, 2 halaman sudah lebih dari cukup.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Gagal membaca daftar user: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function seedAdmin() {
  console.log(`${c.dim}→ Menyiapkan akun admin ${ADMIN_USERNAME}…${c.reset}`);

  let userId: string;
  const existing = await findAuthUserByEmail(adminAuthEmail);

  if (existing) {
    userId = existing.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: ADMIN_USERNAME, nama_lengkap: ADMIN_NAMA },
    });
    if (error) fail(`Gagal memperbarui kredensial admin: ${error.message}`);
    console.log(`${c.yellow}  akun auth sudah ada; password dan profil auth diperbarui.${c.reset}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminAuthEmail,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { username: ADMIN_USERNAME, nama_lengkap: ADMIN_NAMA },
    });
    if (error || !data.user) fail(`Gagal membuat akun admin: ${error?.message}`);
    userId = data.user.id;
    console.log(`${c.green}  akun auth dibuat.${c.reset}`);
  }

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      username: ADMIN_USERNAME,
      nama_lengkap: ADMIN_NAMA,
      email_kerja: ADMIN_EMAIL,
      is_admin: true,
    },
    { onConflict: "id" }
  );
  if (upsertError) fail(`Gagal menyimpan profil admin: ${upsertError.message}`);

  console.log(`${c.green}✔ Admin siap — username ${c.bold}${ADMIN_USERNAME}${c.reset}${c.green}.${c.reset}`);
}

async function main() {
  console.log(`\n${c.bold}WARES — seed database${c.reset}`);
  console.log(`${c.dim}${SUPABASE_URL}${c.reset}\n`);

  await seedCatalog();
  await seedAdmin();

  console.log(`\n${c.green}${c.bold}Selesai.${c.reset}`);
  console.log(`Login admin: username ${c.bold}${ADMIN_USERNAME}${c.reset}, password dari ADMIN_PASSWORD di .env.local.`);
  console.log(`Lanjut: ${c.bold}npm run dev${c.reset} → http://localhost:3000\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
