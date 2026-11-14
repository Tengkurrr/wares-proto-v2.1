"use client";

import { Component, type ReactNode } from "react";

/**
 * Batas error lokal untuk komponen klien yang rawan gagal (mis. runtime PDF).
 *
 * Tanpa ini, satu komponen yang melempar akan naik sampai `error.tsx` dan
 * mengganti SELURUH halaman dengan layar "Data belum berhasil dimuat" — padahal
 * sisa halaman baik-baik saja. Dengan ini, kegagalan dikurung di satu kotak kecil.
 */
type Props = {
  children: ReactNode;
  /** Ditampilkan menggantikan children saat terjadi error. */
  fallback: ReactNode;
  /** Label untuk log konsol, memudahkan menelusuri sumbernya. */
  label?: string;
};

type State = { gagal: boolean };

export class BatasError extends Component<Props, State> {
  state: State = { gagal: false };

  static getDerivedStateFromError(): State {
    return { gagal: true };
  }

  componentDidCatch(error: Error) {
    // Sengaja hanya dicatat: kegagalan di sini tidak boleh menjatuhkan halaman.
    console.error(`[WARES] ${this.props.label ?? "Komponen"} gagal dimuat:`, error);
  }

  render() {
    if (this.state.gagal) return this.props.fallback;
    return this.props.children;
  }
}
