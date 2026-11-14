/**
 * WARES Google Sheets API
 *
 * This file is intended for a container-bound Apps Script project on the stock
 * spreadsheet. Every public web action is authenticated with the WARES_API_SECRET
 * Script Property. The visible MASUK/KELUAR columns stay compatible with the
 * existing workbook; technical identifiers are appended in hidden columns.
 */

var WARES = Object.freeze({
  API_VERSION: "2026-08-11.1",
  TIME_ZONE: "Asia/Jakarta",
  TEMPLATE_SHEET: "Juli 2026 - DATA BASE LAPORAN HARIAN",
  INCOMING_SHEET: "MASUK",
  OUTGOING_SHEET: "KELUAR",
  MASTER_SHEET: "MASTER DATA",
  RACK_SHEET: "RACK GUDANG",
  KPI_SHEET: "Dashboard KPI",
  KPI_HEADER_ROW: 4,
  KPI_DATA_ROW: 5,
  /** Baris bulan yang disiapkan otomatis: 3 tahun sejak Juli 2026. */
  KPI_MONTH_COUNT: 36,
  /** Rumus panel kanan menjangkau lebih jauh agar admin boleh menambah baris. */
  KPI_FORMULA_LAST_ROW: 200,
  KPI_START_YEAR: 2026,
  /** 6 = Juli pada WARES.MONTHS (indeks nol). */
  KPI_START_MONTH_INDEX: 6,
  /** Kolom panel kanan: S sampai Y. Kolom R sengaja dibiarkan kosong sebagai pemisah. */
  KPI_DASH: Object.freeze({
    kpi: 19,
    pembilang: 20,
    penyebut: 21,
    nilai: 22,
    satuan: 23,
    target: 24,
    arah: 25
  }),
  KPI_DASH_HEADER_ROW: 4,
  KPI_PERIOD_LABEL_CELL: "S3",
  KPI_PERIOD_CELL: "T3",
  KPI_PERIOD_OVERALL: "Overall",
  RACK_SPREADSHEET_ID_PROPERTY: "WARES_RACK_SPREADSHEET_ID",
  REPORT_SUFFIX: " - DATA BASE LAPORAN HARIAN",
  SECRET_PROPERTY: "WARES_API_SECRET",
  REPORT_STATE_KEY: "WARES_REPORT_STATE",
  LOCK_TIMEOUT_MS: 5000,
  STOCK_SYNC_CACHE_SECONDS: 60,
  REPORT_HEADER_ROW: 4,
  REPORT_DATA_ROW: 5,
  REPORT_COLUMNS: Object.freeze({
    name: 1,
    location: 2,
    category: 3,
    code: 4,
    type: 5,
    ecr: 6,
    opening: 7,
    unit: 8,
    firstDay: 9,
    lastDay: 39,
    closing: 40
  }),
  MONTHS: Object.freeze([
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]),
  TECH: Object.freeze({
    transactionId: "_WARES_TRANSACTION_ID",
    requestId: "_WARES_REQUEST_ID",
    lineId: "_WARES_LINE_ID",
    syncToken: "_WARES_SYNC_TOKEN",
    expectedLines: "_WARES_EXPECTED_LINES",
    actorId: "_WARES_ACTOR_ID",
    operation: "_WARES_OPERATION",
    categories: "_WARES_CATEGORIES",
    catalogItemId: "_WARES_CATALOG_ITEM_ID",
    itemCategory: "_WARES_ITEM_CATEGORY",
    itemLocation: "_WARES_ITEM_LOCATION",
    itemUnit: "_WARES_ITEM_UNIT",
    itemRack: "_WARES_ITEM_RACK",
    itemArea: "_WARES_ITEM_AREA",
    materialCode: "_WARES_MATERIAL_CODE",
    requestedQty: "_WARES_REQUESTED_QTY",
    createdAt: "_WARES_CREATED_AT",
    updatedAt: "_WARES_UPDATED_AT"
  })
});

// Salinan aman dari file RACK GUDANG.xlsx. Sheet/tab RACK GUDANG selalu
// diprioritaskan; fallback ini menjaga API tetap berfungsi sebelum tab diimpor.
var WARES_DEFAULT_RACKS = Object.freeze([
  [1, "CONSUMABLE"], [2, "CONSUMABLE LAMPU"], [3, "LAMPU"], [4, "CCTV"],
  [5, "GD 20 K"], [6, "JT"], [7, "JT"], [8, "GD 50 K"], [9, "GD 50 K"],
  [10, "GD 20 K"], [11, "PHONSKA 5"], [12, "PHONSKA 5"], [13, "GD 50 K"],
  [14, "PHONSKA 4"], [15, "PHONSKA 5"], [16, "PHONSKA 5"], [17, "PHONSKA 4"],
  [18, "PHONSKA 2/3"], [19, "PHONSKA 2/3"], [20, "PHONSKA 2/3"],
  [21, "PHONSKA 2/3"], [22, "PHONSKA 2/3"], [23, "PHONSKA 1"],
  [24, "PHONSKA 1"], [25, "PHONSKA 1"], [26, "UREA 1B"], [27, "UREA 1B"],
  [28, "UREA 1B"], [29, "UREA 1B"], [30, "ZA"], [31, "ZA"], [32, "UREA 1A"],
  [33, "UREA 1A"], [34, "BAGGING MACHINE"], [35, "BENGKEL LAS"],
  [36, "GD 50 K MEKANIK"], [37, "GD 20 K MEKANIK"],
  [38, "PHONSKA 1 CONVEYOR SYSTEM"], [39, "PHONSKA 1 BAGGING SYSTEM"],
  [40, "PHONSKA 2/3 CONVEYOR SYSTEM"], [41, "PHONSKA 2/3 BAGGING SYSTEM"],
  [42, "PHONSKA 4 CONVEYOR SYSTEM"], [43, "PHONSKA 4 BAGGING SYSTEM"],
  [44, "PHONSKA 5 CONVEYOR SYSTEM"], [45, "PHONSKA 5 BAGGING"],
  [46, "UREA 1A"], [47, "ZA"], [48, "UREA 1B"],
  [49, "CONSUMABLE MEKANIK"], [50, "CONSUMABLE MEKANIK"]
]);

/**
 * Kolom angka mentah Dashboard KPI, berurutan mulai kolom B.
 *
 * HARUS sejajar dengan KPI_KOLOM_INPUT pada src/lib/kpi/definitions.ts di
 * repositori WARES. Apps Script tidak dapat mengimpor modul TypeScript, jadi
 * kedua daftar ini dirawat berpasangan; unit test di sisi website menjaga agar
 * urutan field-nya tidak bergeser.
 */
var WARES_KPI_INPUT = Object.freeze([
  ["permintaan_terpenuhi", "PERMINTAAN LANGSUNG TERPENUHI"],
  ["total_permintaan", "TOTAL PERMINTAAN"],
  ["critical_tersedia", "CRITICAL SPARE TERSEDIA"],
  ["critical_wajib", "TOTAL CRITICAL SPARE WAJIB"],
  ["item_stockout", "ITEM MENGALAMI STOCKOUT"],
  ["total_item_diminta", "TOTAL ITEM DIMINTA"],
  ["total_hari_penyediaan", "TOTAL HARI PENYEDIAAN"],
  ["jumlah_request_lead_time", "JUMLAH REQUEST (LEAD TIME)"],
  ["request_sesuai_sla", "REQUEST SELESAI SESUAI SLA"],
  ["total_request_sla", "TOTAL REQUEST (SLA)"],
  ["wo_tertunda_sparepart", "WO TERTUNDA KARENA SPAREPART"],
  ["total_wo_maintenance", "TOTAL WO MAINTENANCE"],
  ["item_stok_akurat", "ITEM STOK FISIK = STOK SISTEM"],
  ["total_item_diperiksa", "TOTAL ITEM DIPERIKSA"],
  ["nilai_slow_dead_stock", "NILAI SLOW/DEAD STOCK"],
  ["total_nilai_inventory", "TOTAL NILAI INVENTORY SPAREPART"]
]);

/** 8 KPI inti: [id, nama, field pembilang, field penyebut, format, arah baik]. */
var WARES_KPI = Object.freeze([
  ["sparepart-availability", "Sparepart Availability", "permintaan_terpenuhi", "total_permintaan", "persen", "Semakin tinggi semakin baik"],
  ["critical-spare-availability", "Critical Spare Availability", "critical_tersedia", "critical_wajib", "persen", "Semakin tinggi semakin baik"],
  ["stockout-rate", "Stockout Rate", "item_stockout", "total_item_diminta", "persen", "Semakin rendah semakin baik"],
  ["provision-lead-time", "Provision Lead Time", "total_hari_penyediaan", "jumlah_request_lead_time", "hari", "Semakin rendah semakin baik"],
  ["sla-fulfillment", "SLA Fulfillment", "request_sesuai_sla", "total_request_sla", "persen", "Semakin tinggi semakin baik"],
  ["maintenance-delay", "Maintenance Delay due to Sparepart", "wo_tertunda_sparepart", "total_wo_maintenance", "persen", "Semakin rendah semakin baik"],
  ["inventory-accuracy", "Inventory Accuracy", "item_stok_akurat", "total_item_diperiksa", "persen", "Semakin tinggi semakin baik"],
  ["slow-dead-stock", "Slow / Dead Stock", "nilai_slow_dead_stock", "total_nilai_inventory", "persen", "Semakin rendah semakin baik"]
]);

function doGet() {
  // Health check tidak membutuhkan credential. Secret tidak pernah diterima
  // lewat query string agar tidak tersimpan di history, analytics, atau log URL.
  return json_({
    ok: true,
    data: { service: "wares-sheets", timeZone: WARES.TIME_ZONE }
  });
}

function doPost(e) {
  var request;
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return json_({ ok: false, error: { code: "INVALID_JSON", message: "Body harus berupa JSON." } });
  }
  return handleWebRequest_(request);
}

function handleWebRequest_(request) {
  try {
    assertSecret_(request && request.secret);
    var action = String((request && request.action) || "");
    var payload = (request && request.payload) || {};

    if (action === "health") {
      return json_({ ok: true, data: integrationInfo_() });
    }
    if (action === "stock.get") {
      return json_({ ok: true, data: withLock_(function () { return getStockSnapshot_(); }) });
    }
    if (action === "metadata.get") {
      // Hanya membaca kolom KETERANGAN; jangan antre di belakang transaksi stok.
      return json_({ ok: true, data: { keterangan: getIncomingNotesReadOnly_() } });
    }
    if (action === "rack.get") {
      return json_({ ok: true, data: { items: getRackOptions_() } });
    }
    if (action === "kpi.get") {
      // Baca murni; jangan antre di belakang transaksi stok yang memegang lock.
      return json_({ ok: true, data: getKpiData_() });
    }
    if (action === "kpi.setup") {
      return json_({ ok: true, data: withLock_(function () { return setupDashboardKpi_(); }) });
    }
    if (action === "master.list") {
      return json_({ ok: true, data: { items: getMasterData_() } });
    }
    if (action === "master.create") {
      return json_({ ok: true, data: withLock_(function () { return createMasterData_(payload); }) });
    }
    if (action === "master.update") {
      return json_({ ok: true, data: withLock_(function () { return updateMasterData_(payload); }) });
    }
    if (action === "master.deactivate") {
      return json_({ ok: true, data: withLock_(function () { return deactivateMasterData_(payload); }) });
    }
    if (action === "master.migrate-racks") {
      return json_({ ok: true, data: withLock_(function () { return migrateLegacyRackDataSafely_(); }) });
    }
    if (action === "incoming.status") {
      // Pemeriksaan ini sengaja tidak mengambil global lock. incoming.record
      // menulis jurnal MASUK sebelum memperbarui laporan bulanan, sehingga
      // status dapat dikonfirmasi walaupun respons transaksi utama timeout.
      return json_({ ok: true, data: getIncomingStatus_(payload) });
    }
    if (action === "incoming.record") {
      return json_({ ok: true, data: withLock_(function () { return recordIncoming_(payload); }) });
    }
    if (action === "outgoing.status") {
      // Konfirmasi jurnal sengaja bebas global lock. Saat outgoing.replace masih
      // menyegarkan laporan, requestId + syncToken sudah dapat dibaca di KELUAR.
      return json_({ ok: true, data: getOutgoingStatus_(payload) });
    }
    if (action === "outgoing.record" || action === "outgoing.replace") {
      return json_({ ok: true, data: withLock_(function () { return replaceOutgoing_(payload); }) });
    }
    if (action === "month.ensure") {
      return json_({ ok: true, data: withLock_(function () {
        var sheet = ensureCurrentMonthReport_();
        return { reportSheet: sheet.getName() };
      }) });
    }
    // --- Inventory (WARES v2): pembacaan hasil model, read-only. Tidak mengambil
    //     global lock karena hanya membaca; website hanya mencerminkan angka. ---
    if (action === "inv.dashboard") {
      return json_({ ok: true, data: getInventoryDashboard_() });
    }
    if (action === "inv.rmhasil") {
      return json_({ ok: true, data: { items: getInventoryRmHasil_() } });
    }
    if (action === "inv.proyeksi") {
      return json_({ ok: true, data: getInventoryProyeksi_() });
    }
    if (action === "inv.demand") {
      return json_({ ok: true, data: getInventoryDemand_() });
    }
    if (action === "inv.pola") {
      return json_({ ok: true, data: { items: getInventoryPola_() } });
    }
    if (action === "inv.oporder") {
      return json_({ ok: true, data: getInventoryOpOrder_() });
    }
    if (action === "inv.oprencana") {
      return json_({ ok: true, data: getInventoryOpRencana_() });
    }
    if (action === "inv.pm") {
      return json_({ ok: true, data: getInventoryPm_() });
    }
    throw apiError_("UNKNOWN_ACTION", "Action API tidak dikenal.");
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({
      ok: false,
      error: {
        code: (error && error.code) || "INTERNAL_ERROR",
        message: (error && error.expose) ? error.message : "Integrasi spreadsheet gagal memproses permintaan."
      }
    });
  }
}

/**
 * Identitas workbook hanya dikirim melalui action POST yang sudah melewati
 * pemeriksaan secret. Backfill memakainya untuk mencegah URL deployment dari
 * spreadsheet lama dipakai tanpa sengaja.
 */
function integrationInfo_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var rackInfo = rackSourceInfo_();
  var rackCount = getRackOptions_().length;
  return {
    service: "wares-sheets",
    apiVersion: WARES.API_VERSION,
    timeZone: WARES.TIME_ZONE,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    masterSheetReady: Boolean(spreadsheet.getSheetByName(WARES.MASTER_SHEET)),
    kpiSheetReady: Boolean(spreadsheet.getSheetByName(WARES.KPI_SHEET)),
    rackSheetReady: rackCount === 50,
    rackSource: rackInfo.source,
    rackCount: rackCount
  };
}

function rackSourceInfo_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet.getSheetByName(WARES.RACK_SHEET)) {
    return { source: "workbook" };
  }

  var externalId = PropertiesService.getScriptProperties()
    .getProperty(WARES.RACK_SPREADSHEET_ID_PROPERTY);
  if (externalId) {
    try {
      var external = SpreadsheetApp.openById(externalId);
      if (external.getSheetByName(WARES.RACK_SHEET) || external.getSheets()[0]) {
        return { source: "external" };
      }
    } catch (error) {
      console.warn("Referensi RACK eksternal tidak dapat diperiksa", error);
    }
  }

  // Mapping embedded adalah salinan terverifikasi RACK GUDANG.xlsx dan menjadi
  // fallback cepat bila tab belum diimpor ke workbook dummy.
  return { source: "embedded" };
}

function getRackOptions_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(WARES.RACK_SHEET);
  if (!sheet) {
    var externalId = PropertiesService.getScriptProperties()
      .getProperty(WARES.RACK_SPREADSHEET_ID_PROPERTY);
    if (externalId) {
      try {
        var external = SpreadsheetApp.openById(externalId);
        sheet = external.getSheetByName(WARES.RACK_SHEET) || external.getSheets()[0];
      } catch (error) {
        console.warn("Referensi RACK eksternal tidak dapat dibuka", error);
      }
    }
  }

  var items = [];
  if (sheet) {
    var header = findHeaderWithAliases_(sheet, {
      rack: ["RACK", "NO RACK", "NO. RACK", "NOMOR RACK"],
      area: ["AREA", "NAMA AREA"]
    });
    if (header && sheet.getLastRow() > header.row) {
      var values = sheet.getRange(
        header.row + 1,
        1,
        sheet.getLastRow() - header.row,
        header.lastColumn
      ).getDisplayValues();
      values.forEach(function (row) {
        var rack = parseRackNumber_(row[header.columns.rack - 1]);
        var area = optionalText_(row[header.columns.area - 1]);
        if (rack && area) items.push({ rack: rack, area: area });
      });
    }
  }

  if (!items.length) {
    items = WARES_DEFAULT_RACKS.map(function (entry) {
      return { rack: entry[0], area: entry[1] };
    });
  }

  var unique = {};
  items.forEach(function (item) {
    if (!unique[item.rack]) unique[item.rack] = item;
  });
  return Object.keys(unique).map(function (rack) { return unique[rack]; })
    .sort(function (a, b) { return a.rack - b.rack; });
}

function findHeaderWithAliases_(sheet, requiredAliases) {
  var rowCount = Math.min(Math.max(sheet.getLastRow(), 1), 20);
  var columnCount = Math.max(sheet.getLastColumn(), Object.keys(requiredAliases).length);
  var values = sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues();
  for (var row = 0; row < values.length; row++) {
    var normalizedColumns = {};
    values[row].forEach(function (value, index) {
      var key = normalize_(value);
      if (key) normalizedColumns[key] = index + 1;
    });
    var resolved = {};
    var complete = Object.keys(requiredAliases).every(function (field) {
      var aliases = requiredAliases[field];
      for (var index = 0; index < aliases.length; index++) {
        var column = normalizedColumns[normalize_(aliases[index])];
        if (column) {
          resolved[field] = column;
          return true;
        }
      }
      return false;
    });
    if (complete) return { row: row + 1, columns: resolved, lastColumn: columnCount };
  }
  return null;
}

