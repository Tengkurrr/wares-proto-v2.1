/**
 * Sparkline batang mini untuk pemakaian mingguan. Dipilih batang (bukan garis)
 * karena demand sparepart mayoritas intermittent/lumpy — lonjakan jarang lebih
 * terbaca sebagai batang. Murni SVG, tanpa recharts, agar ringan di tabel.
 */
export function Sparkline({
  data,
  width = 140,
  height = 28,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const maks = Math.max(1, ...data);
  const n = data.length || 1;
  const gap = 1;
  const lebarBatang = (width - gap * (n - 1)) / n;

  return (
    <svg width={width} height={height} className="text-brand" aria-hidden>
      {data.map((v, i) => {
        const h = v <= 0 ? 0 : Math.max(1.5, (v / maks) * height);
        const x = i * (lebarBatang + gap);
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={lebarBatang}
            height={h}
            rx={0.5}
            fill="currentColor"
            opacity={v > 0 ? 0.85 : 0.15}
          />
        );
      })}
    </svg>
  );
}
