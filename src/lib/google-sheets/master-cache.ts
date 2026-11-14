import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

import { getMasterData, type MasterDataItem } from "./client";

const MASTER_DATA_TAG = "wares-master-data";

const bacaMasterDataTerCache = unstable_cache(
  async (): Promise<MasterDataItem[]> => (await getMasterData()).items,
  ["wares-master-data"],
  { revalidate: 60, tags: [MASTER_DATA_TAG] }
);

export function getCachedMasterData(): Promise<MasterDataItem[]> {
  return bacaMasterDataTerCache();
}

export function invalidateMasterDataCache() {
  try {
    revalidateTag(MASTER_DATA_TAG);
  } catch {
    // Cache hanya optimasi; CRUD utama tetap dianggap berhasil.
  }
}
