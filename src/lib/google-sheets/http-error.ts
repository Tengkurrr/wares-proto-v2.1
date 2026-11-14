import "server-only";
import { NextResponse } from "next/server";

import { GoogleSheetsError } from "./client";

export function sheetsErrorResponse(error: unknown, fallback: string) {
  if (error instanceof GoogleSheetsError) {
    const status = error.code === "NOT_FOUND"
      ? 404
      : error.code === "DUPLICATE_MATERIAL" || error.code === "NO_EMPTY_SLOT"
        ? 409
        : ["INVALID_INPUT", "INVALID_RACK", "INVALID_AREA", "INVALID_SHEET"].includes(error.code)
          ? 400
          : ["NOT_CONFIGURED", "LOCK_TIMEOUT", "KPI_SHEET_MISSING"].includes(error.code)
            ? 503
            : 502;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
