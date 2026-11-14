"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Eye, Info, Loader2, PackageCheck, Plus, RefreshCw, Trash2 } from "lucide-react";

import { FieldError } from "@/components/field-error";
import { ItemCombobox, type PilihanStok } from "@/components/item-combobox";
import { KategoriPicker } from "@/components/kategori-picker";
import { LokasiCombobox } from "@/components/lokasi-combobox";
import {
  bacaOperasiPermintaanTertunda,
  hapusOperasiPermintaanTertunda,
  PreviewPanel,
  type PendingRequestRecovery,
} from "@/components/preview-panel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestSchema, type RequestValues } from "@/lib/schemas";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const BARIS_KOSONG = {
  catalog_item_id: null,
  kode_barang: null,
  nama_barang: "",
  kategori_barang: "",
  lokasi_barang: "",
  satuan: "",
  stok_tersedia: 0,
  jumlah_permintaan: 1,
  jumlah_diberikan: 1,
};

export type NilaiAwal = {
  requestId: string;
  pekerjaan: string;
  lokasi: string;
  kategori: string[];
  /** Nama penyerah barang (petugas), diisi manual. */
  nama_penyerah: string;
  /** Nama penerima barang (karyawan), diisi manual. */
  nama_penerima: string;
  tanggal: string;
  items: {
    catalog_item_id: number | null;
    kode_barang: string | null;
    nama_barang: string;
    kategori_barang: string;
    lokasi_barang: string;
    satuan: string;
    stok_tersedia: number;
    jumlah_permintaan: number;
    jumlah_diberikan: number;
  }[];
};

type StockResponse = { items?: PilihanStok[]; error?: string };

