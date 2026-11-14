"use client";

import type { RequestValues } from "@/lib/schemas";

type ResponsApi = { id?: string; error?: string };

async function bacaRespons(response: Response): Promise<ResponsApi> {
  try {
    return (await response.json()) as ResponsApi;
  } catch {
    return {};
  }
}

/**
 * Simpan permintaan melalui server. `userId` sengaja tidak dikirim ke API:
 * identitas pemohon selalu diambil dari sesi agar tidak dapat dipalsukan.
 */
export async function simpanPermintaanBaru(
  _userId: string,
  values: RequestValues,
  idempotencyKey?: string
): Promise<string> {
  const response = await fetch("/api/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(values),
  });
  const body = await bacaRespons(response);

  if (!response.ok || !body.id) {
    throw new Error(body.error ?? "Gagal menyimpan permintaan.");
  }

  return body.id;
}

/** Perbarui permintaan melalui endpoint yang memverifikasi akses admin. */
export async function perbaruiPermintaan(requestId: string, values: RequestValues): Promise<string> {
  const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = await bacaRespons(response);

  if (!response.ok || !body.id) {
    throw new Error(body.error ?? "Gagal memperbarui permintaan.");
  }

  return body.id;
}
