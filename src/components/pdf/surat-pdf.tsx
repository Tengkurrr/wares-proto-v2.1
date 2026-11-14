"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { KATEGORI } from "@/lib/constants";
import type { SuratData } from "@/lib/types";

/**
 * Surat Pengambilan Barang — meniru layout form cetak
 * "FORM PENGAMBILAN BARANG 2026" milik Dept. Pergudangan & Pengantongan.
 *
 * Tabel barang wrap otomatis ke halaman berikutnya dengan header tabel berulang.
 */

const HITAM = "#000000";
const ABU = "#555555";

const styles = StyleSheet.create({
  page: {
    // paddingTop menyediakan ruang untuk kop yang di-pin (fixed tidak memesan ruang
    // di halaman kedua dan seterusnya, jadi kop dibuat absolute lalu diberi jarak di sini).
    paddingTop: 104,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: HITAM,
  },

  // ----- Kop surat -----
  kop: {
    position: "absolute",
    top: 32,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  // Mengikuti kop template cetak: logo Petrokimia lengkap di atas,
  // nama departemen sebaris penuh di bawahnya (bukan berdampingan).
  kopKiri: { width: 260 },
  logo: { width: 110, height: 48.5, marginBottom: 5 },
  kopKiriTeks: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  kopKanan: { width: 210 },
  kopKananBaris: {
    borderBottomWidth: 0.7,
    borderBottomColor: HITAM,
    paddingBottom: 1.5,
    marginBottom: 2.5,
  },
  kopKananLabel: { fontSize: 8.5 },
  kopKananTebal: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // ----- Judul -----
  judulBlok: { alignItems: "center" },
  judul: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textDecoration: "underline",
    letterSpacing: 0.3,
  },
  subjudul: { fontSize: 9, marginTop: 3 },

  // ----- Pekerjaan & lokasi -----
  barisPekerjaan: { marginTop: 16, flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" },
  labelPekerjaan: { fontSize: 9 },
  isiPekerjaan: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 0.7,
    borderBottomColor: HITAM,
    borderBottomStyle: "dotted",
    paddingHorizontal: 3,
    paddingBottom: 1,
  },

  // ----- Baris checkbox kategori -----
  barisKategori: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 5,
  },
  kategoriItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "20%",
    paddingRight: 4,
  },
  kotak: {
    width: 8,
    height: 8,
    borderWidth: 0.7,
    borderColor: HITAM,
    marginRight: 3.5,
    alignItems: "center",
    justifyContent: "center",
  },
  // Kotak dicentang digambar sebagai blok isi, bukan glyph — tetap terbaca saat difotokopi.
  centang: { width: 4.4, height: 4.4, backgroundColor: HITAM },
  kategoriLabel: { fontSize: 6.6 },
  kategoriLabelAktif: { fontSize: 6.6, fontFamily: "Helvetica-Bold" },

  // ----- Tabel -----
  // Garis tepi tabel diambil dari sel, bukan dari kotak pembungkus: kalau memakai
  // border pembungkus, sisa kotaknya ikut tergambar sampai batas halaman saat tabel terpotong.
  tabel: { marginTop: 12 },
  headRow: {
    flexDirection: "row",
    borderTopWidth: 0.7,
    borderTopColor: HITAM,
    borderBottomWidth: 0.7,
    borderBottomColor: HITAM,
  },
  headKiri: { flexDirection: "row" },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingVertical: 4,
  },
  thJumlahAtas: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingVertical: 3,
    borderBottomWidth: 0.7,
    borderBottomColor: HITAM,
  },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: HITAM },
  rowTerakhir: { flexDirection: "row", borderBottomWidth: 0.7, borderBottomColor: HITAM },

  colNo: {
    width: 26,
    borderLeftWidth: 0.7,
    borderLeftColor: HITAM,
    borderRightWidth: 0.7,
    borderRightColor: HITAM,
    justifyContent: "center",
  },
  colNama: { flex: 1, borderRightWidth: 0.7, borderRightColor: HITAM, justifyContent: "center" },
  colSatuan: { width: 58, borderRightWidth: 0.7, borderRightColor: HITAM, justifyContent: "center" },
  colJumlah: { width: 176 },
  colPermintaan: { width: 88, borderRightWidth: 0.7, borderRightColor: HITAM, justifyContent: "center" },
  colDiberikan: { width: 88, borderRightWidth: 0.7, borderRightColor: HITAM, justifyContent: "center" },

  sel: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 5 },
  selTengah: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 3, textAlign: "center" },
  selAngka: { fontSize: 8.5, paddingVertical: 4, textAlign: "center" },

  // ----- Penutup & tanda tangan -----
  // Blok penutup+tanda tangan dijaga tetap ringkas: kalau terlalu tinggi ia tidak
  // muat di sisa halaman terakhir dan terlempar sendirian ke halaman baru.
  penutup: { marginTop: 12, fontSize: 9 },
  ttdBlok: { marginTop: 16, flexDirection: "row", justifyContent: "space-between" },
  ttdKolom: { width: 200 },
  ttdKolomKanan: { width: 200, alignItems: "flex-start" },
  ttdTanggal: { fontSize: 9, marginBottom: 4 },
  ttdLabel: { fontSize: 9 },
  ttdGaris: {
    marginTop: 36,
    borderTopWidth: 0.7,
    borderTopColor: HITAM,
    width: 165,
    paddingTop: 3,
  },
  ttdNama: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  ttdKosong: { fontSize: 7.5, color: ABU },

  nomorHalaman: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 7.5,
    color: ABU,
  },

  // ----- Watermark -----
  // A4 = 595.28 x 841.89 pt. Logo 380pt ditaruh persis di tengah halaman.
  // `fixed` membuatnya berulang di setiap halaman, dan karena ia elemen PERTAMA
  // di dalam Page, seluruh isi surat tergambar di atasnya.
  watermark: {
    position: "absolute",
    width: 380,
    height: 380,
    left: (595.28 - 380) / 2,
    top: (841.89 - 380) / 2,
  },
});

