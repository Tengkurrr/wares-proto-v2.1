import "server-only";

import {
  getInventoryDashboard,
  getInventoryDemand,
  getInventoryOpOrder,
  getInventoryOpRencana,
  getInventoryPm,
  getInventoryPola,
  getInventoryProyeksi,
  getInventoryRmHasil,
  GoogleSheetsError,
  isGoogleSheetsConfigured,
} from "@/lib/google-sheets/client";

import dashboardFixture from "./data/dashboard.json";
import demandFixture from "./data/demand.json";
import opOrderFixture from "./data/op-order.json";
import opRencanaFixture from "./data/op-rencana.json";
import pmOverhaulFixture from "./data/pm-overhaul.json";
import polaFixture from "./data/pola.json";
import proyeksiFixture from "./data/proyeksi.json";
import rmHasilFixture from "./data/rm-hasil.json";
import type {
  DashboardInventory,
  DataDemand,
  ItemRmHasil,
  OpOrder,
  OpRencana,
  PmOverhaul,
  PolaItem,
  ProyeksiStok,
  SumberData,
} from "./types";

export type { DashboardInventory, DataDemand, OpOrder, OpRencana, PmOverhaul, ProyeksiStok } from "./types";

/**
 * Sumber data inventory.
 *
 * Selama Google Sheet model belum di-deploy, website membaca fixture lokal yang
 * diekstrak dari workbook "WARES Reliability x Inventory Management.xlsx" — angka
 * nyata, cocok persis dengan Excel. Begitu Apps Script siap, cukup set
 * `INVENTORY_SOURCE=sheets` + `GOOGLE_SHEETS_API_URL/SECRET`; lapisan ini otomatis
 * beralih ke pembacaan live tanpa menyentuh halaman.
 */
function pakaiSheets(): boolean {
  return (
    process.env.INVENTORY_SOURCE?.trim().toLowerCase() === "sheets" &&
    isGoogleSheetsConfigured()
  );
}

export function sumberInventory(): SumberData {
  return pakaiSheets() ? "sheets" : "fixture";
}

export async function ambilDashboardInventory(): Promise<DashboardInventory> {
  if (pakaiSheets()) return getInventoryDashboard();
  return dashboardFixture as DashboardInventory;
}

export async function ambilRmHasil(): Promise<{ items: ItemRmHasil[] }> {
  if (pakaiSheets()) return getInventoryRmHasil();
  return rmHasilFixture as { items: ItemRmHasil[] };
}

/** Pola demand dari DATA_SKU TERPAKAI (relatif statis); ikut toggle sumber. */
export async function ambilPolaDemand(): Promise<{ items: PolaItem[] }> {
  if (pakaiSheets()) return getInventoryPola();
  return polaFixture as { items: PolaItem[] };
}

export async function ambilOpOrder(): Promise<OpOrder> {
  if (pakaiSheets()) return getInventoryOpOrder();
  return opOrderFixture as OpOrder;
}

export async function ambilOpRencana(): Promise<OpRencana> {
  if (pakaiSheets()) return getInventoryOpRencana();
  return opRencanaFixture as OpRencana;
}

export async function ambilPmOverhaul(): Promise<PmOverhaul> {
  if (pakaiSheets()) return getInventoryPm();
  return pmOverhaulFixture as PmOverhaul;
}

export async function ambilProyeksiStok(): Promise<ProyeksiStok> {
  if (pakaiSheets()) return getInventoryProyeksi();
  return proyeksiFixture as ProyeksiStok;
}

export async function ambilDataDemand(): Promise<DataDemand> {
  if (pakaiSheets()) return getInventoryDemand();
  return demandFixture as DataDemand;
}

/** Varian tahan-error untuk halaman: tidak pernah melempar ke SSR. */
export async function ambilDashboardInventoryAman(): Promise<
  | { ok: true; data: DashboardInventory; sumber: SumberData }
  | { ok: false; kode: string; pesan: string }
> {
  try {
    const data = await ambilDashboardInventory();
    return { ok: true, data, sumber: sumberInventory() };
  } catch (error) {
    if (error instanceof GoogleSheetsError) {
      return { ok: false, kode: error.code, pesan: error.message };
    }
    console.error("Gagal memuat dashboard inventory", error);
    return { ok: false, kode: "UNKNOWN", pesan: "Data inventory tidak dapat dimuat saat ini." };
  }
}
