import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Supabase Auth is email-based; WARES users only ever type a username. */
export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@wares.local`;
}

const ZONA_WIB = "Asia/Jakarta";

function bagianWib(input: Date | string = new Date()) {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Kunci tanggal YYYY-MM-DD yang selalu dihitung dalam zona Asia/Jakarta. */
export function tanggalIsoWib(input: Date | string = new Date()) {
  const part = bagianWib(input);
  return `${part.year}-${part.month}-${part.day}`;
}

export function tanggalIndonesia(input: Date | string = new Date()) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ZONA_WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function tanggalJamIndonesia(input: Date | string) {
  const part = bagianWib(input);
  return `${tanggalIndonesia(input)}, ${part.hour}.${part.minute}`;
}

/** SPB-{username}-{YYYYMMDD-HHmm}.pdf */
export function namaFilePdf(username: string, at: Date = new Date()) {
  const part = bagianWib(at);
  const stamp = `${part.year}${part.month}${part.day}-${part.hour}${part.minute}`;
  return `SPB-${username}-${stamp}.pdf`;
}