function ensureMasterLayout_(ensureStatus) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = requireSheet_(spreadsheet, WARES.MASTER_SHEET);
  var header = findHeaderWithAliases_(sheet, {
    no: ["NO.", "NO"],
    kategori: ["KATEGORI", "KATAGORI"],
    materialNumber: ["MATERIAL NUMBER", "MATERIAL NO", "KODE MATERIAL"],
    rack: ["RACK"],
    klasifikasi: ["KLASIFIKASI"],
    area: ["AREA"],
    namaBarang: ["NAMA BARANG", "BARANG"],
    lokasi: ["LOKASI"]
  });
  if (!header) {
    throw apiError_("INVALID_SHEET", "Header sheet MASTER DATA tidak ditemukan.");
  }

  if (ensureStatus && sheet.getMaxColumns() < 16) {
    // Tambah P di ujung (setelah O), sehingga I:O tidak bergeser.
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 16 - sheet.getMaxColumns());
  }
  var headerWidth = Math.min(
    sheet.getMaxColumns(),
    Math.max(sheet.getLastColumn(), ensureStatus ? 16 : 1)
  );
  var headerValues = sheet.getRange(header.row, 1, 1, headerWidth)
    .getDisplayValues()[0];
  var statusColumn = 0;
  headerValues.forEach(function (value, index) {
    if (normalize_(value) === "STATUS") statusColumn = index + 1;
  });
  if (!statusColumn && ensureStatus) {
    // FINAL.xlsx memakai I:O untuk formula/catatan. STATUS selalu diletakkan di
    // P agar tidak menggeser atau menimpa satu pun kolom tersebut.
    if (optionalText_(headerValues[15])) {
      throw apiError_("INVALID_SHEET", "Kolom P MASTER DATA harus tersedia untuk STATUS.");
    }
    statusColumn = 16;
    sheet.getRange(header.row, statusColumn).setValue("STATUS");
  }

  var unitColumn = 0;
  headerValues.forEach(function (value, index) {
    var normalized = normalize_(value);
    if (normalized === "SATUAN" || normalized === "UNIT" || normalized === "UOM") {
      unitColumn = index + 1;
    }
  });
  return {
    sheet: sheet,
    headerRow: header.row,
    dataStartRow: header.row + 1,
    noColumn: header.columns.no,
    categoryColumn: header.columns.kategori,
    codeColumn: header.columns.materialNumber,
    rackColumn: header.columns.rack,
    classificationColumn: header.columns.klasifikasi,
    areaColumn: header.columns.area,
    nameColumn: header.columns.namaBarang,
    locationColumn: header.columns.lokasi,
    statusColumn: statusColumn,
    unitColumn: unitColumn,
    readWidth: Math.max(sheet.getLastColumn(), statusColumn || 0, unitColumn || 0)
  };
}

function getMasterData_() {
  return readMasterDataRows_(ensureMasterLayout_(false)).map(publicMasterItem_);
}

function readMasterDataRows_(layout) {
  var lastRow = layout.sheet.getLastRow();
  if (lastRow < layout.dataStartRow) return [];
  var values = layout.sheet.getRange(
    layout.dataStartRow,
    1,
    lastRow - layout.dataStartRow + 1,
    layout.readWidth
  ).getDisplayValues();
  var rackMap = rackMap_();
  var result = [];
  values.forEach(function (row, index) {
    var name = optionalText_(row[layout.nameColumn - 1]);
    var code = optionalText_(row[layout.codeColumn - 1]);
    // Placeholder bernomor/kategori tanpa material memang disediakan workbook
    // untuk input baru dan tidak boleh dianggap sebagai item.
    if (!name && !code) return;
    var rawRack = optionalText_(row[layout.rackColumn - 1]);
    var rawArea = optionalText_(row[layout.areaColumn - 1]);
    var storage = resolveLegacyStorage_(rawRack, rawArea, rackMap);
    var rawStatus = layout.statusColumn
      ? normalize_(row[layout.statusColumn - 1])
      : "";
    result.push({
      row: layout.dataStartRow + index,
      no: index + 1,
      kategori: optionalText_(row[layout.categoryColumn - 1]),
      material_number: code,
      rack: storage.rack,
      klasifikasi: optionalText_(row[layout.classificationColumn - 1]),
      area: storage.area,
      nama_barang: name,
      lokasi: optionalText_(row[layout.locationColumn - 1]),
      status: rawStatus === "NONAKTIF" ? "NONAKTIF" : "AKTIF",
      satuan: layout.unitColumn ? optionalText_(row[layout.unitColumn - 1]) : ""
    });
  });
  return result;
}

function publicMasterItem_(entry) {
  return {
    id: String(entry.row),
    no: entry.no,
    kategori: entry.kategori,
    material_number: entry.material_number,
    rack: entry.rack,
    klasifikasi: entry.klasifikasi,
    area: entry.area,
    nama_barang: entry.nama_barang,
    lokasi: entry.lokasi,
    status: entry.status,
    satuan: entry.satuan
  };
}

function resolveLegacyStorage_(rawRack, rawArea, rackMap) {
  var parsed = parseRackNumber_(rawRack);
  var known = parsed && rackMap[parsed];
  if (known) {
    return {
      rack: parsed,
      area: rawArea && normalize_(rawArea) !== "-" ? rawArea : known
    };
  }
  // Data lama berisi label lokasi bebas (dan beberapa Rack 52). Jangan menebak
  // nomor rack: tampilkan sebagai fallback area hingga admin menyimpannya ulang.
  var fallback = rawArea && normalize_(rawArea) !== "-" ? rawArea : rawRack;
  return { rack: null, area: fallback };
}

function rackMap_() {
  var map = {};
  getRackOptions_().forEach(function (item) { map[item.rack] = item.area; });
  return map;
}

function validateMasterInput_(raw) {
  raw = raw || {};
  var rack = parseRackNumber_(raw.rack);
  var rackMap = rackMap_();
  if (!rack || !rackMap[rack]) {
    throw apiError_("INVALID_RACK", "Nomor rack wajib dipilih dari daftar RACK GUDANG.");
  }
  var area = limitedText_(raw.area, "area", 120, false) || rackMap[rack];
  var canonicalArea = "";
  Object.keys(rackMap).some(function (number) {
    if (normalize_(rackMap[number]) === normalize_(area)) {
      canonicalArea = rackMap[number];
      return true;
    }
    return false;
  });
  if (!canonicalArea) {
    throw apiError_("INVALID_AREA", "Area wajib dipilih dari daftar RACK GUDANG.");
  }
  var status = normalize_(raw.status || "AKTIF");
  if (status !== "AKTIF" && status !== "NONAKTIF") {
    throw apiError_("INVALID_INPUT", "Status material harus AKTIF atau NONAKTIF.");
  }
  return {
    kategori: limitedText_(raw.kategori != null ? raw.kategori : raw.katagori, "kategori", 120, false),
    material_number: limitedText_(raw.material_number != null ? raw.material_number : raw.materialNumber, "material_number", 100, true),
    rack: rack,
    klasifikasi: limitedText_(raw.klasifikasi, "klasifikasi", 120, false),
    area: canonicalArea,
    nama_barang: limitedText_(raw.nama_barang != null ? raw.nama_barang : raw.namaBarang, "nama_barang", 200, true),
    lokasi: limitedText_(raw.lokasi, "lokasi", 120, false),
    status: status
  };
}

function createMasterData_(raw) {
  var layout = ensureMasterLayout_(true);
  var input = validateMasterInput_(raw);
  var rows = readMasterDataRows_(layout);
  assertUniqueMaterialNumber_(rows, input.material_number, 0);
  var row = firstEmptyMasterSlot_(layout);
  writeMasterDataRow_(layout, row, input);
  SpreadsheetApp.flush();
  var saved = readMasterDataRows_(layout).filter(function (item) { return item.row === row; })[0];
  if (!saved) throw apiError_("INTERNAL_ERROR", "Material belum dapat dibaca kembali.");
  return { item: publicMasterItem_(saved) };
}

function updateMasterData_(raw) {
  raw = raw || {};
  var layout = ensureMasterLayout_(true);
  var row = parseMasterRowId_(raw.id, layout);
  var rows = readMasterDataRows_(layout);
  var existing = rows.filter(function (item) { return item.row === row; })[0];
  if (!existing) throw apiError_("NOT_FOUND", "Material tidak ditemukan.");
  var input = validateMasterInput_(raw);
  assertUniqueMaterialNumber_(rows, input.material_number, row);
  writeMasterDataRow_(layout, row, input);

  // Baris MASTER DATA sudah tertulis di atas — itu operasi utamanya. Penyelarasan
  // jurnal & laporan bulanan di bawah bersifat SEKUNDER dan menyentuh banyak sheet
  // lain (MASUK, KELUAR, template laporan), sehingga jauh lebih rentan gagal.
  //
  // Dulu tanpa try/catch: satu kegagalan di sana membuat seluruh permintaan dibalas
  // error, padahal materialnya SUDAH tersimpan. Admin melihat "gagal", lalu mengedit
  // ulang atau mengira perubahannya hilang. Kini kegagalannya dilaporkan sebagai
  // peringatan, bukan membatalkan penyimpanan yang sudah terjadi.
  var warning = null;
  try {
    syncMasterEditToCurrentStock_(existing, input, rows);
  } catch (syncError) {
    console.error(
      "Sinkronisasi jurnal/laporan setelah edit MASTER DATA gagal",
      syncError && syncError.stack ? syncError.stack : syncError
    );
    warning = "Material tersimpan, tetapi jurnal/laporan bulanan belum ikut diperbarui ("
      + shortReason_(syncError) + "). Perbaiki lalu simpan ulang material ini.";
  }

  SpreadsheetApp.flush();
  var saved = readMasterDataRows_(layout).filter(function (item) { return item.row === row; })[0];
  return {
    item: publicMasterItem_(saved),
    previous: publicMasterItem_(existing),
    warning: warning
  };
}

/** Ringkasan sebab yang aman ditampilkan ke admin (dipakai untuk peringatan). */
function shortReason_(error) {
  if (!error) return "sebab tidak diketahui";
  var pesan = error.code ? String(error.code) : "";
  if (error.message) pesan = pesan ? pesan + ": " + error.message : String(error.message);
  pesan = pesan || String(error);
  return pesan.length > 160 ? pesan.slice(0, 157) + "…" : pesan;
}

function syncMasterEditToCurrentStock_(before, after, masterRows) {
  var codeChanged = normalize_(before.material_number) !== normalize_(after.material_number);
  var nameChanged = normalize_(before.nama_barang) !== normalize_(after.nama_barang);
  var identityChanged = codeChanged || nameChanged;
  var sameNameRows = masterRows.filter(function (item) {
    return normalize_(item.nama_barang) === normalize_(before.nama_barang);
  });
  var allowNameFallback = sameNameRows.length === 1;

  if (identityChanged) {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    syncCurrentMonthJournalIdentity_(
      requireSheet_(spreadsheet, WARES.INCOMING_SHEET),
      "incoming",
      before,
      after,
      allowNameFallback
    );
    syncCurrentMonthJournalIdentity_(
      requireSheet_(spreadsheet, WARES.OUTGOING_SHEET),
      "outgoing",
      before,
      after,
      allowNameFallback
    );
  }

  var report = ensureCurrentMonthReport_();
  var reportLayout = detectReportLayout_(report);
  var material = findReportMaterial_(
    report,
    reportLayout,
    before.material_number,
    before.nama_barang
  ) || findReportMaterial_(report, reportLayout, after.material_number, after.nama_barang);
  if (!material) return;

  // Template FINAL dapat memakai formula referensi MASTER DATA. Sel formula
  // dibiarkan apa adanya; hanya metadata literal yang perlu diselaraskan.
  setReportLiteralCell_(report, material.row, reportLayout.nameColumn, after.nama_barang);
  setReportLiteralCell_(report, material.row, reportLayout.locationColumn, after.lokasi);
  setReportLiteralCell_(report, material.row, reportLayout.categoryColumn, after.kategori);
  setReportLiteralCell_(report, material.row, reportLayout.codeColumn, after.material_number);
  setReportLiteralCell_(report, material.row, reportLayout.typeColumn, after.klasifikasi);
  invalidateReportSyncCache_(report);
}

function setReportLiteralCell_(sheet, row, column, value) {
  // Sel laporan bisa MENOLAK ditulis karena alasan yang sah dan di luar kendali
  // aplikasi: ia bagian header Tabel Google Sheets ("Operasi ini tidak didukung
  // pada baris header tabel."), berada di rentang terproteksi, atau berisi rumus.
  // Nilainya cuma metadata tampilan, jadi sel yang menolak dilewati saja —
  // satu sel tidak boleh menggagalkan penyimpanan material yang sudah sah.
  try {
    var cell = sheet.getRange(row, column);
    if (!cell.getFormula()) cell.setValue(safeCellText_(value));
  } catch (error) {
    console.warn(
      "Sel laporan dilewati (tidak dapat ditulis): baris " + row + " kolom " + column +
      " — " + (error && error.message ? error.message : error)
    );
  }
}

function syncCurrentMonthJournalIdentity_(sheet, kind, before, after, allowNameFallback) {
  var layout = ensureJournalLayout_(sheet, kind);
  var lastRow = sheet.getLastRow();
  if (lastRow <= layout.headerRow) return;
  var height = lastRow - layout.headerRow;
  var dates = sheet.getRange(layout.headerRow + 1, layout.dateColumn, height, 1).getValues();
  var names = sheet.getRange(layout.headerRow + 1, layout.itemColumn, height, 1).getDisplayValues();
  var codes = sheet.getRange(
    layout.headerRow + 1,
    layout.columns[WARES.TECH.materialCode],
    height,
    1
  ).getDisplayValues();
  var currentReport = reportName_(new Date());
  var nameCells = [];
  var codeCells = [];
  for (var index = 0; index < height; index++) {
    var date;
    try { date = parseDate_(dates[index][0]); } catch (_) { continue; }
    if (reportName_(date) !== currentReport) continue;
    var rowCode = optionalText_(codes[index][0]);
    var rowName = optionalText_(names[index][0]);
    var matchesCode = rowCode && normalize_(rowCode) === normalize_(before.material_number);
    var matchesLegacyName = !rowCode && allowNameFallback &&
      normalize_(rowName) === normalize_(before.nama_barang);
    if (!matchesCode && !matchesLegacyName) continue;
    var row = layout.headerRow + 1 + index;
    nameCells.push(columnLetter_(layout.itemColumn) + row);
    codeCells.push(columnLetter_(layout.columns[WARES.TECH.materialCode]) + row);
  }
  setRangeListValueInChunks_(sheet, nameCells, safeCellText_(after.nama_barang));
  setRangeListValueInChunks_(sheet, codeCells, safeCellText_(after.material_number));
}

function setRangeListValueInChunks_(sheet, references, value) {
  for (var index = 0; index < references.length; index += 200) {
    var chunk = references.slice(index, index + 200);
    try {
      sheet.getRangeList(chunk).setValue(value);
    } catch (error) {
      // Satu sel bermasalah (header Tabel/terproteksi) membuat SELURUH rangeList
      // gagal. Jatuh ke penulisan per sel supaya baris lain tetap tersinkron.
      console.warn(
        "Penulisan berkelompok gagal, dicoba per sel — " +
        (error && error.message ? error.message : error)
      );
      for (var i = 0; i < chunk.length; i++) {
        try {
          sheet.getRange(chunk[i]).setValue(value);
        } catch (cellError) {
          console.warn(
            "Sel jurnal dilewati: " + chunk[i] + " — " +
            (cellError && cellError.message ? cellError.message : cellError)
          );
        }
      }
    }
  }
}

function deactivateMasterData_(raw) {
  var layout = ensureMasterLayout_(true);
  var row = parseMasterRowId_(raw && raw.id, layout);
  var existing = readMasterDataRows_(layout).filter(function (item) { return item.row === row; })[0];
  if (!existing) throw apiError_("NOT_FOUND", "Material tidak ditemukan.");
  layout.sheet.getRange(row, layout.statusColumn).setValue("NONAKTIF");
  SpreadsheetApp.flush();
  existing.status = "NONAKTIF";
  return { item: publicMasterItem_(existing) };
}

function parseMasterRowId_(value, layout) {
  var text = optionalText_(value).replace(/^row:/i, "");
  var row = Number(text);
  if (!Number.isInteger(row) || row < layout.dataStartRow || row > layout.sheet.getMaxRows()) {
    throw apiError_("INVALID_INPUT", "ID material tidak valid.");
  }
  return row;
}

function assertUniqueMaterialNumber_(rows, materialNumber, ignoredRow) {
  var wanted = normalize_(materialNumber);
  var duplicate = rows.some(function (item) {
    return item.row !== ignoredRow && normalize_(item.material_number) === wanted;
  });
  if (duplicate) {
    throw apiError_("DUPLICATE_MATERIAL", "Material number sudah digunakan oleh material lain.");
  }
}

function firstEmptyMasterSlot_(layout) {
  // FINAL.xlsx hanya menyiapkan slot formula/referensi sampai baris 1408.
  // Menulis di bawahnya membuat material tidak terhubung ke 42 ribu formula
  // laporan, sehingga backend sengaja menolak alih-alih append sembarang baris.
  var lastSlotRow = Math.min(1408, layout.sheet.getMaxRows());
  var height = lastSlotRow - layout.dataStartRow + 1;
  if (height <= 0) throw apiError_("NO_EMPTY_SLOT", "Slot template MASTER DATA tidak tersedia.");
  var values = layout.sheet.getRange(layout.dataStartRow, 1, height, 8).getDisplayValues();
  for (var index = 0; index < height; index++) {
    var row = values[index];
    var isPlaceholder = optionalText_(row[layout.noColumn - 1]) ||
      optionalText_(row[layout.categoryColumn - 1]);
    if (
      isPlaceholder &&
      !optionalText_(row[layout.codeColumn - 1]) &&
      !optionalText_(row[layout.nameColumn - 1])
    ) {
      return layout.dataStartRow + index;
    }
  }
  throw apiError_(
    "NO_EMPTY_SLOT",
    "Slot kosong MASTER DATA habis. Tambahkan baris template terlebih dahulu."
  );
}

function writeMasterDataRow_(layout, row, input) {
  // Hanya A:H dan P yang dikelola. I:O tidak pernah ditulis agar rumus dan 25
  // catatan internal FINAL.xlsx tetap utuh.
  var managed = layout.sheet.getRange(row, 1, 1, 8).getValues()[0];
  managed[layout.noColumn - 1] = row - layout.headerRow;
  managed[layout.categoryColumn - 1] = safeCellText_(input.kategori);
  managed[layout.codeColumn - 1] = safeCellText_(input.material_number);
  managed[layout.rackColumn - 1] = input.rack;
  managed[layout.classificationColumn - 1] = safeCellText_(input.klasifikasi);
  managed[layout.areaColumn - 1] = safeCellText_(input.area);
  managed[layout.nameColumn - 1] = safeCellText_(input.nama_barang);
  managed[layout.locationColumn - 1] = safeCellText_(input.lokasi);
  layout.sheet.getRange(row, 1, 1, 8).setValues([managed]);
  layout.sheet.getRange(row, layout.statusColumn).setValue(input.status);
}

/**
 * Jalankan sekali dari editor Apps Script setelah tab RACK GUDANG tersedia.
 * Hanya "RACK 1" s.d. "RACK 50" yang dinormalisasi. Nilai legacy lain dan
 * Rack 52 sengaja dibiarkan agar tidak terjadi penempatan barang secara acak.
 */
