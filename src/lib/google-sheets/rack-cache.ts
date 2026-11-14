import "server-only";
import { unstable_cache } from "next/cache";

import { getRackOptions, type RackOption } from "./client";

const bacaRackTerCache = unstable_cache(
  async (): Promise<RackOption[]> => (await getRackOptions()).items,
  ["wares-rack-options"],
  { revalidate: 300 }
);

export function getCachedRackOptions(): Promise<RackOption[]> {
  return bacaRackTerCache();
}