function KopSurat({ logoSrc }: { logoSrc: string }) {
  return (
    <View style={styles.kop} fixed>
      <View style={styles.kopKiri}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoSrc} style={styles.logo} />
        <Text style={styles.kopKiriTeks}>Dept. Pergudangan &amp; Pengantongan</Text>
      </View>

      <View style={styles.kopKanan}>
        <Text style={styles.kopKananLabel}>Kepada :</Text>
        <View style={styles.kopKananBaris}>
          <Text style={styles.kopKananTebal}>AVP Pengelolaan</Text>
        </View>
        <View style={styles.kopKananBaris}>
          <Text style={styles.kopKananTebal}>&amp; Pemeliharaan Gudang</Text>
        </View>
        <View style={styles.kopKananBaris}>
          <Text style={styles.kopKananTebal}>Inbound &amp; Outbound</Text>
        </View>
        <Text style={styles.kopKananLabel}>di       Tempat</Text>
      </View>
    </View>
  );
}

function HeaderTabel() {
  return (
    <View style={styles.headRow} fixed>
      <View style={styles.colNo}>
        <Text style={styles.th}>NO</Text>
      </View>
      <View style={styles.colNama}>
        <Text style={styles.th}>NAMA BARANG</Text>
      </View>
      <View style={styles.colSatuan}>
        <Text style={styles.th}>SATUAN</Text>
      </View>
      <View style={styles.colJumlah}>
        <Text style={styles.thJumlahAtas}>JUMLAH</Text>
        <View style={styles.headKiri}>
          <View style={styles.colPermintaan}>
            <Text style={styles.th}>PERMINTAAN</Text>
          </View>
          <View style={styles.colDiberikan}>
            <Text style={styles.th}>DIBERIKAN</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function SuratPdf({
  data,
  logoSrc = "/brand/logo-petrokimia.png",
  watermarkSrc = "/brand/wares-watermark.png",
}: {
  data: SuratData;
  logoSrc?: string;
  /** Dipisah sebagai prop agar bisa diuji dengan path absolut di luar browser. */
  watermarkSrc?: string;
}) {
  return (
    <Document
      title={`Surat Pengambilan Barang — ${data.pekerjaan}`}
      author="WARES — Petrokimia Gresik"
      subject="Surat Pengambilan Barang"
    >
      <Page size="A4" style={styles.page}>
        {/* Elemen pertama = lapisan paling bawah; seluruh isi surat tergambar di atasnya. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={watermarkSrc} style={styles.watermark} fixed />

        <KopSurat logoSrc={logoSrc} />

        <View style={styles.judulBlok}>
          <Text style={styles.judul}>SURAT PENGAMBILAN BARANG</Text>
          <Text style={styles.subjudul}>PEMELIHARAAN PERGUDANGAN</Text>
        </View>

        <View style={styles.barisPekerjaan}>
          <Text style={styles.labelPekerjaan}>Untuk Pekerjaan &amp; Lokasi </Text>
          <Text style={styles.isiPekerjaan}>
            {data.pekerjaan} — {data.lokasi}
          </Text>
          <Text style={styles.labelPekerjaan}>, barang sebagai berikut :</Text>
        </View>

        <View style={styles.barisKategori}>
          {KATEGORI.map((k) => {
            const aktif = data.kategori.includes(k);
            return (
              <View key={k} style={styles.kategoriItem}>
                <View style={styles.kotak}>{aktif ? <View style={styles.centang} /> : null}</View>
                <Text style={aktif ? styles.kategoriLabelAktif : styles.kategoriLabel}>{k}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.tabel}>
          <HeaderTabel />

          {data.items.map((item, i) => {
            const terakhir = i === data.items.length - 1;
            return (
              <View key={`${item.nama_barang}-${i}`} style={terakhir ? styles.rowTerakhir : styles.row} wrap={false}>
                <View style={styles.colNo}>
                  <Text style={styles.selTengah}>{i + 1}</Text>
                </View>
                <View style={styles.colNama}>
                  <Text style={styles.sel}>{item.nama_barang}</Text>
                </View>
                <View style={styles.colSatuan}>
                  <Text style={styles.selTengah}>{item.satuan}</Text>
                </View>
                <View style={styles.colPermintaan}>
                  <Text style={styles.selAngka}>{item.jumlahPermintaan}</Text>
                </View>
                <View style={styles.colDiberikan}>
                  <Text style={styles.selAngka}>{item.jumlahDiberikan}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View wrap={false}>
          <Text style={styles.penutup}>
            Demikian atas bantuan dan kerja samanya yang baik disampaikan terima kasih.
          </Text>

          <View style={styles.ttdBlok}>
            <View style={styles.ttdKolom}>
              <Text style={styles.ttdTanggal}> </Text>
              <Text style={styles.ttdLabel}>Yang menyerahkan,</Text>
              <View style={styles.ttdGaris}>
                <Text style={styles.ttdNama}>{data.namaPenyerah}</Text>
              </View>
            </View>

            <View style={styles.ttdKolomKanan}>
              <Text style={styles.ttdTanggal}>Gresik, {data.tanggal}</Text>
              <Text style={styles.ttdLabel}>Yang menerima,</Text>
              <View style={styles.ttdGaris}>
                <Text style={styles.ttdNama}>{data.namaPenerima}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text
          style={styles.nomorHalaman}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Halaman ${pageNumber} dari ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
