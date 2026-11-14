import type { RackOption } from "@/lib/master-data-types";

/** Salinan kanonik file RACK GUDANG.xlsx untuk jalur Postgres yang cepat. */
export const CANONICAL_RACKS: readonly RackOption[] = Object.freeze([
  { rack: 1, area: "CONSUMABLE" }, { rack: 2, area: "CONSUMABLE LAMPU" },
  { rack: 3, area: "LAMPU" }, { rack: 4, area: "CCTV" },
  { rack: 5, area: "GD 20 K" }, { rack: 6, area: "JT" }, { rack: 7, area: "JT" },
  { rack: 8, area: "GD 50 K" }, { rack: 9, area: "GD 50 K" },
  { rack: 10, area: "GD 20 K" }, { rack: 11, area: "PHONSKA 5" },
  { rack: 12, area: "PHONSKA 5" }, { rack: 13, area: "GD 50 K" },
  { rack: 14, area: "PHONSKA 4" }, { rack: 15, area: "PHONSKA 5" },
  { rack: 16, area: "PHONSKA 5" }, { rack: 17, area: "PHONSKA 4" },
  { rack: 18, area: "PHONSKA 2/3" }, { rack: 19, area: "PHONSKA 2/3" },
  { rack: 20, area: "PHONSKA 2/3" }, { rack: 21, area: "PHONSKA 2/3" },
  { rack: 22, area: "PHONSKA 2/3" }, { rack: 23, area: "PHONSKA 1" },
  { rack: 24, area: "PHONSKA 1" }, { rack: 25, area: "PHONSKA 1" },
  { rack: 26, area: "UREA 1B" }, { rack: 27, area: "UREA 1B" },
  { rack: 28, area: "UREA 1B" }, { rack: 29, area: "UREA 1B" },
  { rack: 30, area: "ZA" }, { rack: 31, area: "ZA" },
  { rack: 32, area: "UREA 1A" }, { rack: 33, area: "UREA 1A" },
  { rack: 34, area: "BAGGING MACHINE" }, { rack: 35, area: "BENGKEL LAS" },
  { rack: 36, area: "GD 50 K MEKANIK" }, { rack: 37, area: "GD 20 K MEKANIK" },
  { rack: 38, area: "PHONSKA 1 CONVEYOR SYSTEM" },
  { rack: 39, area: "PHONSKA 1 BAGGING SYSTEM" },
  { rack: 40, area: "PHONSKA 2/3 CONVEYOR SYSTEM" },
  { rack: 41, area: "PHONSKA 2/3 BAGGING SYSTEM" },
  { rack: 42, area: "PHONSKA 4 CONVEYOR SYSTEM" },
  { rack: 43, area: "PHONSKA 4 BAGGING SYSTEM" },
  { rack: 44, area: "PHONSKA 5 CONVEYOR SYSTEM" },
  { rack: 45, area: "PHONSKA 5 BAGGING" },
  { rack: 46, area: "UREA 1A" }, { rack: 47, area: "ZA" },
  { rack: 48, area: "UREA 1B" }, { rack: 49, area: "CONSUMABLE MEKANIK" },
  { rack: 50, area: "CONSUMABLE MEKANIK" },
]);

export function canonicalRackSelection(rack: number, area: string) {
  const selectedRack = CANONICAL_RACKS.find((item) => item.rack === rack) ?? null;
  const selectedArea = CANONICAL_RACKS.find(
    (item) => normalize_(item.area) === normalize_(area)
  )?.area ?? null;
  return { selectedRack, selectedArea };
}

function normalize_(value: string) {
  return value.trim().toLocaleUpperCase("id-ID");
}