function migrateLegacyRackDataSafely() {
  return withLock_(function () { return migrateLegacyRackDataSafely_(); });
}

function migrateLegacyRackDataSafely_() {
  var layout = ensureMasterLayout_(true);
  var height = layout.sheet.getLastRow() - layout.dataStartRow + 1;
  if (height <= 0) return { updated: 0, unresolved: 0 };
  var racks = layout.sheet.getRange(layout.dataStartRow, layout.rackColumn, height, 1).getValues();
  var areas = layout.sheet.getRange(layout.dataStartRow, layout.areaColumn, height, 1).getValues();
  var codes = layout.sheet.getRange(layout.dataStartRow, layout.codeColumn, height, 1).getDisplayValues();
  var names = layout.sheet.getRange(layout.dataStartRow, layout.nameColumn, height, 1).getDisplayValues();
  var rackMap = rackMap_();
  var updated = 0;
  var unresolved = 0;
  var rackRowsByNumber = {};
  var areaRowsByNumber = {};
  for (var index = 0; index < height; index++) {
    if (!optionalText_(codes[index][0]) && !optionalText_(names[index][0])) continue;
    var raw = optionalText_(racks[index][0]);
    var label = raw.match(/^RACK\s*0*(\d+)$/i);
    var numeric = /^\d+$/.test(raw) ? Number(raw) : null;
    var rack = label ? Number(label[1]) : numeric;
    if (rack && rackMap[rack] && (label || numeric)) {
      var nextArea = optionalText_(areas[index][0]);
      var mustFillArea = !nextArea || normalize_(nextArea) === "-";
      var rackNeedsNumeric = typeof racks[index][0] !== "number";
      if (label || mustFillArea || rackNeedsNumeric) {
        var rowNumber = layout.dataStartRow + index;
        if (label || rackNeedsNumeric) {
          if (!rackRowsByNumber[rack]) rackRowsByNumber[rack] = [];
          rackRowsByNumber[rack].push(rowNumber);
        }
        if (label || mustFillArea) {
          if (!areaRowsByNumber[rack]) areaRowsByNumber[rack] = [];
          areaRowsByNumber[rack].push(rowNumber);
        }
        updated++;
      }
    } else if (raw) {
      unresolved++;
    }
  }
  Object.keys(rackRowsByNumber).forEach(function (rack) {
    var ranges = rackRowsByNumber[rack].map(function (row) {
      return columnLetter_(layout.rackColumn) + row;
    });
    layout.sheet.getRangeList(ranges).setValue(Number(rack));
  });
  Object.keys(areaRowsByNumber).forEach(function (rack) {
    var ranges = areaRowsByNumber[rack].map(function (row) {
      return columnLetter_(layout.areaColumn) + row;
    });
    layout.sheet.getRangeList(ranges).setValue(rackMap[rack]);
  });
  SpreadsheetApp.flush();
  return { updated: updated, unresolved: unresolved };
}

function parseRackNumber_(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  var text = optionalText_(value);
  var label = text.match(/^RACK\s*0*(\d+)$/i);
  if (label) text = label[1];
  var result = Number(text);
  return Number.isInteger(result) && result > 0 ? result : null;
}

// ============================================================
// Dashboard KPI
//
// Spreadsheet adalah SUMBER data KPI (kebalikan dari Master Data/stok yang kini
// bersumber di Postgres): admin mengisi angka mentah di sini, website hanya
// mencerminkannya. Angka yang disimpan selalu pembilang & penyebut — bukan
// persentase jadi — supaya penggabungan beberapa bulan tetap benar.
// ============================================================

/** Jalankan sekali dari editor Apps Script untuk membuat/memperbaiki sheetnya. */
function setupDashboardKpi() {
  return withLock_(function () { return setupDashboardKpi_(); });
}

function setupDashboardKpi_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(WARES.KPI_SHEET);
  var dibuat = false;
  if (!sheet) {
    sheet = spreadsheet.insertSheet(WARES.KPI_SHEET);
    dibuat = true;
  }

  if (sheet.getMaxColumns() < WARES.KPI_DASH.arah) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), WARES.KPI_DASH.arah - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < WARES.KPI_FORMULA_LAST_ROW) {
    sheet.insertRowsAfter(sheet.getMaxRows(), WARES.KPI_FORMULA_LAST_ROW - sheet.getMaxRows());
  }

  writeKpiInputBlock_(sheet);
  writeKpiDashboardBlock_(sheet);
  applyKpiPeriodValidation_(sheet);
  styleKpiSheet_(sheet);
  SpreadsheetApp.flush();

  return {
    sheetName: sheet.getName(),
    created: dibuat,
    monthRows: WARES.KPI_MONTH_COUNT,
    firstMonth: kpiMonthLabel_(0)
  };
}

function writeKpiInputBlock_(sheet) {
  sheet.getRange(1, 1).setValue("DASHBOARD KPI — DATA INPUT");
  sheet.getRange(2, 1).setValue(
    "Diisi manual oleh Admin. Masukkan angka mentah (pembilang dan penyebut); " +
    "persentase dihitung otomatis pada panel kanan dan di website WARES."
  );

  var header = ["BULAN"];
  WARES_KPI_INPUT.forEach(function (kolom) { header.push(kolom[1]); });
  sheet.getRange(WARES.KPI_HEADER_ROW, 1, 1, header.length).setValues([header]);

  // Label bulan hanya diisi bila selnya masih kosong, sehingga menjalankan ulang
  // setup tidak pernah menimpa periode yang sudah disesuaikan admin.
  var terisi = sheet.getRange(WARES.KPI_DATA_ROW, 1, WARES.KPI_MONTH_COUNT, 1).getDisplayValues();
  var bulan = [];
  for (var index = 0; index < WARES.KPI_MONTH_COUNT; index++) {
    bulan.push([optionalText_(terisi[index][0]) || kpiMonthLabel_(index)]);
  }
  sheet.getRange(WARES.KPI_DATA_ROW, 1, WARES.KPI_MONTH_COUNT, 1).setValues(bulan);
}

function writeKpiDashboardBlock_(sheet) {
  var dash = WARES.KPI_DASH;
  sheet.getRange(1, dash.kpi).setValue("DASHBOARD KPI");
  sheet.getRange(2, dash.kpi).setValue(
    "Terisi otomatis. Ubah PERIODE untuk melihat Overall atau satu bulan tertentu."
  );
  sheet.getRange(WARES.KPI_PERIOD_LABEL_CELL).setValue("PERIODE");
  sheet.getRange(WARES.KPI_DASH_HEADER_ROW, dash.kpi, 1, dash.arah - dash.kpi + 1)
    .setValues([["KPI", "PEMBILANG", "PENYEBUT", "NILAI", "SATUAN", "TARGET", "ARAH BAIK"]]);

  var awal = WARES.KPI_DATA_ROW;
  var akhir = WARES.KPI_FORMULA_LAST_ROW;
  var periode = absoluteCell_(WARES.KPI_PERIOD_CELL);
  var rentangBulan = "$A$" + awal + ":$A$" + akhir;

  for (var index = 0; index < WARES_KPI.length; index++) {
    var definisi = WARES_KPI[index];
    var baris = WARES.KPI_DASH_HEADER_ROW + 1 + index;
    var selPembilang = columnLetter_(dash.pembilang) + baris;
    var selPenyebut = columnLetter_(dash.penyebut) + baris;
    var bagi = selPembilang + "/" + selPenyebut + (definisi[4] === "persen" ? "*100" : "");

    sheet.getRange(baris, dash.kpi).setValue(definisi[1]);
    sheet.getRange(baris, dash.pembilang).setFormula(
      kpiSumFormula_(columnLetter_(2 + kpiInputIndex_(definisi[2])), periode, rentangBulan, awal, akhir)
    );
    sheet.getRange(baris, dash.penyebut).setFormula(
      kpiSumFormula_(columnLetter_(2 + kpiInputIndex_(definisi[3])), periode, rentangBulan, awal, akhir)
    );
    // Penyebut nol berarti BELUM ADA DATA, bukan nilai nol — selnya dikosongkan
    // supaya tidak terbaca sebagai capaian 0%.
    sheet.getRange(baris, dash.nilai).setFormula('=IF(' + selPenyebut + '<=0,"",' + bagi + ')');
    sheet.getRange(baris, dash.satuan).setValue(definisi[4] === "persen" ? "%" : "hari");
    sheet.getRange(baris, dash.arah).setValue(definisi[5]);
    // Kolom TARGET sengaja tidak ditulis: nilainya milik admin dan harus lestari
    // ketika setup dijalankan ulang.
  }
}

function kpiSumFormula_(kolom, periode, rentangBulan, awal, akhir) {
  var rentang = "$" + kolom + "$" + awal + ":$" + kolom + "$" + akhir;
  return '=IF(' + periode + '="' + WARES.KPI_PERIOD_OVERALL + '",SUM(' + rentang + '),' +
    'SUMIF(' + rentangBulan + ',' + periode + ',' + rentang + '))';
}

function applyKpiPeriodValidation_(sheet) {
  var opsi = [WARES.KPI_PERIOD_OVERALL];
  sheet.getRange(WARES.KPI_DATA_ROW, 1, WARES.KPI_MONTH_COUNT, 1).getDisplayValues()
    .forEach(function (baris) {
      var label = optionalText_(baris[0]);
      if (label && opsi.indexOf(label) === -1) opsi.push(label);
    });

  var sel = sheet.getRange(WARES.KPI_PERIOD_CELL);
  sel.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(opsi, true).setAllowInvalid(false).build()
  );
  if (!optionalText_(sel.getDisplayValue())) sel.setValue(WARES.KPI_PERIOD_OVERALL);
}

function styleKpiSheet_(sheet) {
  var dash = WARES.KPI_DASH;
  var hijau = "#00A547";
  var kuningLembut = "#FFF7D6";

  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  sheet.getRange(1, dash.kpi).setFontSize(14).setFontWeight("bold");
  sheet.getRange(2, 1).setFontSize(10).setFontColor("#6B7280");
  sheet.getRange(2, dash.kpi).setFontSize(10).setFontColor("#6B7280");
  sheet.getRange(WARES.KPI_PERIOD_LABEL_CELL).setFontWeight("bold");
  sheet.getRange(WARES.KPI_PERIOD_CELL).setBackground(kuningLembut).setFontWeight("bold");

  sheet.getRange(WARES.KPI_HEADER_ROW, 1, 1, WARES_KPI_INPUT.length + 1)
    .setBackground(hijau).setFontColor("#FFFFFF").setFontWeight("bold")
    .setWrap(true).setVerticalAlignment("middle");
  sheet.getRange(WARES.KPI_DASH_HEADER_ROW, dash.kpi, 1, dash.arah - dash.kpi + 1)
    .setBackground(hijau).setFontColor("#FFFFFF").setFontWeight("bold")
    .setWrap(true).setVerticalAlignment("middle");

  sheet.setColumnWidth(1, 120);
  for (var kolom = 2; kolom <= WARES_KPI_INPUT.length + 1; kolom++) sheet.setColumnWidth(kolom, 132);
  sheet.setColumnWidth(dash.kpi - 1, 28);
  sheet.setColumnWidth(dash.kpi, 250);
  sheet.setColumnWidth(dash.arah, 200);

  var tinggi = WARES_KPI.length;
  sheet.getRange(WARES.KPI_DATA_ROW, 2, WARES.KPI_MONTH_COUNT, WARES_KPI_INPUT.length)
    .setNumberFormat("#,##0.###");
  sheet.getRange(WARES.KPI_DASH_HEADER_ROW + 1, dash.nilai, tinggi, 1)
    .setNumberFormat("0.00").setFontWeight("bold");
  sheet.getRange(WARES.KPI_DASH_HEADER_ROW + 1, dash.target, tinggi, 1)
    .setBackground(kuningLembut).setNumberFormat("0.##");

  if (sheet.getFrozenRows() < WARES.KPI_HEADER_ROW) sheet.setFrozenRows(WARES.KPI_HEADER_ROW);
  if (sheet.getFrozenColumns() < 1) sheet.setFrozenColumns(1);
}

/**
 * Data KPI mentah untuk website. Sengaja mengembalikan pembilang & penyebut,
 * bukan hasil persen, agar website menghitung dengan rumus yang sama persis.
 */
function getKpiData_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(WARES.KPI_SHEET);
  if (!sheet) {
    throw apiError_(
      "KPI_SHEET_MISSING",
      'Sheet "' + WARES.KPI_SHEET + '" belum ada. Jalankan fungsi setupDashboardKpi dari editor Apps Script.'
    );
  }
  var layout = kpiInputLayout_(sheet);
  return {
    months: readKpiMonths_(sheet, layout),
    targets: readKpiTargets_(sheet),
    sheetName: sheet.getName(),
    generatedAt: new Date().toISOString()
  };
}

function kpiInputLayout_(sheet) {
  var aliases = { bulan: ["BULAN"] };
  WARES_KPI_INPUT.forEach(function (kolom) { aliases[kolom[0]] = [kolom[1]]; });
  var header = findHeaderWithAliases_(sheet, aliases);
  if (!header) {
    throw apiError_(
      "INVALID_SHEET",
      "Header sheet " + WARES.KPI_SHEET + " tidak lengkap. Jalankan ulang setupDashboardKpi."
    );
  }
  return {
    headerRow: header.row,
    dataStartRow: header.row + 1,
    columns: header.columns,
    lastColumn: header.lastColumn
  };
}

function readKpiMonths_(sheet, layout) {
  var lastRow = sheet.getLastRow();
  if (lastRow < layout.dataStartRow) return [];
  var values = sheet.getRange(
    layout.dataStartRow,
    1,
    lastRow - layout.dataStartRow + 1,
    layout.lastColumn
  ).getValues();

  var hasil = [];
  var sudahAda = {};
  values.forEach(function (baris) {
    var bulan = parseKpiMonth_(baris[layout.columns.bulan - 1]);
    // Baris tanpa label bulan yang sah dilewati, termasuk baris catatan bebas.
    if (!bulan || sudahAda[bulan]) return;
    sudahAda[bulan] = true;
    var nilai = {};
    WARES_KPI_INPUT.forEach(function (kolom) {
      var mentah = baris[layout.columns[kolom[0]] - 1];
      var angka = (mentah === "" || mentah == null) ? 0 : number_(mentah);
      nilai[kolom[0]] = isFinite(angka) && angka > 0 ? angka : 0;
    });
    hasil.push({ bulan: bulan, label: labelKpiMonth_(bulan), nilai: nilai });
  });
  return hasil.sort(function (a, b) { return a.bulan < b.bulan ? -1 : (a.bulan > b.bulan ? 1 : 0); });
}

function readKpiTargets_(sheet) {
  var targets = {};
  var layout = kpiDashboardLayout_(sheet);
  if (!layout) return targets;
  var tinggi = WARES_KPI.length;
  if (layout.headerRow + tinggi > sheet.getMaxRows()) return targets;

  var nama = sheet.getRange(layout.headerRow + 1, layout.kpiColumn, tinggi, 1).getDisplayValues();
  var nilai = sheet.getRange(layout.headerRow + 1, layout.targetColumn, tinggi, 1).getValues();
  for (var index = 0; index < tinggi; index++) {
    var definisi = kpiDefinitionByName_(nama[index][0]);
    if (!definisi) continue;
    var mentah = nilai[index][0];
    if (mentah === "" || mentah == null) continue;
    var angka = number_(mentah);
    if (isFinite(angka) && angka > 0) targets[definisi[0]] = angka;
  }
  return targets;
}

function kpiDashboardLayout_(sheet) {
  var rowCount = Math.min(Math.max(sheet.getLastRow(), 1), 20);
  var columnCount = Math.max(sheet.getLastColumn(), 1);
  var values = sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues();
  for (var baris = 0; baris < values.length; baris++) {
    var kpiColumn = 0;
    var targetColumn = 0;
    for (var kolom = 0; kolom < values[baris].length; kolom++) {
      var kunci = normalize_(values[baris][kolom]);
      if (kunci === "KPI" && !kpiColumn) kpiColumn = kolom + 1;
      if (kunci === "TARGET" && !targetColumn) targetColumn = kolom + 1;
    }
    if (kpiColumn && targetColumn) {
      return { headerRow: baris + 1, kpiColumn: kpiColumn, targetColumn: targetColumn };
    }
  }
  return null;
}

function kpiDefinitionByName_(nama) {
  var wanted = normalize_(nama);
  if (!wanted) return null;
  for (var index = 0; index < WARES_KPI.length; index++) {
    if (normalize_(WARES_KPI[index][1]) === wanted) return WARES_KPI[index];
  }
  return null;
}

function kpiInputIndex_(field) {
  for (var index = 0; index < WARES_KPI_INPUT.length; index++) {
    if (WARES_KPI_INPUT[index][0] === field) return index;
  }
  throw apiError_("INTERNAL_ERROR", "Field KPI " + field + " tidak dikenal.", false);
}

/** Menerima "Juli 2026", "Jul 2026", "2026-07", atau sel bertipe tanggal. */
function parseKpiMonth_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, WARES.TIME_ZONE, "yyyy-MM");
  }
  var text = optionalText_(value);
  if (!text) return null;

  var iso = text.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (iso) {
    var bulanIso = Number(iso[2]);
    return bulanIso >= 1 && bulanIso <= 12 ? iso[1] + "-" + padTwo_(bulanIso) : null;
  }
  var bernama = text.match(/^(\S+)\s+(\d{4})$/);
  if (bernama) {
    var index = kpiMonthIndex_(bernama[1]);
    if (index >= 0) return bernama[2] + "-" + padTwo_(index + 1);
  }
  return null;
}

function kpiMonthIndex_(nama) {
  var wanted = normalize_(nama);
  for (var index = 0; index < WARES.MONTHS.length; index++) {
    var kanonik = normalize_(WARES.MONTHS[index]);
    if (kanonik === wanted || kanonik.slice(0, 3) === wanted) return index;
  }
  return -1;
}

function labelKpiMonth_(bulan) {
  var bagian = String(bulan).split("-");
  var nama = WARES.MONTHS[Number(bagian[1]) - 1];
  return nama ? nama + " " + bagian[0] : bulan;
}

function kpiMonthLabel_(offset) {
  var total = WARES.KPI_START_YEAR * 12 + WARES.KPI_START_MONTH_INDEX + offset;
  return WARES.MONTHS[total % 12] + " " + Math.floor(total / 12);
}

function padTwo_(value) {
  return (value < 10 ? "0" : "") + value;
}

function absoluteCell_(a1) {
  var bagian = String(a1).match(/^([A-Za-z]+)(\d+)$/);
  return bagian ? "$" + bagian[1].toUpperCase() + "$" + bagian[2] : a1;
}

