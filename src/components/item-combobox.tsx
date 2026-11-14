"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const BATAS = 75;
const STOCK_CACHE_MS = 15_000;

export type PilihanStok = {
  id?: number;
  kode_barang: string | null;
  nama_barang: string;
  kategori: string;
  lokasi: string;
  satuan: string;
  stok: number;
  rack?: number | null;
  area?: string;
};

type StockResponse = { items?: PilihanStok[] };

let cacheStok: { items: PilihanStok[]; disimpanPada: number } | null = null;
let permintaanStokAktif: Promise<PilihanStok[]> | null = null;

function stokCacheSegar() {
  return cacheStok && Date.now() - cacheStok.disimpanPada < STOCK_CACHE_MS
    ? cacheStok.items
    : null;
}

async function ambilStok() {
  const tersimpan = stokCacheSegar();
  if (tersimpan) return tersimpan;
  if (permintaanStokAktif) return permintaanStokAktif;

  const permintaan = fetch("/api/stock", { cache: "no-store" }).then(async (response) => {
    const hasil = (await response.json().catch(() => null)) as
      | (StockResponse & { error?: string })
      | null;
    if (!response.ok) throw new Error(hasil?.error ?? "Gagal memuat stok.");
    const items = hasil?.items ?? [];
    cacheStok = { items, disimpanPada: Date.now() };
    return items;
  });

  permintaanStokAktif = permintaan;
  try {
    return await permintaan;
  } finally {
    if (permintaanStokAktif === permintaan) permintaanStokAktif = null;
  }
}

export function ItemCombobox({
  value,
  kategoriTerpilih,
  onPilih,
  invalid,
  semuaKategori = false,
}: {
  value: string;
  kategoriTerpilih: string[];
  onPilih: (item: PilihanStok) => void;
  invalid?: boolean;
  semuaKategori?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PilihanStok[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [gagal, setGagal] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  const nonaktif = !semuaKategori && kategoriTerpilih.length === 0;

  // Semua combobox berbagi snapshot singkat dan satu request aktif. Membuka
  // beberapa baris berturut-turut tidak lagi memanggil endpoint stok berulang.
  useEffect(() => {
    if (!buka || nonaktif) return;

    let dibatalkan = false;
    const tersimpan = stokCacheSegar();
    if (tersimpan) {
      setItems(tersimpan);
      setMemuat(false);
      setGagal(false);
      return;
    }

    setMemuat(true);
    setGagal(false);

    void ambilStok()
      .then((hasil) => {
        if (!dibatalkan) setItems(hasil);
      })
      .catch(() => {
        if (!dibatalkan) setGagal(true);
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });

    return () => {
      dibatalkan = true;
    };
  }, [buka, nonaktif, percobaan]);

  const hasil = useMemo(() => {
    const kategori = new Set(kategoriTerpilih.map((item) => item.toLocaleLowerCase("id-ID")));
    const cari = query.trim().toLocaleLowerCase("id-ID");

    return items
      .filter(
        (item) => semuaKategori || kategori.has(item.kategori.toLocaleLowerCase("id-ID"))
      )
      .filter((item) => {
        if (!cari) return true;
        return `${item.kode_barang ?? ""} ${item.nama_barang} ${item.rack ?? ""} ${item.area ?? ""}`
          .toLocaleLowerCase("id-ID")
          .includes(cari);
      })
      .sort((a, b) => a.nama_barang.localeCompare(b.nama_barang, "id-ID"))
      .slice(0, BATAS);
  }, [items, kategoriTerpilih, query, semuaKategori]);

  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={buka}
          disabled={nonaktif}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal",
            !value && "text-muted",
            invalid && "border-destructive"
          )}
        >
          <span className="truncate text-left">
            {value || (nonaktif ? "Pilih jenis pekerjaan dulu" : "Cari nama atau kode barang…")}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(34rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ketik nama atau kode barang…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {memuat ? (
              <div className="flex items-center justify-center gap-2 py-7 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat stok terbaru…
              </div>
            ) : gagal ? (
              <div className="px-4 py-6 text-center text-sm text-destructive">
                <RefreshCw className="mx-auto mb-2 h-4 w-4" />
                <p>Stok belum dapat dimuat.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setPercobaan((nilai) => nilai + 1)}
                >
                  <RefreshCw aria-hidden="true" />
                  Coba lagi
                </Button>
              </div>
            ) : hasil.length === 0 ? (
              <CommandEmpty>
                {query.trim()
                  ? `Tidak ada barang cocok dengan "${query.trim()}".`
                  : "Tidak ada barang pada kategori terpilih."}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {hasil.map((item, index) => (
                  <CommandItem
                    key={item.kode_barang ?? `${item.nama_barang}-${index}`}
                    value={item.kode_barang ?? item.nama_barang}
                    onSelect={() => {
                      onPilih(item);
                      setBuka(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === item.nama_barang ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{item.nama_barang}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.kode_barang ? `${item.kode_barang} · ` : ""}
                        {item.kategori} · {item.lokasi} · {item.satuan}
                        {item.rack != null || item.area
                          ? ` · Rack ${item.rack ?? "—"} / ${item.area || "—"}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "ml-3 shrink-0 rounded-full px-2 py-1 text-xs font-semibold tabular-nums",
                        item.stok > 0
                          ? "bg-brand-light text-brand-dark"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      Stok {item.stok.toLocaleString("id-ID")} {item.satuan}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {!memuat && !gagal && hasil.length >= BATAS ? (
            <div className="border-t border-border px-3 py-2 text-xs text-muted">
              Menampilkan {BATAS} hasil teratas — persempit pencarian bila barang belum terlihat.
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