export function RequisitionForm({ profile, awal }: { profile: Profile; awal?: NilaiAwal }) {
  const [dataPreview, setDataPreview] = useState<RequestValues | null>(null);
  const [operasiDipulihkan, setOperasiDipulihkan] =
    useState<PendingRequestRecovery | null>(null);
  const [memeriksaOperasiTersimpan, setMemeriksaOperasiTersimpan] = useState(true);
  const [versiMuatStok, setVersiMuatStok] = useState(0);
  const [memuatStokEdit, setMemuatStokEdit] = useState(Boolean(awal));
  const [errorStokEdit, setErrorStokEdit] = useState<string | null>(null);

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: awal
      ? {
          kategori: awal.kategori as RequestValues["kategori"],
          pekerjaan: awal.pekerjaan,
          lokasi: awal.lokasi,
          nama_penyerah: awal.nama_penyerah,
          nama_penerima: awal.nama_penerima,
          items: awal.items,
        }
      : {
          kategori: [],
          pekerjaan: "",
          lokasi: "",
          nama_penyerah: "",
          nama_penerima: "",
          items: [{ ...BARIS_KOSONG }],
        },
    mode: "onSubmit",
  });

  const {
    control,
    register,
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const kategoriTerpilih = watch("kategori") ?? [];
  const nilaiItems = watch("items") ?? [];

  const diberikanAwal = useMemo(() => {
    const hasil = new Map<string, number>();
    for (const item of awal?.items ?? []) {
      const kunci = item.kode_barang ?? item.nama_barang;
      hasil.set(kunci, (hasil.get(kunci) ?? 0) + item.jumlah_diberikan);
    }
    return hasil;
  }, [awal]);

  useEffect(() => {
    const tersimpan = bacaOperasiPermintaanTertunda(profile.id, awal?.requestId);
    if (tersimpan) {
      const parsed = requestSchema.safeParse(tersimpan.payload);
      if (parsed.success) {
        const dipulihkan = { ...tersimpan, payload: parsed.data };
        reset(parsed.data);
        setOperasiDipulihkan(dipulihkan);
        setDataPreview(parsed.data);
      } else {
        hapusOperasiPermintaanTertunda(profile.id, awal?.requestId);
      }
    }
    setMemeriksaOperasiTersimpan(false);
  }, [awal?.requestId, profile.id, reset]);

  // Form baru memperoleh stok ketika material dipilih. Mode edit perlu satu
  // snapshot awal karena data tersimpan tidak membawa stok terkini. Tidak ada
  // polling saat pengguna mengisi atau menyimpan, sehingga request stok tidak
  // berebut dengan transaksi KELUAR yang sedang diproses.
  useEffect(() => {
    if (!awal || dataPreview || memeriksaOperasiTersimpan) return;

    const controller = new AbortController();
    async function segarkanStok() {
      setMemuatStokEdit(true);
      setErrorStokEdit(null);
      try {
        const response = await fetch("/api/stock", {
          cache: "no-store",
          signal: controller.signal,
        });
        const hasil = (await response.json().catch(() => null)) as StockResponse | null;
        if (!response.ok) {
          throw new Error(hasil?.error ?? "Stok terbaru belum dapat dimuat.");
        }
        const peta = new Map<string, PilihanStok>();
        for (const item of hasil?.items ?? []) {
          if (item.kode_barang) peta.set(item.kode_barang, item);
          peta.set(item.nama_barang, item);
        }

        let materialTidakDitemukan = false;
        getValues("items").forEach((item, index) => {
          const terbaru = peta.get(item.kode_barang ?? item.nama_barang);
          if (!terbaru) {
            materialTidakDitemukan = true;
            return;
          }
          setValue(`items.${index}.stok_tersedia`, terbaru.stok);
          if (terbaru.kode_barang) setValue(`items.${index}.kode_barang`, terbaru.kode_barang);
          setValue(`items.${index}.kategori_barang`, terbaru.kategori);
          setValue(`items.${index}.lokasi_barang`, terbaru.lokasi);
        });

        if (materialTidakDitemukan) {
          throw new Error(
            "Ada material lama yang tidak ditemukan pada stok terbaru. Pilih ulang material tersebut."
          );
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorStokEdit(
          error instanceof Error ? error.message : "Stok terbaru belum dapat dimuat."
        );
      } finally {
        if (!controller.signal.aborted) setMemuatStokEdit(false);
      }
    }

    void segarkanStok();
    return () => controller.abort();
  }, [awal, dataPreview, getValues, memeriksaOperasiTersimpan, setValue, versiMuatStok]);

  function onPreview(values: RequestValues) {
    const totalPerBarang = new Map<string, number>();
    for (const item of values.items) {
      const kunci = item.kode_barang ?? item.nama_barang;
      totalPerBarang.set(kunci, (totalPerBarang.get(kunci) ?? 0) + item.jumlah_diberikan);
    }

    let stokValid = true;
    values.items.forEach((item, index) => {
      const kunci = item.kode_barang ?? item.nama_barang;
      const batas = item.stok_tersedia + (diberikanAwal.get(kunci) ?? 0);
      if ((totalPerBarang.get(kunci) ?? 0) > batas) {
        stokValid = false;
        setError(`items.${index}.jumlah_diberikan`, {
          type: "validate",
          message: `Jumlah diberikan melampaui stok tersedia (${batas.toLocaleString("id-ID")} ${item.satuan}).`,
        });
      }
    });
    if (!stokValid) return;

    setDataPreview(values);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (memeriksaOperasiTersimpan) {
    return (
      <Alert variant="info" className="flex items-center gap-3" aria-live="polite">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        Memeriksa apakah ada transaksi sebelumnya yang belum selesai…
      </Alert>
    );
  }

  if (dataPreview) {
    return (
      <PreviewPanel
        data={dataPreview}
        requestId={awal?.requestId}
        tanggal={awal?.tanggal}
        actorId={profile.id}
        operasiDipulihkan={operasiDipulihkan ?? undefined}
        onKembali={() => {
          setOperasiDipulihkan(null);
          setDataPreview(null);
        }}
        onBuangPemulihan={() => {
          // Bersihkan catatan pemulihan yang macet lalu kembali ke form. Data
          // yang tampil tetap ada agar bisa langsung dikirim ulang sebagai transaksi baru.
          hapusOperasiPermintaanTertunda(profile.id, awal?.requestId);
          setOperasiDipulihkan(null);
          setDataPreview(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onPreview)} className="space-y-6" noValidate>
      <div>
        <h1>{awal ? "Edit Permintaan" : "Buat Permintaan"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          Surat Pengambilan Barang — Departemen Pergudangan &amp; Pengantongan.
        </p>
      </div>

      {awal && memuatStokEdit ? (
        <Alert variant="info" className="flex items-center gap-3" aria-live="polite">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          Memuat stok terbaru untuk permintaan yang akan diedit…
        </Alert>
      ) : null}

      {awal && errorStokEdit ? (
        <Alert variant="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{errorStokEdit}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVersiMuatStok((nilai) => nilai + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Muat ulang stok
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            1. Jenis Pekerjaan <span className="text-destructive">*</span>
          </CardTitle>
          <CardDescription>
            Pilih satu atau lebih. Pilihan ini juga menyaring daftar barang di bawah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="kategori"
            render={({ field }) => (
              <KategoriPicker
                terpilih={field.value ?? []}
                onChange={(next) => field.onChange(next)}
                invalid={Boolean(errors.kategori)}
              />
            )}
          />
          <FieldError pesan={errors.kategori?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Detail Pengambilan</CardTitle>
          <CardDescription>
            Isi nama petugas yang menyerahkan barang dan nama karyawan yang menerimanya. Keduanya
            ditulis manual dan akan tercetak pada surat.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="pekerjaan">
              Pekerjaan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pekerjaan"
              placeholder="Perbaikan conveyor belt"
              className="mt-1.5"
              aria-invalid={Boolean(errors.pekerjaan)}
              {...register("pekerjaan")}
            />
            <FieldError pesan={errors.pekerjaan?.message} />
          </div>
          <div>
            <Label htmlFor="lokasi">
              Lokasi pekerjaan <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <Controller
                control={control}
                name="lokasi"
                render={({ field }) => (
                  <LokasiCombobox
                    value={field.value}
                    onPilih={(lokasi) => field.onChange(lokasi)}
                    invalid={Boolean(errors.lokasi)}
                  />
                )}
              />
            </div>
            <FieldError pesan={errors.lokasi?.message} />
          </div>
          <div>
            <Label htmlFor="nama_penyerah">
              Nama penyerah <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nama_penyerah"
              placeholder="Nama petugas yang menyerahkan barang"
              className="mt-1.5"
              aria-invalid={Boolean(errors.nama_penyerah)}
              {...register("nama_penyerah")}
            />
            <FieldError pesan={errors.nama_penyerah?.message} />
          </div>
          <div>
            <Label htmlFor="nama_penerima">
              Nama penerima / PIC <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nama_penerima"
              placeholder="Nama karyawan yang menerima barang"
              className="mt-1.5"
              aria-invalid={Boolean(errors.nama_penerima)}
              {...register("nama_penerima")}
            />
            <FieldError pesan={errors.nama_penerima?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            3. Daftar Barang{" "}
            <span className="ml-1 align-middle text-sm font-normal text-muted">
              ({fields.length} baris)
            </span>
          </CardTitle>
          <CardDescription>
            Stok dimuat saat material dipilih dan divalidasi kembali ketika disimpan. Jumlah diberikan
            tidak boleh melebihi permintaan atau stok tersedia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kategoriTerpilih.length === 0 ? (
            <Alert variant="info" className="mb-5 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Pilih jenis pekerjaan dulu untuk membuka daftar barang.</span>
            </Alert>
          ) : null}

          <div className="hidden gap-3 border-b border-border pb-2 lg:grid lg:grid-cols-[2rem_minmax(13rem,1fr)_5.5rem_7.5rem_7.25rem_7.25rem_2.5rem]">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">No</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Nama Barang</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Satuan</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Stok</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Permintaan</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Diberikan</div>
            <div />
          </div>

          <div className="divide-y divide-border lg:divide-y-0">
            {fields.map((field, index) => {
              const errItem = errors.items?.[index];
              const item = nilaiItems[index];
              const stok = Number(item?.stok_tersedia ?? 0);
              const permintaan = Number(item?.jumlah_permintaan ?? 0);
              const kunciItem = item?.kode_barang ?? item?.nama_barang ?? "";
              const stokUntukEdit = stok + (diberikanAwal.get(kunciItem) ?? 0);
              const dipakaiBarisLain = nilaiItems.reduce((total, baris, posisi) => {
                const kunciBaris = baris?.kode_barang ?? baris?.nama_barang ?? "";
                return posisi !== index && kunciBaris === kunciItem
                  ? total + Number(baris?.jumlah_diberikan ?? 0)
                  : total;
              }, 0);
              const batasDiberikan = Math.max(
                0,
                Math.min(permintaan || 0, stokUntukEdit - dipakaiBarisLain)
              );

              return (
                <div
                  key={field.id}
                  className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-[2rem_minmax(13rem,1fr)_5.5rem_7.5rem_7.25rem_7.25rem_2.5rem] lg:items-start lg:gap-3 lg:py-3"
                >
                  <div className="hidden pt-2.5 text-sm font-medium text-muted lg:block">{index + 1}</div>

                  <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                    <Label className="mb-1.5 block lg:hidden">Barang {index + 1}</Label>
                    <Controller
                      control={control}
                      name={`items.${index}.nama_barang`}
                      render={({ field: namaField }) => (
                        <ItemCombobox
                          value={namaField.value}
                          kategoriTerpilih={kategoriTerpilih}
                          invalid={Boolean(errItem?.nama_barang)}
                          onPilih={(pilihan) => {
                            const jumlahPermintaan = Math.max(
                              1,
                              Number(getValues(`items.${index}.jumlah_permintaan`) ?? 1)
                            );
                            setValue(`items.${index}.nama_barang`, pilihan.nama_barang, {
                              shouldValidate: true,
                            });
                            setValue(`items.${index}.satuan`, pilihan.satuan, { shouldValidate: true });
                            setValue(`items.${index}.catalog_item_id`, pilihan.id ?? null);
                            setValue(`items.${index}.kode_barang`, pilihan.kode_barang);
                            setValue(`items.${index}.kategori_barang`, pilihan.kategori);
                            setValue(`items.${index}.lokasi_barang`, pilihan.lokasi);
                            setValue(`items.${index}.stok_tersedia`, pilihan.stok, {
                              shouldValidate: true,
                            });
                            setValue(
                              `items.${index}.jumlah_diberikan`,
                              Math.min(jumlahPermintaan, Math.max(0, pilihan.stok)),
                              { shouldValidate: true }
                            );
                          }}
                        />
                      )}
                    />
                    <FieldError pesan={errItem?.nama_barang?.message} />
                    {item?.kode_barang ? (
                      <p className="mt-1 text-xs text-muted">Kode: {item.kode_barang}</p>
                    ) : null}
                  </div>

                  <div>
                    <Label className="mb-1.5 block lg:hidden">Satuan</Label>
                    <Input
                      readOnly
                      tabIndex={-1}
                      placeholder="—"
                      className="cursor-default bg-bg text-muted"
                      {...register(`items.${index}.satuan`)}
                    />
                    <FieldError pesan={errItem?.satuan?.message} />
                  </div>

                  <div>
                    <Label className="mb-1.5 block lg:hidden">Stok tersedia</Label>
                    <div
                      className={cn(
                        "flex h-10 items-center gap-1.5 rounded-lg border border-border bg-bg px-3 text-sm font-semibold tabular-nums",
                        item?.nama_barang && stok <= 0 ? "text-destructive" : "text-brand-dark"
                      )}
                      aria-label={`Stok tersedia ${stok} ${item?.satuan ?? ""}`}
                    >
                      <PackageCheck className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item?.nama_barang ? stok.toLocaleString("id-ID") : "—"}</span>
                    </div>
                    <FieldError pesan={errItem?.stok_tersedia?.message} />
                  </div>

                  <div>
                    <Label className="mb-1.5 block lg:hidden">Jumlah permintaan</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      aria-label={`Jumlah permintaan barang ${index + 1}`}
                      aria-invalid={Boolean(errItem?.jumlah_permintaan)}
                      {...register(`items.${index}.jumlah_permintaan`)}
                    />
                    <FieldError pesan={errItem?.jumlah_permintaan?.message} />
                  </div>

                  <div>
                    <Label className="mb-1.5 block lg:hidden">Jumlah diberikan</Label>
                    <Input
                      type="number"
                      min={0}
                      max={batasDiberikan}
                      step={1}
                      inputMode="numeric"
                      aria-label={`Jumlah diberikan barang ${index + 1}`}
                      aria-invalid={Boolean(errItem?.jumlah_diberikan)}
                      aria-describedby={`batas-diberikan-${index}`}
                      {...register(`items.${index}.jumlah_diberikan`)}
                    />
                    <p id={`batas-diberikan-${index}`} className="mt-1 text-xs text-muted">
                      Maks. {batasDiberikan.toLocaleString("id-ID")}
                    </p>
                    <FieldError pesan={errItem?.jumlah_diberikan?.message} />
                  </div>

                  <div className="flex sm:col-span-2 lg:col-span-1 lg:pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Hapus baris ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                      className="h-10 w-full px-3 text-muted hover:bg-destructive/10 hover:text-destructive lg:w-10 lg:px-0"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="lg:hidden">Hapus baris</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {errors.items?.message ? <FieldError pesan={errors.items.message} /> : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({ ...BARIS_KOSONG })}
            className="mt-4"
          >
            <Plus className="h-4 w-4" />
            Tambah Barang
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          size="lg"
          className="sm:min-w-44"
          disabled={Boolean(awal && (memuatStokEdit || errorStokEdit))}
        >
          {memuatStokEdit ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {memuatStokEdit ? "Memuat Stok…" : "Preview"}
        </Button>
      </div>
    </form>
  );
}