function getStockSnapshot_() {
  var report = ensureCurrentMonthReport_();
  var layout = detectReportLayout_(report);
  syncReportFromJournalsCached_(report, layout);
  var rows = readReportMaterials_(report, layout);
  var stockByRow = calculateClosingStocksBatch_(report, rows, layout);
  var reportItems = rows.map(function (entry) {
    return {
      kode_barang: entry.code || null,
      nama_barang: entry.name,
      kategori: entry.category,
      lokasi: entry.location,
      satuan: entry.unit,
      stok: stockByRow[entry.row] || 0,
      rack: null,
      area: ""
    };
  });
  var items = enrichStockFromMaster_(reportItems);

  return {
    items: items,
    keterangan: getIncomingNotes_(),
    reportSheet: report.getName(),
    generatedAt: new Date().toISOString()
  };
}

function enrichStockFromMaster_(stockItems) {
  var master;
  try {
    master = readMasterDataRows_(ensureMasterLayout_(false));
  } catch (error) {
    console.warn("MASTER DATA belum dapat memperkaya snapshot stok", error);
    return stockItems;
  }
  var byCode = {};
  var byName = {};
  var duplicateNames = {};
  master.forEach(function (item) {
    if (item.material_number) byCode[normalize_(item.material_number)] = item;
    var name = normalize_(item.nama_barang);
    if (byName[name]) duplicateNames[name] = true;
    else byName[name] = item;
  });

  var seenRows = {};
  var result = [];
  stockItems.forEach(function (stock) {
    var detail = stock.kode_barang ? byCode[normalize_(stock.kode_barang)] : null;
    if (!detail && !duplicateNames[normalize_(stock.nama_barang)]) {
      detail = byName[normalize_(stock.nama_barang)];
    }
    if (detail && detail.status === "NONAKTIF") return;
    if (detail) seenRows[detail.row] = true;
    result.push({
      kode_barang: (detail && detail.material_number) || stock.kode_barang || null,
      nama_barang: (detail && detail.nama_barang) || stock.nama_barang,
      kategori: (detail && detail.kategori) || stock.kategori,
      lokasi: (detail && detail.lokasi) || stock.lokasi,
      satuan: (detail && detail.satuan) || stock.satuan,
      stok: stock.stok,
      rack: detail ? detail.rack : null,
      area: detail ? detail.area : ""
    });
  });

  // Slot Master Data yang baru diisi langsung muncul dengan stok 0, walaupun
  // formula laporan bulanannya belum sempat menghitung transaksi pertama.
  master.forEach(function (detail) {
    if (detail.status === "NONAKTIF" || seenRows[detail.row]) return;
    result.push({
      kode_barang: detail.material_number || null,
      nama_barang: detail.nama_barang,
      kategori: detail.kategori,
      lokasi: detail.lokasi,
      satuan: detail.satuan || "",
      stok: 0,
      rack: detail.rack,
      area: detail.area
    });
  });
  return result.sort(function (a, b) { return a.nama_barang.localeCompare(b.nama_barang); });
}

/**
 * Banyak browser dapat melakukan polling bersamaan. Satu sinkronisasi penuh per
 * beberapa menit cukup untuk menangkap edit jurnal manual, sedangkan transaksi
 * dari website tetap memperbarui sel terkait secara langsung di bawah lock.
 */
function syncReportFromJournalsCached_(report, layout) {
  var cache = CacheService.getScriptCache();
  var key = "wares-report-sync-" + report.getSheetId();
  if (cache.get(key)) return;
  syncReportFromJournals_(report, layout);
  cache.put(key, "1", WARES.STOCK_SYNC_CACHE_SECONDS);
}

function invalidateReportSyncCache_(report) {
  if (!report) return;
  CacheService.getScriptCache().remove("wares-report-sync-" + report.getSheetId());
}

/**
 * Baca stok seluruh material dengan satu panggilan Spreadsheet service. Versi
 * lama memanggil getRange/getValues dua kali per material sehingga ratusan baris
 * dapat memerlukan lebih dari 30 detik.
 */
function calculateClosingStocksBatch_(sheet, materials, layout) {
  var result = {};
  if (!materials.length) return result;
  var firstRow = materials[0].row;
  var lastRow = materials[materials.length - 1].row;
  var movementOffset = layout.firstDayColumn - layout.openingColumn;
  var width = movementOffset + layout.dayColumnCount;
  var values = sheet.getRange(
    firstRow,
    layout.openingColumn,
    lastRow - firstRow + 1,
    width
  ).getValues();

  materials.forEach(function (material) {
    var row = values[material.row - firstRow] || [];
    var stock = number_(row[0]);
    for (var day = 0; day < layout.dayColumnCount; day++) {
      stock += number_(row[movementOffset + day]);
    }
    result[material.row] = stock;
  });
  return result;
}

/**
 * Stok akurat untuk material yang sedang diminta, tanpa membangun ulang seluruh
 * matriks laporan. Hanya dua pembacaan batch jurnal (MASUK dan KELUAR) sehingga
 * edit manual tetap diperhitungkan tetapi transaksi tidak tertahan oleh ratusan
 * operasi setValues pada laporan.
 */
function calculateJournalClosingStocksForTargets_(report, layout, materials) {
  var result = {};
  if (!materials.length) return result;
  var month = parseReportMonth_(report.getName());
  if (!month) return calculateClosingStocksBatch_(report, materials, layout);

  var firstRow = materials[0].row;
  var lastRow = materials[materials.length - 1].row;
  var openingValues = report
    .getRange(firstRow, layout.openingColumn, lastRow - firstRow + 1, 1)
    .getValues();
  var targetsByCode = {};
  var targetsByName = {};
  var duplicateNames = {};
  materials.forEach(function (material) {
    result[material.row] = number_(openingValues[material.row - firstRow][0]);
    if (material.code) targetsByCode[normalize_(material.code)] = material.row;
    var nameKey = normalize_(material.name);
    if (targetsByName[nameKey] != null) duplicateNames[nameKey] = true;
    else targetsByName[nameKey] = material.row;
  });

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  addJournalMovementsForTargets_(
    requireSheet_(spreadsheet, WARES.INCOMING_SHEET),
    "incoming",
    1,
    month,
    targetsByCode,
    targetsByName,
    duplicateNames,
    result
  );
  addJournalMovementsForTargets_(
    requireSheet_(spreadsheet, WARES.OUTGOING_SHEET),
    "outgoing",
    -1,
    month,
    targetsByCode,
    targetsByName,
    duplicateNames,
    result
  );
  return result;
}

function addJournalMovementsForTargets_(
  sheet,
  kind,
  sign,
  month,
  targetsByCode,
  targetsByName,
  duplicateNames,
  result
) {
  var journalLayout = ensureJournalLayout_(sheet, kind);
  var lastRow = sheet.getLastRow();
  if (lastRow <= journalLayout.headerRow) return;
  var targetMonth = Utilities.formatDate(month.date, WARES.TIME_ZONE, "yyyy-MM");
  var values = sheet
    .getRange(
      journalLayout.headerRow + 1,
      1,
      lastRow - journalLayout.headerRow,
      journalLayout.lastColumn
    )
    .getValues();
  values.forEach(function (row) {
    var date;
    try { date = parseDate_(row[journalLayout.dateColumn - 1]); } catch (_) { return; }
    if (Utilities.formatDate(date, WARES.TIME_ZONE, "yyyy-MM") !== targetMonth) return;
    var code = journalLayout.columns[WARES.TECH.materialCode]
      ? normalize_(row[journalLayout.columns[WARES.TECH.materialCode] - 1])
      : "";
    var name = normalize_(row[journalLayout.itemColumn - 1]);
    var targetRow = code ? targetsByCode[code] : null;
    if (targetRow == null && !duplicateNames[name]) targetRow = targetsByName[name];
    if (targetRow == null) return;
    result[targetRow] += sign * number_(row[journalLayout.quantityColumn - 1]);
  });
}

function recordIncoming_(raw) {
  var input = validateIncoming_(raw);
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var journal = requireSheet_(spreadsheet, WARES.INCOMING_SHEET);
  var layout = ensureJournalLayout_(journal, "incoming");
  var report = ensureCurrentMonthReport_(input.date);
  var reportLayout = detectReportLayout_(report);
  var material = ensureReportMaterial_(report, reportLayout, input);
  var transactionId = input.transactionId || Utilities.getUuid();

  var oldEntries = readIncomingTransactionRows_(journal, layout, transactionId);
  var existingRows = oldEntries.map(function (entry) { return entry.row; });
  var values = buildIncomingJournalRow_(layout, input, transactionId);
  if (existingRows.length) {
    journal.getRange(existingRows[0], 1, 1, layout.lastColumn).setValues([values]);
    deleteJournalRows_(journal, existingRows.slice(1));
  } else {
    appendJournalRow_(journal, layout, values);
  }
  updateMasterStorageFromIncoming_(input);
  // Pastikan ID transaksi terlihat oleh incoming.status sebelum pembaruan
  // laporan bulanan yang lebih berat selesai.
  SpreadsheetApp.flush();
  invalidateReportSyncCache_(report);

  oldEntries.forEach(function (oldEntry) {
    var oldReport = spreadsheet.getSheetByName(reportName_(oldEntry.date));
    if (!oldReport) return;
    invalidateReportSyncCache_(oldReport);
    var oldLayout = detectReportLayout_(oldReport);
    var oldMaterial = findReportMaterial_(oldReport, oldLayout, oldEntry.materialCode, oldEntry.name);
    if (oldMaterial) {
      refreshReportDay_(oldReport, oldLayout, oldMaterial, oldEntry.date);
      propagateMaterialForward_(oldMaterial, oldEntry.date);
    }
  });
  refreshReportDay_(report, reportLayout, material, input.date);
  propagateMaterialForward_(material, input.date);
  return {
    ok: true,
    transactionId: transactionId,
    reportSheet: report.getName(),
    stock: calculateClosingStock_(report, material.row, reportLayout)
  };
}

function updateMasterStorageFromIncoming_(input) {
  if (input.rack == null) return;
  var layout = ensureMasterLayout_(false);
  var rows = readMasterDataRows_(layout);
  var wanted = null;
  if (input.code) {
    var code = normalize_(input.code);
    wanted = rows.filter(function (item) {
      return normalize_(item.material_number) === code;
    })[0] || null;
  }
  if (!wanted) {
    var name = normalize_(input.name);
    var byName = rows.filter(function (item) { return normalize_(item.nama_barang) === name; });
    if (byName.length === 1) wanted = byName[0];
  }
  if (!wanted) return;
  layout.sheet.getRange(wanted.row, layout.rackColumn).setValue(input.rack);
  layout.sheet.getRange(wanted.row, layout.areaColumn).setValue(safeCellText_(input.area));
}

/**
 * Konfirmasi versi transaksi KELUAR tanpa LockService dan tanpa menyentuh
 * laporan. `found` baru true setelah semua baris operasi memiliki syncToken
 * yang sama dan jumlahnya sesuai marker expectedLines. Ini mencegah pembacaan
 * setengah jadi saat outgoing.replace masih menulis beberapa baris.
 */
function getOutgoingStatus_(raw) {
  raw = raw || {};
  var requestId = limitedText_(raw.request_id || raw.requestId, "requestId", 128, true);
  var wantedToken = limitedText_(raw.sync_token || raw.syncToken, "syncToken", 128, false);
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var journal = requireSheet_(spreadsheet, WARES.OUTGOING_SHEET);
  var requiredVisible = ["TANGGAL", "BARANG", "JUMLAH KELUAR", "KETERANGAN", "EQUIPMENT", "PIC"];
  var header = findJournalHeader_(journal, requiredVisible);
  if (!header) throw apiError_("INVALID_SHEET", "Header sheet " + journal.getName() + " tidak ditemukan.");

  var requestColumn = header.columns[WARES.TECH.requestId];
  var tokenColumn = header.columns[WARES.TECH.syncToken];
  var expectedColumn = header.columns[WARES.TECH.expectedLines];
  var lastRow = journal.getLastRow();
  if (!requestColumn || !tokenColumn || !expectedColumn || lastRow <= header.row) {
    return { found: false, requestId: requestId, syncToken: wantedToken };
  }

  var values = journal.getRange(header.row + 1, 1, lastRow - header.row, header.lastColumn).getValues();
  var requestRows = values.filter(function (row) {
    return String(row[requestColumn - 1] || "") === requestId;
  });
  if (!requestRows.length) return { found: false, requestId: requestId, syncToken: wantedToken };

  // Bila token tidak diberikan, pilih versi paling baru hanya untuk inspeksi.
  // UI edit selalu mengirim token agar versi lama tidak dianggap berhasil.
  if (!wantedToken) {
    var updatedColumn = header.columns[WARES.TECH.updatedAt];
    var newest = requestRows.slice().sort(function (a, b) {
      return String(b[(updatedColumn || tokenColumn) - 1] || "").localeCompare(
        String(a[(updatedColumn || tokenColumn) - 1] || "")
      );
    })[0];
    wantedToken = String(newest[tokenColumn - 1] || "");
  }

  var matchingRows = requestRows.filter(function (row) {
    return String(row[tokenColumn - 1] || "") === wantedToken;
  });
  var expectedLines = matchingRows.length
    ? number_(matchingRows[0][expectedColumn - 1])
    : 0;
  var complete = Boolean(
    wantedToken &&
    expectedLines > 0 &&
    matchingRows.length === expectedLines &&
    requestRows.length === matchingRows.length
  );
  if (!complete) {
    return {
      found: false,
      requestId: requestId,
      syncToken: wantedToken,
      recordedLines: matchingRows.length,
      expectedLines: expectedLines
    };
  }

  var first = matchingRows[0];
  var dateColumn = findNormalizedColumn_(header.columns, "TANGGAL");
  var itemColumn = findNormalizedColumn_(header.columns, "BARANG");
  var quantityColumn = findNormalizedColumn_(header.columns, "JUMLAH KELUAR");
  var noteColumn = findNormalizedColumn_(header.columns, "KETERANGAN");
  var equipmentColumn = findNormalizedColumn_(header.columns, "EQUIPMENT");
  var picColumn = findNormalizedColumn_(header.columns, "PIC");
  var categories = [];
  var categoriesColumn = header.columns[WARES.TECH.categories];
  if (categoriesColumn) {
    try {
      var decoded = JSON.parse(String(first[categoriesColumn - 1] || "[]"));
      if (Array.isArray(decoded)) categories = decoded.map(function (value) { return String(value); });
    } catch (_) {
      categories = [];
    }
  }

  return {
    found: true,
    requestId: requestId,
    syncToken: wantedToken,
    recordedLines: matchingRows.length,
    expectedLines: expectedLines,
    transaction: {
      actorId: valueAtTech_(first, header, WARES.TECH.actorId),
      operation: valueAtTech_(first, header, WARES.TECH.operation) || "create",
      tanggal: dayKey_(first[dateColumn - 1]),
      occurredAt: valueAtTech_(first, header, WARES.TECH.createdAt) || dayKey_(first[dateColumn - 1]),
      pekerjaan: literalCellText_(first[noteColumn - 1]),
      lokasiPekerjaan: literalCellText_(first[equipmentColumn - 1]),
      pic: literalCellText_(first[picColumn - 1]),
      kategori: categories,
      items: matchingRows.map(function (row) {
        var catalogValue = valueAtTech_(row, header, WARES.TECH.catalogItemId);
        return {
          lineId: valueAtTech_(row, header, WARES.TECH.lineId),
          catalogItemId: catalogValue ? number_(catalogValue) : null,
          kodeBarang: valueAtTech_(row, header, WARES.TECH.materialCode) || null,
          kategori: valueAtTech_(row, header, WARES.TECH.itemCategory),
          lokasi: valueAtTech_(row, header, WARES.TECH.itemLocation),
          namaBarang: literalCellText_(row[itemColumn - 1]),
          satuan: valueAtTech_(row, header, WARES.TECH.itemUnit),
          jumlahPermintaan: number_(valueAtTech_(row, header, WARES.TECH.requestedQty)),
          jumlahDiberikan: number_(row[quantityColumn - 1])
        };
      })
    }
  };
}

function valueAtTech_(row, header, technicalHeader) {
  var column = header.columns[technicalHeader];
  return column ? literalCellText_(row[column - 1]) : "";
}

/**
 * Membaca hasil transaksi MASUK berdasarkan ID idempoten tanpa menunggu
 * LockService. Fungsi ini hanya membaca jurnal dan tidak memicu sinkronisasi
 * laporan, sehingga aman dipakai untuk konfirmasi setelah HTTP timeout.
 */
function getIncomingStatus_(raw) {
  raw = raw || {};
  var transactionId = requiredText_(
    raw.transaction_id || raw.transactionId,
    "transactionId"
  );
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var journal = requireSheet_(spreadsheet, WARES.INCOMING_SHEET);
  var requiredVisible = ["TANGGAL", "BARANG", "JUMLAH MASUK", "KETERANGAN"];
  var header = findJournalHeader_(journal, requiredVisible);
  if (!header) {
    throw apiError_("INVALID_SHEET", "Header sheet " + journal.getName() + " tidak ditemukan.");
  }

  var transactionColumn = header.columns[WARES.TECH.transactionId];
  var lastRow = journal.getLastRow();
  if (!transactionColumn || lastRow <= header.row) {
    return { found: false, transactionId: transactionId };
  }

  var ids = journal
    .getRange(header.row + 1, transactionColumn, lastRow - header.row, 1)
    .getDisplayValues();
  var rowNumber = 0;
  for (var index = ids.length - 1; index >= 0; index--) {
    if (String(ids[index][0] || "") === transactionId) {
      rowNumber = header.row + 1 + index;
      break;
    }
  }
  if (!rowNumber) return { found: false, transactionId: transactionId };

  var row = journal.getRange(rowNumber, 1, 1, header.lastColumn).getValues()[0];
  var dateColumn = findNormalizedColumn_(header.columns, "TANGGAL");
  var itemColumn = findNormalizedColumn_(header.columns, "BARANG");
  var quantityColumn = findNormalizedColumn_(header.columns, "JUMLAH MASUK");
  var noteColumn = findNormalizedColumn_(header.columns, "KETERANGAN");
  var materialCodeColumn = header.columns[WARES.TECH.materialCode];
  var rackColumn = header.columns[WARES.TECH.itemRack];
  var areaColumn = header.columns[WARES.TECH.itemArea];
  var createdAtColumn = header.columns[WARES.TECH.createdAt];
  var updatedAtColumn = header.columns[WARES.TECH.updatedAt];

  return {
    found: true,
    transactionId: transactionId,
    transaction: {
      tanggal: dayKey_(row[dateColumn - 1]),
      kode_barang: materialCodeColumn ? literalCellText_(row[materialCodeColumn - 1]) : "",
      nama_barang: literalCellText_(row[itemColumn - 1]),
      jumlah: number_(row[quantityColumn - 1]),
      keterangan: literalCellText_(row[noteColumn - 1]),
      rack: rackColumn ? parseRackNumber_(row[rackColumn - 1]) : null,
      area: areaColumn ? literalCellText_(row[areaColumn - 1]) : "",
      createdAt: createdAtColumn ? String(row[createdAtColumn - 1] || "") : "",
      updatedAt: updatedAtColumn ? String(row[updatedAtColumn - 1] || "") : ""
    }
  };
}

