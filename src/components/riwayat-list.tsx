import Link from "next/link";
import { Eye, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RingkasanRiwayat } from "@/lib/queries";
import { tanggalJamIndonesia } from "@/lib/utils";

/**
 * Daftar riwayat dalam dua bentuk: kartu di layar kecil dan tabel mulai md.
 * Tabel lengkap tidak terbaca kalau dipaksa digeser di layar ponsel.
 */
export function RiwayatList({
  daftar,
  isAdmin,
}: {
  daftar: RingkasanRiwayat[];
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {daftar.map((r) => {
          return (
            <div key={r.id} className="card-surface p-4">
              <div className="min-w-0">
                <div className="min-w-0">
                  <div className="font-semibold leading-snug text-ink">{r.pekerjaan}</div>
                  <div className="mt-0.5 text-sm text-muted">{r.lokasi_pekerjaan}</div>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Tanggal</dt>
                  <dd className="text-ink">{tanggalJamIndonesia(r.created_at)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Barang</dt>
                  <dd className="text-ink">{r.jumlah_item} jenis</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Diminta</dt>
                  <dd className="font-semibold text-ink">{r.total_permintaan.toLocaleString("id-ID")} unit</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Diberikan</dt>
                  <dd className="font-semibold text-brand-dark">{r.total_diberikan.toLocaleString("id-ID")} unit</dd>
                </div>
                {isAdmin ? (
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs text-muted">Pemohon</dt>
                    <dd className="text-ink">{r.nama_pemilik ?? "—"}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={`/riwayat/${r.id}`}>
                    <Eye className="h-4 w-4" />
                    Lihat
                  </Link>
                </Button>
                {isAdmin ? (
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/riwayat/${r.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-surface hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tanggal</TableHead>
              <TableHead>Pekerjaan</TableHead>
              <TableHead>Lokasi</TableHead>
              {isAdmin ? <TableHead>Pemohon</TableHead> : null}
              <TableHead className="text-center">Item</TableHead>
              <TableHead className="text-right">Diminta</TableHead>
              <TableHead className="text-right">Diberikan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((r) => {
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted">
                    {tanggalJamIndonesia(r.created_at)}
                  </TableCell>
                  <TableCell className="font-medium text-ink">{r.pekerjaan}</TableCell>
                  <TableCell className="text-muted">{r.lokasi_pekerjaan}</TableCell>
                  {isAdmin ? <TableCell className="text-muted">{r.nama_pemilik ?? "—"}</TableCell> : null}
                  <TableCell className="whitespace-nowrap text-center">
                    <span className="font-semibold">{r.jumlah_item}</span>
                    <span className="text-muted"> jenis</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {r.total_permintaan.toLocaleString("id-ID")} unit
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-brand-dark">
                    {r.total_diberikan.toLocaleString("id-ID")} unit
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/riwayat/${r.id}`}>
                          <Eye className="h-4 w-4" />
                          Lihat
                        </Link>
                      </Button>
                      {isAdmin ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/riwayat/${r.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
