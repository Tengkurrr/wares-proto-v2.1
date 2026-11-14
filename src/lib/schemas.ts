import { z } from "zod";

import { KATEGORI } from "@/lib/constants";

const username = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter.")
  .max(32, "Username maksimal 32 karakter.")
  .regex(/^PG[A-Z0-9._-]+$/i, 'Username wajib diawali "PG" dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.')
  .transform((value) => value.toUpperCase());

export const loginSchema = z.object({
  username,
  password: z.string().min(1, "Password wajib diisi.").max(128, "Password terlalu panjang."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    username,
    nama_lengkap: z.string().trim().min(3, "Nama lengkap wajib diisi.").max(100, "Nama lengkap maksimal 100 karakter."),
    no_hp: z
      .string()
      .trim()
      .regex(/^[0-9+()\s-]{8,20}$/, "Format nomor HP tidak valid.")
      .optional()
      .or(z.literal("")),
    email_kerja: z.string().trim().email("Format email tidak valid.").max(254, "Email terlalu panjang."),
    password: z.string().min(8, "Password minimal 8 karakter.").max(128, "Password terlalu panjang."),
    konfirmasi_password: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((v) => v.password === v.konfirmasi_password, {
    message: "Konfirmasi password tidak sama.",
    path: ["konfirmasi_password"],
  });

export type SignupValues = z.infer<typeof signupSchema>;

export const requestSchema = z.object({
  kategori: z.array(z.enum(KATEGORI)).min(1, "Pilih minimal satu jenis pekerjaan."),
  pekerjaan: z.string().trim().min(3, "Pekerjaan wajib diisi.").max(200, "Pekerjaan maksimal 200 karakter."),
  lokasi: z.string().trim().min(2, "Lokasi wajib dipilih.").max(120, "Lokasi maksimal 120 karakter."),
  // Penyerah dan penerima sama-sama diketik manual. Akun yang login hanya
  // menentukan HAK AKSES (admin/mekanik), bukan nama yang tercetak di surat.
  nama_penyerah: z.string().trim().min(2, "Nama penyerah wajib diisi.").max(120, "Nama penyerah maksimal 120 karakter."),
  nama_penerima: z.string().trim().min(2, "Nama penerima wajib diisi.").max(120, "Nama penerima maksimal 120 karakter."),
  items: z
    .array(
      z.object({
        catalog_item_id: z.number().int().nullable(),
        kode_barang: z
          .string()
          .trim()
          .max(100, "Kode barang maksimal 100 karakter.")
          .optional()
          .nullable()
          .transform((value) => value || null),
        kategori_barang: z.string().trim().max(120, "Kategori barang maksimal 120 karakter."),
        lokasi_barang: z.string().trim().max(120, "Lokasi barang maksimal 120 karakter."),
        nama_barang: z.string().trim().min(1, "Pilih barang.").max(200, "Nama barang maksimal 200 karakter."),
        satuan: z.string().trim().min(1, "Satuan belum terisi.").max(40, "Satuan maksimal 40 karakter."),
        stok_tersedia: z.coerce
          .number()
          .int("Stok harus berupa bilangan bulat.")
          .nonnegative("Stok tidak boleh negatif.")
          .max(1_000_000_000, "Nilai stok terlalu besar."),
        jumlah_permintaan: z.coerce
          .number()
          .int("Jumlah permintaan harus bilangan bulat.")
          .positive("Jumlah permintaan harus lebih dari 0.")
          .max(1_000_000_000, "Jumlah permintaan terlalu besar."),
        jumlah_diberikan: z.coerce
          .number()
          .int("Jumlah diberikan harus bilangan bulat.")
          .nonnegative("Jumlah diberikan tidak boleh negatif.")
          .max(1_000_000_000, "Jumlah diberikan terlalu besar."),
      })
    )
    .min(1, "Tambahkan minimal satu barang.")
    .max(50, "Maksimal 50 jenis barang dalam satu permintaan."),
}).superRefine((values, ctx) => {
  values.items.forEach((item, index) => {
    if (item.jumlah_diberikan > item.jumlah_permintaan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Jumlah diberikan tidak boleh melebihi jumlah permintaan.",
        path: ["items", index, "jumlah_diberikan"],
      });
    }
  });
});

export type RequestValues = z.infer<typeof requestSchema>;

const rackNumber = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int("Rack harus berupa angka bulat.").positive("Rack harus lebih dari 0.").max(1_000_000).nullable()
);

export const masterDataSchema = z.object({
  kategori: z.string().trim().max(120, "Kategori maksimal 120 karakter.").default(""),
  material_number: z.string().trim().min(1, "Material number wajib diisi.").max(100, "Material number maksimal 100 karakter."),
  rack: rackNumber,
  klasifikasi: z.string().trim().max(120, "Klasifikasi maksimal 120 karakter.").default(""),
  area: z.string().trim().min(1, "Area wajib dipilih.").max(120, "Area maksimal 120 karakter."),
  nama_barang: z.string().trim().min(1, "Nama barang wajib diisi.").max(200, "Nama barang maksimal 200 karakter."),
  lokasi: z.string().trim().max(120, "Lokasi maksimal 120 karakter.").default(""),
  status: z.enum(["AKTIF", "NONAKTIF"]).default("AKTIF"),
}).superRefine((value, ctx) => {
  if (value.rack == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nomor rack wajib dipilih.",
      path: ["rack"],
    });
  }
});

export type MasterDataValues = z.infer<typeof masterDataSchema>;