/**
 * Idempotent request replacement. Versi operasi dibedakan oleh syncToken;
 * baris requestId lama diganti sehingga retry token yang sama tidak mengganda.
 */
function replaceOutgoing_(raw) {
  var input = validateOutgoing_(raw);
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var journal = requireSheet_(spreadsheet, WARES.OUTGOING_SHEET);
  var layout = ensureJournalLayout_(journal, "outgoing");
  var report = ensureCurrentMonthReport_(input.date);
  var reportLayout = detectReportLayout_(report);
  var reportMaterials = readReportMaterials_(report, reportLayout);
  var oldRows = readOutgoingRequestRows_(journal, layout, input.requestId);
  var affected = {};

  oldRows.forEach(function (oldRow) {
    var oldKey = materialKey_(oldRow.materialCode, oldRow.name);
    if (!affected[oldKey]) affected[oldKey] = { code: oldRow.materialCode, name: oldRow.name, dates: {} };
    affected[oldKey].dates[dayKey_(oldRow.date)] = oldRow.date;
  });

  var groupedNew = {};
  input.items.forEach(function (item) {
    var material = findReportMaterialFromList_(reportMaterials, item.code, item.name);
    if (!material) {
      throw apiError_(
        "UNKNOWN_MATERIAL",
        "Barang " + item.name + " tidak ditemukan di database stok. Muat ulang daftar barang."
      );
    }
    var key = materialKey_(material.code, material.name);
    if (!groupedNew[key]) groupedNew[key] = { material: material, quantity: 0 };
    groupedNew[key].quantity += item.givenQuantity;
    if (!affected[key]) affected[key] = { code: material.code, name: material.name, dates: {} };
    affected[key].dates[dayKey_(input.date)] = input.date;
  });

  var oldQuantityByKey = {};
  oldRows.forEach(function (oldRow) {
    var key = materialKey_(oldRow.materialCode, oldRow.name);
    oldQuantityByKey[key] = (oldQuantityByKey[key] || 0) + oldRow.quantity;
  });

  var liveReport = ensureCurrentMonthReport_();
  var liveLayout = detectReportLayout_(liveReport);
  var liveReportMaterials = liveReport.getSheetId() === report.getSheetId()
    ? reportMaterials
    : readReportMaterials_(liveReport, liveLayout);
  var liveMaterials = [];
  var liveMaterialByKey = {};
  Object.keys(groupedNew).forEach(function (key) {
    var group = groupedNew[key];
    var liveMaterial = findReportMaterialFromList_(
      liveReportMaterials,
      group.material.code,
      group.material.name
    );
    if (!liveMaterial) {
      throw apiError_(
        "UNKNOWN_MATERIAL",
        "Barang " + group.material.name + " belum tersedia pada laporan stok bulan berjalan."
      );
    }
    liveMaterials.push(liveMaterial);
    liveMaterialByKey[key] = liveMaterial;
  });
  liveMaterials.sort(function (a, b) { return a.row - b.row; });
  var liveStocks = calculateJournalClosingStocksForTargets_(liveReport, liveLayout, liveMaterials);
  Object.keys(groupedNew).forEach(function (key) {
    var group = groupedNew[key];
    var liveMaterial = liveMaterialByKey[key];
    var current = liveStocks[liveMaterial.row] || 0;
    var availableForReplacement = current + (oldQuantityByKey[key] || 0);
    if (group.quantity > availableForReplacement) {
      throw apiError_(
        "INSUFFICIENT_STOCK",
        "Stok " + group.material.name + " tidak cukup. Tersedia " + availableForReplacement + "."
      );
    }
  });

  // Simpan juga baris dengan jumlah diberikan 0: KELUAR berfungsi sebagai
  // audit seluruh permintaan dan status operasi tetap dapat dikonfirmasi.
  replaceOutgoingJournalRows_(journal, layout, oldRows, input, input.items);
  // Marker versi transaksi harus durable sebelum penyegaran laporan yang bisa
  // memerlukan waktu lama. outgoing.status dapat membaca marker tanpa lock.
  SpreadsheetApp.flush();
  invalidateReportSyncCache_(report);
  invalidateReportSyncCache_(liveReport);

  if (report.getName() === reportName_(new Date())) {
    // Bulan berjalan cukup satu agregasi batch untuk semua material. Jalur lama
    // membaca seluruh MASUK/KELUAR dua kali per barang dan menjadi O(item*jurnal).
    syncReportFromJournalsCached_(report, reportLayout);
  } else {
    var affectedMaterialsBySheet = {};
    Object.keys(affected).forEach(function (key) {
      var entry = affected[key];
      Object.keys(entry.dates).forEach(function (dateKey) {
        var affectedDate = entry.dates[dateKey];
        var affectedReport = spreadsheet.getSheetByName(reportName_(affectedDate));
        if (!affectedReport) return;
        invalidateReportSyncCache_(affectedReport);
        var affectedLayout = detectReportLayout_(affectedReport);
        var sheetKey = String(affectedReport.getSheetId());
        var affectedMaterials = affectedMaterialsBySheet[sheetKey];
        if (!affectedMaterials) {
          affectedMaterials = readReportMaterials_(affectedReport, affectedLayout);
          affectedMaterialsBySheet[sheetKey] = affectedMaterials;
        }
        var material = findReportMaterialFromList_(affectedMaterials, entry.code, entry.name);
        if (!material) return;
        refreshReportDay_(affectedReport, affectedLayout, material, affectedDate);
        propagateMaterialForward_(material, affectedDate);
      });
    });
  }

  return {
    ok: true,
    requestId: input.requestId,
    syncToken: input.syncToken,
    recordedLines: input.items.length,
    reportSheet: report.getName()
  };
}

function validateIncoming_(raw) {
  raw = raw || {};
  var quantity = integer_(raw.jumlah != null ? raw.jumlah : raw.quantity, "jumlah", 1, 1000000000);
  var name = limitedText_(raw.nama_barang != null ? raw.nama_barang : raw.namaBarang, "nama_barang", 200, true);
  var storage = validateStorageSelection_(raw.rack, raw.area, true);
  return {
    transactionId: limitedText_(raw.transaction_id || raw.transactionId, "transactionId", 128, false),
    date: parseDate_(raw.tanggal || raw.date || new Date()),
    code: limitedText_(raw.kode_barang != null ? raw.kode_barang : raw.kodeBarang, "kode_barang", 100, false),
    name: name,
    category: limitedText_(raw.kategori || raw.category, "kategori", 120, false),
    location: limitedText_(raw.lokasi || raw.location, "lokasi", 120, false),
    unit: limitedText_(raw.satuan || raw.unit, "satuan", 40, false),
    type: limitedText_(raw.type_barang || raw.type, "type", 120, false),
    ecr: limitedText_(raw.ecr, "ecr", 100, false),
    rack: storage.rack,
    area: storage.area,
    quantity: quantity,
    note: limitedText_(raw.keterangan != null ? raw.keterangan : raw.note, "keterangan", 120, true)
  };
}

function validateStorageSelection_(rawRack, rawArea, required) {
  var rackText = optionalText_(rawRack);
  if (!rackText && !required) {
    return { rack: null, area: limitedText_(rawArea, "area", 120, false) };
  }
  var rack = parseRackNumber_(rawRack);
  var rackMap = rackMap_();
  if (!rack || !rackMap[rack]) {
    throw apiError_("INVALID_RACK", "Nomor rack wajib dipilih dari daftar RACK GUDANG.");
  }
  var requestedArea = limitedText_(rawArea, "area", 120, false) || rackMap[rack];
  var canonicalArea = "";
  Object.keys(rackMap).some(function (number) {
    if (normalize_(rackMap[number]) === normalize_(requestedArea)) {
      canonicalArea = rackMap[number];
      return true;
    }
    return false;
  });
  if (!canonicalArea) throw apiError_("INVALID_AREA", "Area wajib dipilih dari daftar RACK GUDANG.");
  return { rack: rack, area: canonicalArea };
}

function validateOutgoing_(raw) {
  raw = raw || {};
  var requestId = limitedText_(raw.request_id || raw.requestId, "requestId", 128, true);
  var items = raw.items;
  if (!Array.isArray(items) || !items.length) {
    throw apiError_("INVALID_INPUT", "items harus berupa array dan minimal berisi satu barang.");
  }
  if (items.length > 100) throw apiError_("INVALID_INPUT", "Maksimal 100 barang per permintaan.");
  // Fallback menjaga rollout Apps Script tetap kompatibel beberapa menit dengan
  // deployment Vercel lama. Route baru selalu mengirim semua marker ini.
  var rawCategories = raw.kategori || raw.categories || ["UMUM"];
  if (!Array.isArray(rawCategories) || !rawCategories.length || rawCategories.length > 20) {
    throw apiError_("INVALID_INPUT", "Kategori pekerjaan harus berisi 1 sampai 20 pilihan.");
  }
  var operation = limitedText_(raw.operation, "operation", 16, false) || "create";
  if (operation !== "create" && operation !== "edit") {
    throw apiError_("INVALID_INPUT", "operation harus create atau edit.");
  }
  return {
    requestId: requestId,
    syncToken: limitedText_(raw.sync_token || raw.syncToken || requestId, "syncToken", 128, true),
    actorId: limitedText_(raw.actor_id || raw.actorId || "legacy", "actorId", 128, true),
    operation: operation,
    categories: rawCategories.map(function (value, index) {
      return limitedText_(value, "kategori[" + index + "]", 80, true);
    }),
    date: parseDate_(raw.tanggal || raw.date || new Date()),
    job: limitedText_(raw.pekerjaan || raw.job, "pekerjaan", 500, true),
    jobLocation: limitedText_(raw.lokasi_pekerjaan || raw.lokasiPekerjaan || raw.jobLocation, "lokasi_pekerjaan", 120, true),
    recipient: limitedText_(raw.pic || raw.nama_penerima || raw.recipient, "pic", 120, true),
    items: items.map(function (item, index) {
      item = item || {};
      var requested = integer_(
        item.jumlah_permintaan != null ? item.jumlah_permintaan :
          (item.jumlahPermintaan != null ? item.jumlahPermintaan : item.requestedQuantity),
        "items[" + index + "].jumlahPermintaan",
        1,
        1000000000
      );
      var given = integer_(
        item.jumlah_diberikan != null ? item.jumlah_diberikan :
          (item.jumlahDiberikan != null ? item.jumlahDiberikan : item.givenQuantity),
        "items[" + index + "].jumlahDiberikan",
        0,
        1000000000
      );
      if (given > requested) {
        throw apiError_("INVALID_QUANTITY", "Jumlah diberikan tidak boleh melebihi jumlah permintaan.");
      }
      var catalogItemIdRaw = item.catalog_item_id != null ? item.catalog_item_id : item.catalogItemId;
      var catalogItemId = catalogItemIdRaw == null || catalogItemIdRaw === ""
        ? null
        : integer_(catalogItemIdRaw, "items[" + index + "].catalogItemId", 1, 9007199254740991);
      return {
        lineId: limitedText_(item.line_id || item.lineId, "lineId", 128, false) || (requestId + ":" + index),
        catalogItemId: catalogItemId,
        code: limitedText_(item.kode_barang != null ? item.kode_barang : item.kodeBarang, "kode_barang", 100, false),
        name: limitedText_(item.nama_barang != null ? item.nama_barang : item.namaBarang, "nama_barang", 200, true),
        category: limitedText_(item.kategori || item.category, "kategori_barang", 120, false),
        location: limitedText_(item.lokasi || item.location, "lokasi_barang", 120, false),
        unit: limitedText_(item.satuan || item.unit, "satuan", 40, true),
        type: limitedText_(item.type_barang || item.type, "type", 120, false),
        ecr: limitedText_(item.ecr, "ecr", 100, false),
        requestedQuantity: requested,
        givenQuantity: given
      };
    })
  };
}

function ensureCurrentMonthReport_(date) {
  date = date ? parseDate_(date) : new Date();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var targetName = reportName_(date);
  var existing = spreadsheet.getSheetByName(targetName);
  if (existing && getReportState_(existing) !== "BUILDING") return existing;

  var template = requireSheet_(spreadsheet, WARES.TEMPLATE_SHEET);
  var priorDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  var prior = spreadsheet.getSheetByName(reportName_(priorDate));
  if (prior) {
    var priorLayout = detectReportLayout_(prior);
    syncReportFromJournals_(prior, priorLayout);
  }
  var created = existing;
  if (!created) {
    // Marker dipasang sebelum nama final. Jika inisialisasi terputus, pemanggilan
    // berikutnya mengenali sheet BUILDING dan melanjutkan reset secara idempoten.
    created = template.copyTo(spreadsheet);
    setReportState_(created, "BUILDING");
    created.setName(targetName);
  }
  var layout = detectReportLayout_(created);

  mergePreviousMaterials_(created, layout, prior);
  resetNewMonthReport_(created, layout, prior, date);
  SpreadsheetApp.flush();
  setReportState_(created, "READY");
  spreadsheet.setActiveSheet(created);
  spreadsheet.moveActiveSheet(spreadsheet.getNumSheets());
  return created;
}

function getReportState_(sheet) {
  var metadata = sheet.getDeveloperMetadata();
  for (var index = 0; index < metadata.length; index++) {
    if (metadata[index].getKey() === WARES.REPORT_STATE_KEY) return metadata[index].getValue();
  }
  return "";
}

function setReportState_(sheet, state) {
  sheet.getDeveloperMetadata().forEach(function (entry) {
    if (entry.getKey() === WARES.REPORT_STATE_KEY) entry.remove();
  });
  sheet.addDeveloperMetadata(WARES.REPORT_STATE_KEY, state);
}

function mergePreviousMaterials_(target, targetLayout, prior) {
  if (!prior) return;
  var priorLayout = detectReportLayout_(prior);
  var targetRows = readReportMaterials_(target, targetLayout);
  var known = {};
  targetRows.forEach(function (entry) { known[materialKey_(entry.code, entry.name)] = true; });
  var missing = [];
  readReportMaterials_(prior, priorLayout).forEach(function (entry) {
    var key = materialKey_(entry.code, entry.name);
    if (!known[key]) {
      missing.push(entry);
      known[key] = true;
    }
  });
  if (!missing.length) return;

  var afterRow = targetRows.length
    ? targetRows[targetRows.length - 1].row
    : targetLayout.dataStartRow - 1;
  target.insertRowsAfter(afterRow, missing.length);
  if (afterRow >= targetLayout.dataStartRow) {
    target.getRange(afterRow, 1, 1, target.getLastColumn())
      .copyFormatToRange(target, 1, target.getLastColumn(), afterRow + 1, afterRow + missing.length);
  }
  var width = Math.max(targetLayout.closingColumn, targetLayout.unitColumn);
  var values = missing.map(function (entry, index) {
    var rowNumber = afterRow + 1 + index;
    var row = blankRow_(width);
    row[targetLayout.nameColumn - 1] = safeCellText_(entry.name);
    row[targetLayout.locationColumn - 1] = safeCellText_(entry.location);
    row[targetLayout.categoryColumn - 1] = safeCellText_(entry.category);
    row[targetLayout.codeColumn - 1] = safeCellText_(entry.code);
    row[targetLayout.typeColumn - 1] = safeCellText_(entry.type);
    row[targetLayout.ecrColumn - 1] = safeCellText_(entry.ecr);
    row[targetLayout.openingColumn - 1] = 0;
    row[targetLayout.unitColumn - 1] = safeCellText_(entry.unit);
    row[targetLayout.closingColumn - 1] = closingFormulaForRow_(rowNumber, targetLayout);
    return row;
  });
  target.getRange(afterRow + 1, 1, missing.length, width).setValues(values);
}

function resetNewMonthReport_(sheet, layout, prior, date) {
  updateReportHeading_(sheet, layout, date);
  var rows = readReportMaterials_(sheet, layout);
  var priorStock = {};
  if (prior) {
    var priorLayout = detectReportLayout_(prior);
    var priorRows = readReportMaterials_(prior, priorLayout);
    var priorClosing = calculateClosingStocksBatch_(prior, priorRows, priorLayout);
    priorRows.forEach(function (entry) {
      priorStock[materialKey_(entry.code, entry.name)] = priorClosing[entry.row] || 0;
    });
  }

  if (rows.length) {
    var firstRow = rows[0].row;
    var lastRow = rows[rows.length - 1].row;
    var height = lastRow - firstRow + 1;
    var openingValues = sheet.getRange(firstRow, layout.openingColumn, height, 1).getValues();
    var closingFormulas = sheet.getRange(firstRow, layout.closingColumn, height, 1).getFormulas();
    rows.forEach(function (entry) {
      var offset = entry.row - firstRow;
      var opening = priorStock[materialKey_(entry.code, entry.name)];
      openingValues[offset][0] = opening == null ? 0 : opening;
      closingFormulas[offset][0] = closingFormulaForRow_(entry.row, layout);
    });
    sheet.getRange(firstRow, layout.openingColumn, height, 1).setValues(openingValues);
    sheet.getRange(firstRow, layout.firstDayColumn, height, layout.dayColumnCount).clearContent();
    sheet.getRange(firstRow, layout.closingColumn, height, 1).setFormulas(closingFormulas);
  }

  var daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  var headerDates = [blankRow_(layout.dayColumnCount)];
  for (var day = 1; day <= daysInMonth && day <= layout.dayColumnCount; day++) {
    headerDates[0][day - 1] = new Date(date.getFullYear(), date.getMonth(), day);
  }
  sheet.getRange(layout.headerRow, layout.firstDayColumn, 1, layout.dayColumnCount).setValues(headerDates);
  sheet.showColumns(layout.firstDayColumn, layout.dayColumnCount);
  if (daysInMonth < layout.dayColumnCount) {
    sheet.hideColumns(layout.firstDayColumn + daysInMonth, layout.dayColumnCount - daysInMonth);
  }
}

function updateReportHeading_(sheet, layout, date) {
  var rowCount = Math.max(0, layout.headerRow - 1);
  if (!rowCount) return;
  var columnCount = sheet.getLastColumn();
  var range = sheet.getRange(1, 1, rowCount, columnCount);
  var values = range.getDisplayValues();
  var formulas = range.getFormulas();
  var targetLabel = WARES.MONTHS[date.getMonth()] + " " + date.getFullYear();
  for (var row = 0; row < values.length; row++) {
    for (var column = 0; column < values[row].length; column++) {
      if (formulas[row][column]) continue;
      var value = String(values[row][column] || "");
      if (/Juli\s+2026/i.test(value)) {
        // In merged headings only the top-left cell contains a value, which is safe to update.
        sheet.getRange(row + 1, column + 1).setValue(value.replace(/Juli\s+2026/ig, targetLabel));
      }
    }
  }
}

