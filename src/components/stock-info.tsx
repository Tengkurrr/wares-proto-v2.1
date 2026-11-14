"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PackageSearch, RefreshCw, Search } from "lucide-react";

import type { PilihanStok } from "@/components/item-combobox";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StockResponse = { items?: PilihanStok[]; generatedAt?: string };

function angka(nilai: number) {
  return nilai.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

export function StockInfo() {
  const permintaanAktif = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const waktuMuatTerakhirRef = useRef(0);
  const [items, setItems] = useState<PilihanStok[]>([]);
  const [query, setQuery] = useState("");
  const [kategori, setKategori] = useState("semua");
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waktuData, setWaktuData] = useState<Date | null>(null);

  const muat = useCallback(async (awal = false) => {
    if (permintaanAktif.current) return;
    permintaanAktif.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    awal ? setMemuat(true) : setMenyegarkan(true);
    setError(null);

    try {
      const response = await fetch("/api/stock", {
        cache: "no-store",
        signal: controller.signal,
      });
      const hasil = (await response.json().catch(() => null)) as
        | (StockResponse & { error?: string })
        | null;
      if (!response.ok) throw new Error(hasil?.error ?? "Gagal memuat informasi stok.");
      setItems(hasil?.items ?? []);
      const waktu = hasil?.generatedAt ? new Date(hasil.generatedAt) : new Date();
      setWaktuData(Number.isNaN(waktu.getTime()) ? new Date() : waktu);
      waktuMuatTerakhirRef.current = Date.now();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Gagal memuat informasi stok.");
    } finally {
      permintaanAktif.current = false;
      if (controllerRef.current === controller) controllerRef.current = null;
      if (!controller.signal.aborted) {
        setMemuat(false);
        setMenyegarkan(false);
      }
    }
  }, []);

  useEffect(() => {
    void muat(true);
    const interval = window.setInterval(() => {
      if (!document.hidden) void muat(false);
    }, 60_000);
    const saatTerlihat = () => {
      if (!document.hidden && Date.now() - waktuMuatTerakhirRef.current >= 60_000) {
        void muat(false);
      }
    };
    document.addEventListener("visibilitychange", saatTerlihat);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", saatTerlihat);
      controllerRef.current?.abort();
    };
  }, [muat]);

  const daftarKategori = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.kategori).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "id-ID")
      ),
    [items]
  );

  const hasil = useMemo(() => {
    const cari = query.trim().toLocaleLowerCase("id-ID");
    return items
      .filter((item) => kategori === "semua" || item.kategori === kategori)
      .filter((item) => {
        if (!cari) return true;
        return `${item.kode_barang ?? ""} ${item.nama_barang} ${item.kategori} ${item.lokasi} ${item.rack ?? ""} ${item.area ?? ""}`
          .toLocaleLowerCase("id-ID")
          .includes(cari);
      })
      .sort((a, b) => a.nama_barang.localeCompare(b.nama_barang, "id-ID"));
  }, [items, kategori, query]);

  if (memuat) {
    return (
      <div className="card-surface flex min-h-64 items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Membaca stok dari spreadsheet…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void muat(false)}>
          Coba lagi
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void muat(false)}>
            Coba lagi
          </Button>
        </Alert>
      ) : null}

      <div className="card-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="cari-stok" className="mb-1.5 block text-sm font-medium text-ink">
              Cari material
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="cari-stok"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama atau kode material…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="sm:w-60">
            <label className="mb-1.5 block text-sm font-medium text-ink">Kategori</label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger aria-label="Filter kategori stok">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua kategori</SelectItem>
                {daftarKategori.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void muat(false)}
            disabled={menyegarkan}
            className="sm:mb-0"
          >
            {menyegarkan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Perbarui
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span aria-live="polite">
            Menampilkan {hasil.length.toLocaleString("id-ID")} dari {items.length.toLocaleString("id-ID")} material.
          </span>
          {waktuData ? (
            <span>
              Diperbarui {waktuData.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" })} WIB
              . Otomatis setiap 60 detik saat halaman dibuka.
            </span>
          ) : null}
        </div>
      </div>

      {hasil.length === 0 ? (
        <div className="card-surface flex flex-col items-center px-4 py-12 text-center">
          <PackageSearch className="h-8 w-8 text-muted" />
          <h2 className="mt-3 text-base font-semibold">Material tidak ditemukan</h2>
          <p className="mt-1 text-sm text-muted">Coba ganti kata pencarian atau kategori.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {hasil.map((item, index) => (
              <article key={item.kode_barang ?? `${item.nama_barang}-${index}`} className="card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-snug text-ink">{item.nama_barang}</h2>
                    <p className="mt-0.5 text-xs text-muted">{item.kode_barang ?? "Tanpa kode"}</p>
                  </div>
                  <Badge
                    variant={item.stok > 0 ? "default" : "outline"}
                    className={item.stok <= 0 ? "border-destructive/30 text-destructive" : ""}
                  >
                    {item.stok > 0 ? "Tersedia" : "Habis"}
                  </Badge>
                </div>
                <div className="mt-4 text-2xl font-bold tabular-nums text-brand-dark">
                  {angka(item.stok)} <span className="text-sm font-semibold text-muted">{item.satuan}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Kategori</dt>
                    <dd className="mt-0.5 text-ink">{item.kategori || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Lokasi</dt>
                    <dd className="mt-0.5 text-ink">{item.lokasi || "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Rack / Area</dt>
                    <dd className="mt-0.5 text-ink">
                      {item.rack != null || item.area
                        ? `Rack ${item.rack ?? "—"} / ${item.area || "—"}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="card-surface hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Material</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Rack / Area</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hasil.map((item, index) => (
                  <TableRow key={item.kode_barang ?? `${item.nama_barang}-${index}`}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted">
                      {item.kode_barang ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-ink">{item.nama_barang}</TableCell>
                    <TableCell className="text-muted">{item.kategori || "—"}</TableCell>
                    <TableCell className="text-muted">{item.lokasi || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {item.rack != null || item.area
                        ? `Rack ${item.rack ?? "—"} / ${item.area || "—"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <span className={item.stok <= 0 ? "font-bold text-destructive" : "font-bold text-brand-dark"}>
                        {angka(item.stok)}
                      </span>{" "}
                      <span className="text-xs text-muted">{item.satuan}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
