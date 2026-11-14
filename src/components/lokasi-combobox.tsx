"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LOKASI } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Pemilih lokasi pekerjaan: ketik untuk mencari, lalu pilih dari daftar.
 * User tidak bisa mengetik lokasi bebas — hanya memilih dari opsi yang tersedia.
 * Untuk data lama, nilai yang tidak ada di daftar tetap dimunculkan agar tidak hilang saat edit.
 */
export function LokasiCombobox({
  value,
  onPilih,
  invalid,
}: {
  value: string;
  onPilih: (lokasi: string) => void;
  invalid?: boolean;
}) {
  const [buka, setBuka] = useState(false);

  const opsi = useMemo(() => {
    const daftar = [...LOKASI] as string[];
    // Nilai lama (mis. dari surat yang dibuat sebelum fitur ini) tetap valid & terpilih.
    if (value && !daftar.some((l) => l.toLowerCase() === value.toLowerCase())) {
      daftar.unshift(value);
    }
    return daftar;
  }, [value]);

  return (
    <Popover open={buka} onOpenChange={setBuka}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={buka}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal",
            !value && "text-muted",
            invalid && "border-destructive"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted" />
            <span className="truncate">{value || "Pilih lokasi…"}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari lokasi…" />
          <CommandList>
            <CommandEmpty>Lokasi tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {opsi.map((lokasi) => (
                <CommandItem
                  key={lokasi}
                  value={lokasi}
                  onSelect={() => {
                    onPilih(lokasi);
                    setBuka(false);
                  }}
                  className="items-center"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === lokasi ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{lokasi}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