function ensureReportMaterial_(sheet, layout, input) {
  var found = findReportMaterial_(sheet, layout, input.code, input.name);
  if (found) return found;
  return addReportMaterialRow_(sheet, layout, {
    code: input.code || "",
    name: input.name,
    location: input.location || "",
    category: input.category || "",
    type: input.type || "",
    ecr: input.ecr || "",
    unit: input.unit || ""
  });
}

function findReportMaterialFromList_(materials, code, name) {
  var key = materialKey_(code, name);
  for (var index = 0; index < materials.length; index++) {
    if (materialKey_(materials[index].code, materials[index].name) === key) return materials[index];
  }
  if (!optionalText_(code)) {
    var wantedName = normalize_(name);
    for (var nameIndex = 0; nameIndex < materials.length; nameIndex++) {
      if (normalize_(materials[nameIndex].name) === wantedName) return materials[nameIndex];
    }
  }
  return null;
}

function addReportMaterialRow_(sheet, layout, item) {
  var existing = readReportMaterials_(sheet, layout);
  var afterRow = existing.length ? existing[existing.length - 1].row : layout.dataStartRow - 1;
  sheet.insertRowAfter(afterRow);
  var row = afterRow + 1;
  if (afterRow >= layout.dataStartRow) {
    sheet.getRange(afterRow, 1, 1, sheet.getLastColumn())
      .copyFormatToRange(sheet, 1, sheet.getLastColumn(), row, row);
  }
  sheet.getRange(row, layout.nameColumn).setValue(safeCellText_(item.name));
  sheet.getRange(row, layout.locationColumn).setValue(safeCellText_(item.location));
  sheet.getRange(row, layout.categoryColumn).setValue(safeCellText_(item.category));
  sheet.getRange(row, layout.codeColumn).setValue(safeCellText_(item.code));
  sheet.getRange(row, layout.typeColumn).setValue(safeCellText_(item.type));
  sheet.getRange(row, layout.ecrColumn).setValue(safeCellText_(item.ecr));
  sheet.getRange(row, layout.openingColumn).setValue(0);
  sheet.getRange(row, layout.unitColumn).setValue(safeCellText_(item.unit));
  sheet.getRange(row, layout.firstDayColumn, 1, layout.dayColumnCount).clearContent();
  setClosingFormula_(sheet, row, layout);
  return {
    row: row,
    code: optionalText_(item.code),
    name: String(item.name || ""),
    location: String(item.location || ""),
    category: String(item.category || ""),
    type: String(item.type || ""),
    ecr: String(item.ecr || ""),
    unit: String(item.unit || "")
  };
}

function detectReportLayout_(sheet) {
  var maxRows = Math.min(Math.max(sheet.getLastRow(), WARES.REPORT_HEADER_ROW), 12);
  var maxColumns = Math.min(Math.max(sheet.getLastColumn(), WARES.REPORT_COLUMNS.closing), 100);
  var values = sheet.getRange(1, 1, maxRows, maxColumns).getDisplayValues();
  var best = { row: WARES.REPORT_HEADER_ROW, score: -1, headings: {} };
  for (var r = 0; r < values.length; r++) {
    var headings = {};
    var score = 0;
    for (var c = 0; c < values[r].length; c++) {
      var value = normalize_(values[r][c]);
      if (!value) continue;
      headings[value] = c + 1;
      if (/BARANG|LOKASI|BAGIAN|KATEGORI|SATUAN|STOK/.test(value)) score++;
    }
    if (score > best.score) best = { row: r + 1, score: score, headings: headings };
  }
  var h = best.headings;
  var find = function (patterns, fallback) {
    var keys = Object.keys(h);
    for (var i = 0; i < patterns.length; i++) {
      for (var j = 0; j < keys.length; j++) {
        if (patterns[i].test(keys[j])) return h[keys[j]];
      }
    }
    return fallback;
  };
  var closing = find([/^STOK AKHIR$/, /STOCK AKHIR/], WARES.REPORT_COLUMNS.closing);
  var firstDay = WARES.REPORT_COLUMNS.firstDay;
  return {
    headerRow: best.score >= 3 ? best.row : WARES.REPORT_HEADER_ROW,
    dataStartRow: (best.score >= 3 ? best.row : WARES.REPORT_HEADER_ROW) + 1,
    nameColumn: find([/^NAMA BARANG$/, /^BARANG$/], WARES.REPORT_COLUMNS.name),
    locationColumn: find([/^LOKASI BARANG$/, /^LOKASI$/], WARES.REPORT_COLUMNS.location),
    categoryColumn: find([/^BAGIAN$/, /^KATEGORI$/], WARES.REPORT_COLUMNS.category),
    codeColumn: find([/^KODE MATERIAL$/, /^KODE BARANG$/, /^KODE$/], WARES.REPORT_COLUMNS.code),
    typeColumn: find([/^TYPE BARANG$/, /^TIPE BARANG$/], WARES.REPORT_COLUMNS.type),
    ecrColumn: find([/^ECR$/], WARES.REPORT_COLUMNS.ecr),
    openingColumn: find([/^STOK AWAL$/, /^STOCK AWAL$/], WARES.REPORT_COLUMNS.opening),
    unitColumn: find([/^SATUAN$/], WARES.REPORT_COLUMNS.unit),
    firstDayColumn: firstDay,
    dayColumnCount: Math.max(1, closing - firstDay),
    closingColumn: closing
  };
}

function readReportMaterials_(sheet, layout) {
  var lastRow = sheet.getLastRow();
  if (lastRow < layout.dataStartRow) return [];
  var width = Math.max(layout.unitColumn, layout.codeColumn, layout.nameColumn);
  var values = sheet.getRange(layout.dataStartRow, 1, lastRow - layout.dataStartRow + 1, width).getDisplayValues();
  var result = [];
  var seenMaterial = false;
  var blankRun = 0;
  values.forEach(function (row, index) {
    var name = String(row[layout.nameColumn - 1] || "").trim();
    var code = String(row[layout.codeColumn - 1] || "").trim();
    if (!name && !code) {
      if (seenMaterial) blankRun++;
      return;
    }
    var normalizedName = normalize_(name);
    if (/^(TOTAL|JUMLAH|KETERANGAN|STATUS)/.test(normalizedName)) return;
    seenMaterial = true;
    blankRun = 0;
    result.push({
      row: layout.dataStartRow + index,
      name: name,
      location: String(row[layout.locationColumn - 1] || "").trim(),
      category: String(row[layout.categoryColumn - 1] || "").trim(),
      code: code,
      type: String(row[layout.typeColumn - 1] || "").trim(),
      ecr: String(row[layout.ecrColumn - 1] || "").trim(),
      unit: String(row[layout.unitColumn - 1] || "").trim()
    });
  });
  return result;
}

function findReportMaterial_(sheet, layout, code, name) {
  var key = materialKey_(code, name);
  var rows = readReportMaterials_(sheet, layout);
  for (var i = 0; i < rows.length; i++) {
    if (materialKey_(rows[i].code, rows[i].name) === key) return rows[i];
  }
  // A legacy journal often has no material code. Fall back to name only.
  if (!optionalText_(code)) {
    var wantedName = normalize_(name);
    for (var j = 0; j < rows.length; j++) {
      if (normalize_(rows[j].name) === wantedName) return rows[j];
    }
  }
  return null;
}

function calculateClosingStock_(sheet, row, layout) {
  var opening = number_(sheet.getRange(row, layout.openingColumn).getValue());
  var movements = sheet.getRange(row, layout.firstDayColumn, 1, layout.dayColumnCount).getValues()[0];
  return movements.reduce(function (total, value) { return total + number_(value); }, opening);
}

function setClosingFormula_(sheet, row, layout) {
  sheet.getRange(row, layout.closingColumn).setFormula(closingFormulaForRow_(row, layout));
}

function closingFormulaForRow_(row, layout) {
  var opening = columnLetter_(layout.openingColumn) + row;
  var start = columnLetter_(layout.firstDayColumn) + row;
  var end = columnLetter_(layout.firstDayColumn + layout.dayColumnCount - 1) + row;
  return "=" + opening + "+SUM(" + start + ":" + end + ")";
}

function refreshReportDay_(report, reportLayout, material, date) {
  date = parseDate_(date);
  if (report.getName() !== reportName_(date)) {
    var other = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(reportName_(date));
    if (!other) return;
    report = other;
    reportLayout = detectReportLayout_(other);
    material = findReportMaterial_(other, reportLayout, material.code, material.name);
    if (!material) return;
  }
  var day = Number(Utilities.formatDate(date, WARES.TIME_ZONE, "d"));
  if (day < 1 || day > reportLayout.dayColumnCount) return;
  var delta = journalDeltaForDay_(material, date);
  report.getRange(material.row, reportLayout.firstDayColumn + day - 1).setValue(delta);
  setClosingFormula_(report, material.row, reportLayout);
}

function journalDeltaForDay_(material, date) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var incoming = requireSheet_(spreadsheet, WARES.INCOMING_SHEET);
  var outgoing = requireSheet_(spreadsheet, WARES.OUTGOING_SHEET);
  return sumJournalForDay_(incoming, ensureJournalLayout_(incoming, "incoming"), material, date, 1) +
    sumJournalForDay_(outgoing, ensureJournalLayout_(outgoing, "outgoing"), material, date, -1);
}

function sumJournalForDay_(sheet, layout, material, date, sign) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= layout.headerRow) return 0;
  var values = sheet.getRange(layout.headerRow + 1, 1, lastRow - layout.headerRow, layout.lastColumn).getValues();
  var wantedKey = materialKey_(material.code, material.name);
  return values.reduce(function (sum, row) {
    var rowDate;
    try { rowDate = parseDate_(row[layout.dateColumn - 1]); } catch (_) { return sum; }
    if (!sameJakartaDay_(rowDate, date)) return sum;
    var code = layout.columns[WARES.TECH.materialCode]
      ? row[layout.columns[WARES.TECH.materialCode] - 1] : "";
    var name = row[layout.itemColumn - 1];
    var rowKey = materialKey_(code, name);
    var bothHaveCodes = Boolean(optionalText_(code) && optionalText_(material.code));
    if (bothHaveCodes ? rowKey !== wantedKey : normalize_(name) !== normalize_(material.name)) return sum;
    return sum + sign * number_(row[layout.quantityColumn - 1]);
  }, 0);
}

/** Rebuild daily movement cells in one batch so manual journal edits are visible on the next read. */
function syncReportFromJournals_(report, layout) {
  var month = parseReportMonth_(report.getName());
  if (!month) return;
  var materials = readReportMaterials_(report, layout);
  if (!materials.length) return;
  var firstRow = materials[0].row;
  var lastRow = materials[materials.length - 1].row;
  var height = lastRow - firstRow + 1;
  var matrix = report.getRange(firstRow, layout.firstDayColumn, height, layout.dayColumnCount).getValues();
  var byCode = {};
  var byName = {};
  var duplicateNames = {};

  materials.forEach(function (material) {
    var offset = material.row - firstRow;
    matrix[offset] = blankRow_(layout.dayColumnCount).map(function () { return 0; });
    if (material.code) byCode[normalize_(material.code)] = offset;
    var nameKey = normalize_(material.name);
    if (byName[nameKey] != null) duplicateNames[nameKey] = true;
    else byName[nameKey] = offset;
  });

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  aggregateJournalMonth_(
    requireSheet_(spreadsheet, WARES.INCOMING_SHEET), "incoming", 1,
    month, matrix, byCode, byName, duplicateNames, layout.dayColumnCount
  );
  aggregateJournalMonth_(
    requireSheet_(spreadsheet, WARES.OUTGOING_SHEET), "outgoing", -1,
    month, matrix, byCode, byName, duplicateNames, layout.dayColumnCount
  );
  report.getRange(firstRow, layout.firstDayColumn, height, layout.dayColumnCount).setValues(matrix);
}

function aggregateJournalMonth_(sheet, kind, sign, month, matrix, byCode, byName, duplicateNames, dayCount) {
  var layout = ensureJournalLayout_(sheet, kind);
  var lastRow = sheet.getLastRow();
  if (lastRow <= layout.headerRow) return;
  var values = sheet.getRange(layout.headerRow + 1, 1, lastRow - layout.headerRow, layout.lastColumn).getValues();
  values.forEach(function (row) {
    var date;
    try { date = parseDate_(row[layout.dateColumn - 1]); } catch (_) { return; }
    if (date.getFullYear() !== month.year || date.getMonth() !== month.month) return;
    var code = String(row[layout.columns[WARES.TECH.materialCode] - 1] || "").trim();
    var nameKey = normalize_(row[layout.itemColumn - 1]);
    var offset = code ? byCode[normalize_(code)] : (duplicateNames[nameKey] ? null : byName[nameKey]);
    if (offset == null) return;
    var day = date.getDate();
    if (day < 1 || day > dayCount) return;
    matrix[offset][day - 1] = number_(matrix[offset][day - 1]) + sign * number_(row[layout.quantityColumn - 1]);
  });
}

function propagateMaterialForward_(material, fromDate) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sourceMonth = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  var reports = spreadsheet.getSheets().map(function (sheet) {
    return { sheet: sheet, month: parseReportMonth_(sheet.getName()) };
  }).filter(function (entry) {
    return entry.month && entry.month.date.getTime() >= sourceMonth.getTime();
  }).sort(function (a, b) { return a.month.date.getTime() - b.month.date.getTime(); });

  for (var index = 1; index < reports.length; index++) {
    var previous = reports[index - 1];
    var current = reports[index];
    var previousLayout = detectReportLayout_(previous.sheet);
    var previousMaterial = findReportMaterial_(previous.sheet, previousLayout, material.code, material.name);
    if (!previousMaterial) continue;
    var currentLayout = detectReportLayout_(current.sheet);
    var currentMaterial = findReportMaterial_(current.sheet, currentLayout, material.code, material.name);
    if (!currentMaterial) currentMaterial = ensureReportMaterial_(current.sheet, currentLayout, material);
    current.sheet.getRange(currentMaterial.row, currentLayout.openingColumn)
      .setValue(calculateClosingStock_(previous.sheet, previousMaterial.row, previousLayout));
    setClosingFormula_(current.sheet, currentMaterial.row, currentLayout);
  }
}

function parseReportMonth_(name) {
  var match = String(name || "").match(/^([^\s]+)\s+(\d{4})\s+-\s+DATA BASE LAPORAN HARIAN$/i);
  if (!match) return null;
  var normalizedMonth = normalize_(match[1]);
  var month = -1;
  for (var index = 0; index < WARES.MONTHS.length; index++) {
    if (normalize_(WARES.MONTHS[index]) === normalizedMonth) { month = index; break; }
  }
  if (month < 0) return null;
  var year = Number(match[2]);
  return { year: year, month: month, date: new Date(year, month, 1) };
}

function ensureJournalLayout_(sheet, kind) {
  var requiredVisible = kind === "incoming"
    ? ["TANGGAL", "BARANG", "JUMLAH MASUK", "KETERANGAN"]
    : ["TANGGAL", "BARANG", "JUMLAH KELUAR", "KETERANGAN", "EQUIPMENT", "PIC"];
  var tech = kind === "incoming"
    ? [
      WARES.TECH.transactionId,
      WARES.TECH.materialCode,
      WARES.TECH.itemRack,
      WARES.TECH.itemArea,
      WARES.TECH.createdAt,
      WARES.TECH.updatedAt
    ]
    : [
      WARES.TECH.requestId,
      WARES.TECH.lineId,
      WARES.TECH.syncToken,
      WARES.TECH.expectedLines,
      WARES.TECH.actorId,
      WARES.TECH.operation,
      WARES.TECH.categories,
      WARES.TECH.catalogItemId,
      WARES.TECH.itemCategory,
      WARES.TECH.itemLocation,
      WARES.TECH.itemUnit,
      WARES.TECH.materialCode,
      WARES.TECH.requestedQty,
      WARES.TECH.createdAt,
      WARES.TECH.updatedAt
    ];
  var header = findJournalHeader_(sheet, requiredVisible);
  if (!header) throw apiError_("INVALID_SHEET", "Header sheet " + sheet.getName() + " tidak ditemukan.");
  var columns = header.columns;
  var nextColumn = Math.max(sheet.getLastColumn(), header.lastColumn) + 1;
  tech.forEach(function (name) {
    if (!columns[name]) {
      if (nextColumn > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
      sheet.getRange(header.row, nextColumn).setValue(name);
      columns[name] = nextColumn;
      sheet.hideColumns(nextColumn);
      nextColumn++;
    }
  });
  var lastColumn = nextColumn - 1;
  return {
    headerRow: header.row,
    columns: columns,
    lastColumn: lastColumn,
    dateColumn: findNormalizedColumn_(columns, "TANGGAL"),
    itemColumn: findNormalizedColumn_(columns, "BARANG"),
    quantityColumn: findNormalizedColumn_(columns, kind === "incoming" ? "JUMLAH MASUK" : "JUMLAH KELUAR"),
    noteColumn: findNormalizedColumn_(columns, "KETERANGAN"),
    equipmentColumn: kind === "outgoing" ? findNormalizedColumn_(columns, "EQUIPMENT") : null,
    picColumn: kind === "outgoing" ? findNormalizedColumn_(columns, "PIC") : null
  };
}

function findJournalHeader_(sheet, required) {
  var rowCount = Math.min(Math.max(sheet.getLastRow(), 1), 20);
  var columnCount = Math.max(sheet.getLastColumn(), required.length);
  var values = sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    var columns = {};
    for (var c = 0; c < values[r].length; c++) {
      var key = normalize_(values[r][c]);
      if (key) columns[key] = c + 1;
    }
    var complete = required.every(function (name) { return Boolean(columns[normalize_(name)]); });
    if (complete) return { row: r + 1, columns: columns, lastColumn: columnCount };
  }
  return null;
}

function buildIncomingJournalRow_(layout, input, transactionId) {
  var row = blankRow_(layout.lastColumn);
  row[layout.dateColumn - 1] = input.date;
  row[layout.itemColumn - 1] = safeCellText_(input.name);
  row[layout.quantityColumn - 1] = input.quantity;
  row[layout.noteColumn - 1] = safeCellText_(input.note);
  row[layout.columns[WARES.TECH.transactionId] - 1] = transactionId;
  row[layout.columns[WARES.TECH.materialCode] - 1] = safeCellText_(input.code);
  row[layout.columns[WARES.TECH.itemRack] - 1] = input.rack == null ? "" : input.rack;
  row[layout.columns[WARES.TECH.itemArea] - 1] = safeCellText_(input.area);
  row[layout.columns[WARES.TECH.createdAt] - 1] = new Date().toISOString();
  row[layout.columns[WARES.TECH.updatedAt] - 1] = new Date().toISOString();
  return row;
}

