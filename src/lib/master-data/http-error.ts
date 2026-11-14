import "server-only";
import { NextResponse } from "next/server";

import { KesalahanMaster } from "./source";

/**
 * Memetakan kesalahan tulis Master Data (Postgres) ke status HTTP.
 *
 * Berkas terpisah karena Next.js hanya mengizinkan ekspor tertentu dari berkas
 * `route.ts` (GET/POST/…); helper apa pun yang diekspor dari sana akan gagal
 * type-check.
 */
export function responsKesalahanMaster(error: unknown, fallback: string) {
  if (error instanceof KesalahanMaster) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "DUPLICATE_MATERIAL"
          ? 409
          : [
                "MASTER_SOURCE_NOT_CONFIGURED",
                "MASTER_SCHEMA_NOT_READY",
                "MASTER_ACCESS_DENIED",
                "MASTER_DATA_EMPTY",
                "DB_ERROR",
              ].includes(error.code)
            ? 503
            : 500;
    if (status >= 500) console.error(fallback, error);
    return NextResponse.json(
      { error: error.message, code: error.code, diagnostics: error.diagnostics },
      { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
