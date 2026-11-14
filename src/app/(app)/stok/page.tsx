import { StockInfo } from "@/components/stock-info";

export const metadata = { title: "Informasi Stok — WARES" };

export default function StokPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Informasi Stok</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Lihat jumlah material yang tersedia langsung dari database stok gudang.
        </p>
      </div>
      <StockInfo />
    </div>
  );
}