function buildOutgoingJournalRow_(layout, input, item, oldCreatedAt) {
  var row = blankRow_(layout.lastColumn);
  row[layout.dateColumn - 1] = input.date;
  row[layout.itemColumn - 1] = safeCellText_(item.name);
  row[layout.quantityColumn - 1] = item.givenQuantity;
  row[layout.noteColumn - 1] = safeCellText_(input.job);
  row[layout.equipmentColumn - 1] = safeCellText_(input.jobLocation);
  row[layout.picColumn - 1] = safeCellText_(input.recipient);
  row[layout.columns[WARES.TECH.requestId] - 1] = input.requestId;
  row[layout.columns[WARES.TECH.lineId] - 1] = item.lineId;
  row[layout.columns[WARES.TECH.syncToken] - 1] = input.syncToken;
  row[layout.columns[WARES.TECH.expectedLines] - 1] = input.items.length;
  row[layout.columns[WARES.TECH.actorId] - 1] = input.actorId;
  row[layout.columns[WARES.TECH.operation] - 1] = input.operation;
  row[layout.columns[WARES.TECH.categories] - 1] = JSON.stringify(input.categories);
  row[layout.columns[WARES.TECH.catalogItemId] - 1] = item.catalogItemId == null ? "" : item.catalogItemId;
  row[layout.columns[WARES.TECH.itemCategory] - 1] = safeCellText_(item.category);
  row[layout.columns[WARES.TECH.itemLocation] - 1] = safeCellText_(item.location);
  row[layout.columns[WARES.TECH.itemUnit] - 1] = safeCellText_(item.unit);
  row[layout.columns[WARES.TECH.materialCode] - 1] = safeCellText_(item.code);
  row[layout.columns[WARES.TECH.requestedQty] - 1] = item.requestedQuantity;
  row[layout.columns[WARES.TECH.createdAt] - 1] = oldCreatedAt || input.date.toISOString();
  row[layout.columns[WARES.TECH.updatedAt] - 1] = new Date().toISOString();
  return row;
}

function readOutgoingRequestRows_(sheet, layout, requestId) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= layout.headerRow) return [];
  var requestColumn = layout.columns[WARES.TECH.requestId];
  var values = sheet.getRange(layout.headerRow + 1, 1, lastRow - layout.headerRow, layout.lastColumn).getValues();
  var result = [];
  values.forEach(function (row, index) {
    if (String(row[requestColumn - 1] || "") !== requestId) return;
    result.push({
      row: layout.headerRow + 1 + index,
      date: parseDate_(row[layout.dateColumn - 1]),
      name: String(row[layout.itemColumn - 1] || ""),
      materialCode: String(row[layout.columns[WARES.TECH.materialCode] - 1] || ""),
      lineId: String(row[layout.columns[WARES.TECH.lineId] - 1] || ""),
      quantity: number_(row[layout.quantityColumn - 1]),
      createdAt: String(row[layout.columns[WARES.TECH.createdAt] - 1] || "")
    });
  });
  return result;
}

function readIncomingTransactionRows_(sheet, layout, transactionId) {
  var rows = findJournalRows_(sheet, layout, WARES.TECH.transactionId, transactionId);
  return rows.map(function (rowNumber) {
    var row = sheet.getRange(rowNumber, 1, 1, layout.lastColumn).getValues()[0];
    return {
      row: rowNumber,
      date: parseDate_(row[layout.dateColumn - 1]),
      name: String(row[layout.itemColumn - 1] || ""),
      materialCode: String(row[layout.columns[WARES.TECH.materialCode] - 1] || "")
    };
  });
}

function replaceOutgoingJournalRows_(sheet, layout, oldRows, input, items) {
  var oldByLine = {};
  oldRows.forEach(function (row) { if (row.lineId) oldByLine[row.lineId] = row; });
  var usedRows = {};
  var spareRows = oldRows.slice();

  items.forEach(function (item) {
    var target = oldByLine[item.lineId];
    if (!target) {
      while (spareRows.length && usedRows[spareRows[0].row]) spareRows.shift();
      target = spareRows.shift() || null;
    }
    var values = buildOutgoingJournalRow_(layout, input, item, target && target.createdAt);
    if (target) {
      sheet.getRange(target.row, 1, 1, layout.lastColumn).setValues([values]);
      usedRows[target.row] = true;
    } else {
      appendJournalRow_(sheet, layout, values);
    }
  });

  var toDelete = oldRows.filter(function (row) { return !usedRows[row.row]; }).map(function (row) { return row.row; });
  deleteJournalRows_(sheet, toDelete);
}

function appendJournalRow_(sheet, layout, values) {
  var row = Math.max(sheet.getLastRow() + 1, layout.headerRow + 1);
  sheet.getRange(row, 1, 1, layout.lastColumn).setValues([values]);
  sheet.getRange(row, layout.dateColumn).setNumberFormat("dd/MM/yyyy");
  return row;
}

function findJournalRows_(sheet, layout, technicalHeader, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= layout.headerRow) return [];
  var column = layout.columns[technicalHeader];
  var values = sheet.getRange(layout.headerRow + 1, column, lastRow - layout.headerRow, 1).getDisplayValues();
  var result = [];
  values.forEach(function (row, index) {
    if (String(row[0]) === String(value)) result.push(layout.headerRow + 1 + index);
  });
  return result;
}

function deleteJournalRows_(sheet, rows) {
  rows.slice().sort(function (a, b) { return b - a; }).forEach(function (row) { sheet.deleteRow(row); });
}

function getIncomingNotes_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = requireSheet_(spreadsheet, WARES.INCOMING_SHEET);
  var layout = ensureJournalLayout_(sheet, "incoming");
  var lastRow = sheet.getLastRow();
  var unique = {};
  if (lastRow > layout.headerRow) {
    sheet.getRange(layout.headerRow + 1, layout.noteColumn, lastRow - layout.headerRow, 1)
      .getDisplayValues().forEach(function (row) {
        var value = String(row[0] || "").trim();
        if (value && normalize_(value) !== "LAINNYA") unique[normalize_(value)] = value;
      });
  }
  var values = Object.keys(unique).map(function (key) { return unique[key]; });
  values.sort(function (a, b) { return a.localeCompare(b); });
  values.push("Lainnya");
  return values;
}

/** Versi metadata read-only: tidak membuat kolom teknis dan tidak perlu lock. */
function getIncomingNotesReadOnly_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = requireSheet_(spreadsheet, WARES.INCOMING_SHEET);
  var header = findJournalHeader_(sheet, ["TANGGAL", "BARANG", "JUMLAH MASUK", "KETERANGAN"]);
  if (!header) throw apiError_("INVALID_SHEET", "Header sheet " + sheet.getName() + " tidak ditemukan.");
  var noteColumn = findNormalizedColumn_(header.columns, "KETERANGAN");
  var lastRow = sheet.getLastRow();
  var unique = {};
  if (lastRow > header.row) {
    sheet.getRange(header.row + 1, noteColumn, lastRow - header.row, 1)
      .getDisplayValues().forEach(function (row) {
        var value = String(row[0] || "").trim();
        if (value && normalize_(value) !== "LAINNYA") unique[normalize_(value)] = value;
      });
  }
  var values = Object.keys(unique).map(function (key) { return unique[key]; });
  values.sort(function (a, b) { return a.localeCompare(b); });
  values.push("Lainnya");
  return values;
}

/** Run once from the Apps Script editor after deployment. */
function installMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "monthlyRollover") ScriptApp.deleteTrigger(trigger);
  });
  scheduleNextMonthTrigger_();
  return withLock_(function () { return ensureCurrentMonthReport_().getName(); });
}

function monthlyRollover() {
  try {
    withLock_(function () { ensureCurrentMonthReport_(); });
  } finally {
    // Trigger satu kali harus selalu diganti, termasuk bila rollover bulan ini
    // gagal. Akses API pertama tetap menjadi fallback untuk sheet bulan berjalan.
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === "monthlyRollover") ScriptApp.deleteTrigger(trigger);
    });
    scheduleNextMonthTrigger_();
  }
}

function scheduleNextMonthTrigger_() {
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  ScriptApp.newTrigger("monthlyRollover").timeBased().at(next).create();
}

function assertSecret_(provided) {
  var expected = PropertiesService.getScriptProperties().getProperty(WARES.SECRET_PROPERTY);
  if (!expected) throw apiError_("NOT_CONFIGURED", "WARES_API_SECRET belum dikonfigurasi.", false);
  if (!provided || String(provided) !== String(expected)) {
    throw apiError_("UNAUTHORIZED", "Secret API tidak valid.", false);
  }
}

function withLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(WARES.LOCK_TIMEOUT_MS)) throw apiError_("LOCK_TIMEOUT", "Spreadsheet sedang sibuk. Coba lagi.");
  try { return callback(); } finally { lock.releaseLock(); }
}

function reportName_(date) {
  return WARES.MONTHS[date.getMonth()] + " " + date.getFullYear() + WARES.REPORT_SUFFIX;
}

function sameJakartaDay_(a, b) {
  return Utilities.formatDate(parseDate_(a), WARES.TIME_ZONE, "yyyy-MM-dd") ===
    Utilities.formatDate(parseDate_(b), WARES.TIME_ZONE, "yyyy-MM-dd");
}

function dayKey_(date) {
  return Utilities.formatDate(parseDate_(date), WARES.TIME_ZONE, "yyyy-MM-dd");
}

function parseDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value;
  var text = String(value || "").trim();
  var local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]), 12, 0, 0);
  var parsed = new Date(text);
  if (isNaN(parsed.getTime())) throw apiError_("INVALID_DATE", "Tanggal tidak valid.");
  return parsed;
}

function materialKey_(code, name) {
  var normalizedCode = normalize_(code);
  return normalizedCode ? "CODE:" + normalizedCode : "NAME:" + normalize_(name);
}

function integer_(value, field, minimum, maximum) {
  var number = Number(value);
  if (!Number.isInteger(number) || number < minimum || (maximum != null && number > maximum)) {
    var message = field + " harus berupa bilangan bulat minimal " + minimum;
    if (maximum != null) message += " dan maksimal " + maximum;
    throw apiError_("INVALID_QUANTITY", message + ".");
  }
  return number;
}

function number_(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  var normalized = String(value == null ? "" : value).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  var parsed = Number(normalized);
  return isFinite(parsed) ? parsed : 0;
}

function requiredText_(value, field) {
  var result = optionalText_(value);
  if (!result) throw apiError_("INVALID_INPUT", field + " wajib diisi.");
  return result;
}

function limitedText_(value, field, maximum, required) {
  var result = optionalText_(value);
  if (required && !result) throw apiError_("INVALID_INPUT", field + " wajib diisi.");
  if (result.length > maximum) {
    throw apiError_("INVALID_INPUT", field + " maksimal " + maximum + " karakter.");
  }
  return result;
}

/**
 * Google Sheets dapat menafsirkan string berawalan =,+,-,@ sebagai formula.
 * Apostrophe memaksa teks literal dan tidak tampil pada nilai display sheet.
 */
function safeCellText_(value) {
  var text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function literalCellText_(value) {
  var text = String(value == null ? "" : value);
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function optionalText_(value) {
  return value == null ? "" : String(value).trim();
}

function normalize_(value) {
  return literalCellText_(value).trim().replace(/\s+/g, " ").toUpperCase();
}

function blankRow_(length) {
  return Array.apply(null, Array(length)).map(function () { return ""; });
}

function findNormalizedColumn_(columns, name) {
  var result = columns[normalize_(name)];
  if (!result) throw apiError_("INVALID_SHEET", "Kolom " + name + " tidak ditemukan.");
  return result;
}

function columnLetter_(column) {
  var result = "";
  while (column > 0) {
    var remainder = (column - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    column = Math.floor((column - 1) / 26);
  }
  return result;
}

function requireSheet_(spreadsheet, name) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw apiError_("MISSING_SHEET", "Sheet " + name + " tidak ditemukan.");
  return sheet;
}

function apiError_(code, message, expose) {
  var error = new Error(message);
  error.code = code;
  error.expose = expose !== false;
  return error;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/* ================================================================== *
 * INVENTORY (WARES v2) — pembacaan hasil model dari workbook
 * "WARES Reliability x Inventory Management". Read-only; website hanya
 * mencerminkan angka yang dihitung rumus Excel. Bentuk JSON WAJIB sama
 * dengan fixture di src/lib/inventory/data/*.json — dijaga oleh
 * src/lib/inventory/apps-script-inv.test.ts (menjalankan file ini di
 * node:vm atas data sel asli dan membandingkan ke fixture).
 * ================================================================== */

var INV_SHEETS = Object.freeze({
  DASHBOARD: "DASHBOARD",
  RM_HASIL: "RM_HASIL",
  DEMAND: "DATA_DEMAND (RM)",
  OP_STOK: "OP_STOK",
  TERPAKAI: "DATA_SKU TERPAKAI",
  OP_ORDER: "OP_ORDER",
  OP_RENCANA: "OP_RENCANA",
  PM_OVERHAUL: "PM_OVERHAUL"
});

function invGrid_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return requireSheet_(ss, name).getDataRange().getValues();
}

function invIsDate_(v) {
  return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime());
}

function invStr_(v) {
  if (v == null) return "";
  if (invIsDate_(v)) return Utilities.formatDate(v, WARES.TIME_ZONE, "yyyy-MM-dd");
  return String(v).trim();
}

function invNum_(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function invIso_(v) {
  if (invIsDate_(v)) return Utilities.formatDate(v, WARES.TIME_ZONE, "yyyy-MM-dd");
  return invStr_(v);
}

function invRound_(v, dec) {
  var f = Math.pow(10, dec || 0);
  return Math.round(invNum_(v) * f) / f;
}

/** Peta nama kolom (trim) -> indeks, dari satu baris header. */
function invHeaderMap_(row) {
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var name = invStr_(row[i]);
    if (name !== "" && !(name in map)) map[name] = i;
  }
  return map;
}

function invFindRow_(grid, predicate) {
  for (var i = 0; i < grid.length; i++) {
    if (predicate(grid[i])) return i;
  }
  return -1;
}

function invRowHas_(row, text) {
  for (var i = 0; i < row.length; i++) {
    if (invStr_(row[i]) === text) return true;
  }
  return false;
}

function invCell_(row, map, key) {
  return (key in map && map[key] < row.length) ? row[map[key]] : null;
}

function getInventoryDashboard_() {
  var g = invGrid_(INV_SHEETS.DASHBOARD);

  // Tabel per-SKU: baris header memuat "Sparepart" dan "Status".
  var hdrI = invFindRow_(g, function (r) { return invRowHas_(r, "Sparepart") && invRowHas_(r, "Status"); });
  var col = invHeaderMap_(g[hdrI]);
  var items = [];
  for (var i = hdrI + 1; i < g.length; i++) {
    var row = g[i];
    var no = invCell_(row, col, "No.");
    if (no == null || invStr_(no) === "") continue;
    items.push({
      no: Math.round(invNum_(no)),
      mesin: invStr_(invCell_(row, col, "Mesin")),
      sparepart: invStr_(invCell_(row, col, "Sparepart")),
      ecr: invStr_(invCell_(row, col, "ECR")),
      satuan: invStr_(invCell_(row, col, "Satuan")),
      leadTime: invNum_(invCell_(row, col, "Lead time L (hari)")),
      kebutuhanPM: invNum_(invCell_(row, col, "Kebutuhan PM jendela L+R")),
      kuantilRM: invNum_(invCell_(row, col, "Kuantil RM jendela L+R")),
      targetS: invNum_(invCell_(row, col, "Target S")),
      stokFisik: invNum_(invCell_(row, col, "Stok fisik")),
      pesananJalan: invNum_(invCell_(row, col, "Pesanan dalam perjalanan")),
      posisiPersediaan: invNum_(invCell_(row, col, "Posisi persediaan")),
      kebutuhanL: invNum_(invCell_(row, col, "Kebutuhan selama L (PM + RM)")),
      status: invStr_(invCell_(row, col, "Status")),
      jumlahPesan: invNum_(invCell_(row, col, "Jumlah pesan (unit)")),
      perkiraanTiba: invIso_(invCell_(row, col, "Perkiraan tiba")),
      tindakLanjut: invStr_(invCell_(row, col, "Tindak lanjut"))
    });
  }

  // Ringkasan: baris header memuat "Total SKU"; nilai di baris berikutnya.
  var sumI = invFindRow_(g, function (r) { return invRowHas_(r, "Total SKU"); });
  var scol = invHeaderMap_(g[sumI]);
  var sv = g[sumI + 1];
  var ringkasan = {
    totalSku: Math.round(invNum_(invCell_(sv, scol, "Total SKU"))),
    kritis: Math.round(invNum_(invCell_(sv, scol, "Kritis"))),
    pesanSekarang: Math.round(invNum_(invCell_(sv, scol, "Pesan sekarang"))),
    cukup: Math.round(invNum_(invCell_(sv, scol, "Cukup"))),
    persenCukup: invNum_(invCell_(sv, scol, "% Cukup")),
    nilaiPesanan: invNum_(invCell_(sv, scol, "Nilai pesanan (Rp)")),
    tanggalAcuan: invIso_(invLeftValue_(g, "Tanggal acuan (review)")),
    periodeReviewHari: invNum_(invLeftValue_(g, "Periode review R (hari)")),
    serviceLevel: invNum_(invLeftValue_(g, "Service level"))
  };

  // Breakdown per mesin: header memuat "Mesin", "Kritis", "Total".
  var pmI = invFindRow_(g, function (r) {
    return invRowHas_(r, "Mesin") && invRowHas_(r, "Total") && invRowHas_(r, "Kritis");
  });
  var pcol = invHeaderMap_(g[pmI]);
  var perMesin = [];
  for (var j = pmI + 1; j < g.length; j++) {
    var mesin = invStr_(invCell_(g[j], pcol, "Mesin"));
    if (mesin === "") continue;
    if (mesin === "TOTAL") break;
    perMesin.push({
      mesin: mesin,
      kritis: Math.round(invNum_(invCell_(g[j], pcol, "Kritis"))),
      pesanSekarang: Math.round(invNum_(invCell_(g[j], pcol, "Pesan sekarang"))),
      cukup: Math.round(invNum_(invCell_(g[j], pcol, "Cukup"))),
      total: Math.round(invNum_(invCell_(g[j], pcol, "Total")))
    });
  }

  return { ringkasan: ringkasan, perMesin: perMesin, items: items };
}

/** Nilai di sel non-kosong pertama di kanan label (panel kiri DASHBOARD). */
function invLeftValue_(grid, label) {
  for (var i = 0; i < grid.length; i++) {
    var row = grid[i];
    for (var j = 0; j < row.length; j++) {
      if (invStr_(row[j]) === label) {
        for (var k = j + 1; k < row.length; k++) {
          if (invStr_(row[k]) !== "") return row[k];
        }
      }
    }
  }
  return null;
}

function getInventoryRmHasil_() {
  var g = invGrid_(INV_SHEETS.RM_HASIL);
  var col = invHeaderMap_(g[0]);
  var items = [];
  for (var i = 1; i < g.length; i++) {
    var row = g[i];
    var no = invCell_(row, col, "No");
    if (no == null || invStr_(no) === "") continue;
    items.push({
      no: Math.round(invNum_(no)),
      kategori: invStr_(invCell_(row, col, "Kategori")),
      kriteria: invStr_(invCell_(row, col, "Kriteria")),
      namaBarang: invStr_(invCell_(row, col, "Nama Barang")),
      leadTime: invNum_(invCell_(row, col, "Lead Time (hari)")),
      serviceLevel: invNum_(invCell_(row, col, "Service Level")),
      totalKeluar35: invNum_(invCell_(row, col, "Total Keluar (35 mgg)")),
      rataPerMinggu: invNum_(invCell_(row, col, "Rata-rata / minggu")),
      stdPerMinggu: invNum_(invCell_(row, col, "Std Dev / minggu")),
      muLT: invNum_(invCell_(row, col, "Demand selama LT (mu)")),
      sigmaLT: invNum_(invCell_(row, col, "Std Dev selama LT (sigma)")),
      z: invNum_(invCell_(row, col, "z")),
      ropRekomendasi: invNum_(invCell_(row, col, "STOK HOLD (ROP) REKOMENDASI")),
      ssRekomendasi: invNum_(invCell_(row, col, "SAFETY STOCK (SS) REKOMENDASI")),
      dasar: invStr_(invCell_(row, col, "Dasar"))
    });
  }
  return items;
}

function getInventoryDemand_() {
  var g = invGrid_(INV_SHEETS.DEMAND);
  var hdrI = invFindRow_(g, function (r) {
    for (var i = 0; i < r.length; i++) { if (invStr_(r[i]).indexOf("KEY") >= 0) return true; }
    return false;
  });
  var header = g[hdrI];
  var keyIdx = -1;
  for (var c = 0; c < header.length; c++) {
    if (invStr_(header[c]).indexOf("KEY") >= 0) { keyIdx = c; break; }
  }
  var weekCols = [];
  var minggu = [];
  for (var w = keyIdx + 1; w < header.length; w++) {
    var h = header[w];
    var isWeek = (typeof h === "number" && h > 0) || /^\d+$/.test(invStr_(h));
    if (isWeek) { weekCols.push(w); minggu.push(Math.round(invNum_(h))); }
  }
  var items = [];
  for (var i = hdrI + 1; i < g.length; i++) {
    var key = invStr_(g[i][keyIdx]);
    if (key === "") continue;
    var series = [];
    for (var k = 0; k < weekCols.length; k++) {
      series.push(invNum_(g[i][weekCols[k]]));
    }
    items.push({ nama: key, mingguan: series });
  }
  return { minggu: minggu, items: items };
}

function getInventoryProyeksi_() {
  var g = invGrid_(INV_SHEETS.OP_STOK);
  var CAP = 53;
  var rowTgl = invFindRow_(g, function (r) { return invRowHas_(r, "Tanggal review"); });
  var rowNilai = invFindRow_(g, function (r) { return invRowHas_(r, "Nilai stok positif (Rp)"); });
  var rowShort = invFindRow_(g, function (r) { return invRowHas_(r, "Jumlah SKU kekurangan"); });

  var dataCols = [];
  for (var c = 0; c < g[rowTgl].length; c++) {
    if (invIsDate_(g[rowTgl][c])) { dataCols.push(c); if (dataCols.length >= CAP) break; }
  }
  var reviewDates = [], nilaiStok = [], jumlahKurang = [];
  for (var d = 0; d < dataCols.length; d++) {
    reviewDates.push(invIso_(g[rowTgl][dataCols[d]]));
    nilaiStok.push(Math.round(invNum_(g[rowNilai][dataCols[d]])));
    jumlahKurang.push(Math.round(invNum_(g[rowShort][dataCols[d]])));
  }

  // Blok stok fisik per SKU: header memuat "Nama sparepart".
  var blockI = invFindRow_(g, function (r) { return invRowHas_(r, "Nama sparepart"); });
  var nameCol = -1, bagianCol = -1;
  for (var h = 0; h < g[blockI].length; h++) {
    var lbl = invStr_(g[blockI][h]);
    if (lbl === "Nama sparepart") nameCol = h;
    if (lbl === "Bagian") bagianCol = h;
  }
  if (bagianCol < 0) bagianCol = nameCol - 1;

  var series = [];
  for (var i = blockI + 1; i < g.length; i++) {
    var nama = invStr_(g[i][nameCol]);
    if (nama === "") {
      if (series.length) break; else continue;
    }
    var stok = [];
    for (var s = 0; s < dataCols.length; s++) {
      stok.push(invRound_(g[i][dataCols[s]], 3));
    }
    series.push({ nama: nama, bagian: invStr_(g[i][bagianCol]), stok: stok });
  }

  return { reviewDates: reviewDates, nilaiStok: nilaiStok, jumlahKurang: jumlahKurang, series: series };
}

function getInventoryPola_() {
  var g = invGrid_(INV_SHEETS.TERPAKAI);
  var col = invHeaderMap_(g[0]);
  var items = [];
  for (var i = 1; i < g.length; i++) {
    var nama = invStr_(invCell_(g[i], col, "NAMA BARANG"));
    if (nama === "") continue;
    items.push({
      nama: nama,
      bagian: invStr_(invCell_(g[i], col, "BAGIAN")),
      tipe: invStr_(invCell_(g[i], col, "TYPE BARANG")),
      pola: invStr_(invCell_(g[i], col, "Pola Demand")),
      adi: invNum_(invCell_(g[i], col, "ADI")),
      cv2: invNum_(invCell_(g[i], col, "CV^2"))
    });
  }
  return items;
}

/* --- Pencocokan "contains" untuk sheet berlabel panjang/terpotong (OP_RENCANA). --- */
function invRowHasSub_(row, sub) {
  for (var i = 0; i < row.length; i++) { if (invStr_(row[i]).indexOf(sub) >= 0) return true; }
  return false;
}

/** Nilai di sel non-kosong pertama di kanan sel yang MEMUAT sub. */
function invLeftValueContains_(grid, sub) {
  for (var i = 0; i < grid.length; i++) {
    var row = grid[i];
    for (var j = 0; j < row.length; j++) {
      if (invStr_(row[j]).indexOf(sub) >= 0) {
        for (var k = j + 1; k < row.length; k++) {
          if (invStr_(row[k]) !== "") return row[k];
        }
      }
    }
  }
  return null;
}

/** Indeks kolom pertama yang sama-dengan atau memuat sub. */
function invColContains_(headerRow, sub) {
  for (var j = 0; j < headerRow.length; j++) {
    var t = invStr_(headerRow[j]);
    if (t === sub || t.indexOf(sub) >= 0) return j;
  }
  return -1;
}

function getInventoryOpOrder_() {
  var g = invGrid_(INV_SHEETS.OP_ORDER);
  var CAP = 53;
  var rowTgl = invFindRow_(g, function (r) { return invRowHas_(r, "Tanggal review"); });
  var rowUnit = invFindRow_(g, function (r) { return invRowHasSub_(r, "Total unit dipesan"); });
  var rowSku = invFindRow_(g, function (r) { return invRowHasSub_(r, "Jumlah SKU yang dipesan"); });
  var rowNilai = invFindRow_(g, function (r) { return invRowHas_(r, "Nilai pesanan (Rp)"); });

  var dataCols = [];
  for (var c = 0; c < g[rowTgl].length; c++) {
    if (invIsDate_(g[rowTgl][c])) { dataCols.push(c); if (dataCols.length >= CAP) break; }
  }
  var reviewDates = [], totalUnit = [], jumlahSku = [], nilaiPesanan = [];
  for (var d = 0; d < dataCols.length; d++) {
    reviewDates.push(invIso_(g[rowTgl][dataCols[d]]));
    totalUnit.push(Math.round(invNum_(g[rowUnit][dataCols[d]])));
    jumlahSku.push(Math.round(invNum_(g[rowSku][dataCols[d]])));
    nilaiPesanan.push(Math.round(invNum_(g[rowNilai][dataCols[d]])));
  }

  var blockI = invFindRow_(g, function (r) { return invRowHas_(r, "Nama sparepart"); });
  var nameCol = -1, bagianCol = -1;
  for (var h = 0; h < g[blockI].length; h++) {
    var lbl = invStr_(g[blockI][h]);
    if (lbl === "Nama sparepart") nameCol = h;
    if (lbl === "Bagian") bagianCol = h;
  }
  if (bagianCol < 0) bagianCol = nameCol - 1;

  var series = [];
  for (var i = blockI + 1; i < g.length; i++) {
    var nama = invStr_(g[i][nameCol]);
    if (nama === "") { if (series.length) break; else continue; }
    var qty = [];
    for (var s = 0; s < dataCols.length; s++) {
      qty.push(Math.round(invNum_(g[i][dataCols[s]])));
    }
    series.push({ nama: nama, bagian: invStr_(g[i][bagianCol]), qty: qty });
  }

  return {
    reviewDates: reviewDates, totalUnit: totalUnit, jumlahSku: jumlahSku,
    nilaiPesanan: nilaiPesanan, series: series
  };
}

function getInventoryOpRencana_() {
  var g = invGrid_(INV_SHEETS.OP_RENCANA);

  var params = {
    periodeReviewHari: invNum_(invLeftValueContains_(g, "Periode review R")),
    tanggalReviewPertama: invIso_(invLeftValueContains_(g, "Tanggal review pertama")),
    akhirHorizon: invIso_(invLeftValueContains_(g, "Akhir horizon rencana")),
    serviceLevel: invNum_(invLeftValueContains_(g, "Service level")),
    biayaPesanK: invNum_(invLeftValueContains_(g, "Biaya pesan K per PO")),
    biayaSimpanTahun: invNum_(invLeftValueContains_(g, "Biaya simpan per tahun")),
    tahunAcuan: Math.round(invNum_(invLeftValueContains_(g, "Tahun acuan untuk ringkasan"))),
    jumlahReview: Math.round(invNum_(invLeftValueContains_(g, "Jumlah review")))
  };

  var ringkasan = {
    jumlahPO: Math.round(invNum_(invLeftValueContains_(g, "Jumlah PO"))),
    totalUnitDipesan: Math.round(invNum_(invLeftValueContains_(g, "Total unit dipesan"))),
    nilaiPesanan: Math.round(invNum_(invLeftValueContains_(g, "Nilai pesanan (Rp)"))),
    biayaPesan: Math.round(invNum_(invLeftValueContains_(g, "Biaya pesan = PO"))),
    rataNilaiStok: invNum_(invLeftValueContains_(g, "Rata-rata nilai stok")),
    biayaSimpan: invNum_(invLeftValueContains_(g, "Biaya simpan = nilai")),
    kejadianKekurangan: Math.round(invNum_(invLeftValueContains_(g, "Kejadian kekurangan (SKU"))),
    totalKekuranganUnit: Math.round(invNum_(invLeftValueContains_(g, "Total kekurangan (unit)"))),
    biayaPesanSimpan: invNum_(invLeftValueContains_(g, "Biaya pesan + simpan"))
  };

  var hdrI = invFindRow_(g, function (r) {
    return invRowHas_(r, "Nama sparepart") && invRowHasSub_(r, "Harga (Rp/unit)");
  });
  var hdr = g[hdrI];
  var cmap = {
    no: invColContains_(hdr, "No"),
    bagian: invColContains_(hdr, "Bagian"),
    nama: invColContains_(hdr, "Nama sparepart"),
    satuan: invColContains_(hdr, "Satuan"),
    leadTime: invColContains_(hdr, "Lead time L (hari)"),
    harga: invColContains_(hdr, "Harga (Rp/unit)"),
    biayaSimpanUnit: invColContains_(hdr, "Biaya simpan (Rp/unit"),
    stokAwal: invColContains_(hdr, "Stok awal"),
    totalDipesan: invColContains_(hdr, "Total dipesan"),
    dipesanTahunAcuan: invColContains_(hdr, "Dipesan di tahun acuan"),
    jumlahOrder: invColContains_(hdr, "Jumlah order di tahun"),
    rataStok: invColContains_(hdr, "Rata-rata stok di tahun"),
    kekurangan: invColContains_(hdr, "Kejadian kekurangan di tahun")
  };
  function cell(row, key) {
    var j = cmap[key];
    return (j >= 0 && j < row.length) ? row[j] : null;
  }
  var items = [];
  for (var i = hdrI + 1; i < g.length; i++) {
    var row = g[i];
    var no = cell(row, "no");
    if (no == null || invStr_(no) === "") continue;
    items.push({
      no: Math.round(invNum_(no)),
      bagian: invStr_(cell(row, "bagian")),
      nama: invStr_(cell(row, "nama")),
      satuan: invStr_(cell(row, "satuan")),
      leadTime: invNum_(cell(row, "leadTime")),
      harga: invNum_(cell(row, "harga")),
      biayaSimpanUnit: invNum_(cell(row, "biayaSimpanUnit")),
      stokAwal: invNum_(cell(row, "stokAwal")),
      totalDipesan: invNum_(cell(row, "totalDipesan")),
      dipesanTahunAcuan: invNum_(cell(row, "dipesanTahunAcuan")),
      jumlahOrder: invNum_(cell(row, "jumlahOrder")),
      rataStok: invNum_(cell(row, "rataStok")),
      kekurangan: invNum_(cell(row, "kekurangan"))
    });
  }

  return { params: params, ringkasan: ringkasan, items: items };
}

function getInventoryPm_() {
  var g = invGrid_(INV_SHEETS.PM_OVERHAUL);

  // Konfigurasi (panel kanan).
  var overhaulPertama = [];
  for (var r = 0; r < g.length; r++) {
    var row = g[r];
    for (var j = 0; j < row.length; j++) {
      var t = invStr_(row[j]);
      if (t.indexOf("Overhaul pertama:") === 0) {
        var mesin = t.split(":")[1] ? t.substring(t.indexOf(":") + 1).replace(/^\s+|\s+$/g, "") : "";
        var tgl = null;
        for (var k = j + 1; k < row.length; k++) { if (invStr_(row[k]) !== "") { tgl = row[k]; break; } }
        overhaulPertama.push({ mesin: mesin, tanggal: invIso_(tgl) });
      }
    }
  }
  var config = {
    siklusC: Math.round(invNum_(invLeftValueContains_(g, "Siklus overhaul C"))),
    jumlahMesinG: Math.round(invNum_(invLeftValueContains_(g, "Jumlah kelompok mesin G"))),
    modeTampilan: invStr_(invLeftValueContains_(g, "Mode tampilan")),
    tanggalAwal: invIso_(invLeftValueContains_(g, "Tanggal awal tampilan")),
    jumlahPeriode: Math.round(invNum_(invLeftValueContains_(g, "Jumlah periode"))),
    overhaulPertama: overhaulPertama
  };

  // Kolom periode: baris "Periode ke-", dibatasi ke periode yang punya tanggal "Awal periode".
  var rPer = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "Periode ke-"); });
  var rAwal = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "Awal periode"); });
  var rAkhir = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "Akhir periode"); });
  var pcols = [];
  for (var c = 0; c < g[rPer].length; c++) {
    var pv = g[rPer][c];
    var awalCell = (c < g[rAwal].length) ? g[rAwal][c] : null;
    if (typeof pv === "number" && pv >= 1 && invIsDate_(awalCell)) pcols.push(c);
  }
  var periods = [];
  for (var p = 0; p < pcols.length; p++) {
    periods.push({
      no: Math.round(invNum_(g[rPer][pcols[p]])),
      awal: invIso_(g[rAwal][pcols[p]]),
      akhir: invIso_(g[rAkhir][pcols[p]])
    });
  }

  var rTot = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "Total unit semua SKU"); });
  var rOvh = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "dari overhaul"); });
  var rPgt = invFindRow_(g, function (rr) { return invRowHasSub_(rr, "dari penggantian"); });
  var totalPerPeriode = { totalUnit: [], dariOverhaul: [], dariPenggantian: [] };
  for (var q = 0; q < pcols.length; q++) {
    totalPerPeriode.totalUnit.push(Math.round(invNum_(g[rTot][pcols[q]])));
    totalPerPeriode.dariOverhaul.push(Math.round(invNum_(g[rOvh][pcols[q]])));
    totalPerPeriode.dariPenggantian.push(Math.round(invNum_(g[rPgt][pcols[q]])));
  }

  // Tabel per-SKU.
  var hdrI = invFindRow_(g, function (rr) {
    return invRowHas_(rr, "Nama sparepart") && invRowHasSub_(rr, "Total unit di tampilan");
  });
  var hdr = g[hdrI];
  var cmap = {
    no: invColContains_(hdr, "No"),
    bagian: invColContains_(hdr, "Bagian"),
    nama: invColContains_(hdr, "Nama sparepart"),
    satuan: invColContains_(hdr, "Satuan"),
    qtyTerpasang: invColContains_(hdr, "Qty terpasang"),
    jumlahMesin: invColContains_(hdr, "Jumlah mesin"),
    intervalSKU: invColContains_(hdr, "Interval SKU (hari)"),
    overhaulPertama: invColContains_(hdr, "Overhaul pertama"),
    penggantianTambahan: invColContains_(hdr, "Penggantian tambahan per"),
    totalUnitTampilan: invColContains_(hdr, "Total unit di tampilan")
  };
  function cell(row, key) { var j = cmap[key]; return (j >= 0 && j < row.length) ? row[j] : null; }
  var items = [];
  for (var i = hdrI + 1; i < g.length; i++) {
    var srow = g[i];
    var no = cell(srow, "no");
    if (no == null || invStr_(no) === "") continue;
    var perPeriode = [];
    for (var pp = 0; pp < pcols.length; pp++) {
      perPeriode.push(Math.round(invNum_(pcols[pp] < srow.length ? srow[pcols[pp]] : 0)));
    }
    items.push({
      no: Math.round(invNum_(no)),
      bagian: invStr_(cell(srow, "bagian")),
      nama: invStr_(cell(srow, "nama")),
      satuan: invStr_(cell(srow, "satuan")),
      qtyTerpasang: invNum_(cell(srow, "qtyTerpasang")),
      jumlahMesin: invNum_(cell(srow, "jumlahMesin")),
      intervalSKU: invNum_(cell(srow, "intervalSKU")),
      overhaulPertama: invIso_(cell(srow, "overhaulPertama")),
      penggantianTambahan: invNum_(cell(srow, "penggantianTambahan")),
      totalUnitTampilan: invNum_(cell(srow, "totalUnitTampilan")),
      perPeriode: perPeriode
    });
  }

  return { config: config, periods: periods, totalPerPeriode: totalPerPeriode, items: items };
}
