import assert from "node:assert/strict";
import test from "node:test";

import { CANONICAL_RACKS, canonicalRackSelection } from "./canonical";

test("daftar Rack kanonik lengkap 1 sampai 50 tanpa nomor ganda", () => {
  assert.equal(CANONICAL_RACKS.length, 50);
  assert.deepEqual(CANONICAL_RACKS.map((item) => item.rack), Array.from({ length: 50 }, (_, i) => i + 1));
});

test("validasi Rack dan Area tidak memaksa Area sesuai Rack yang sama", () => {
  const result = canonicalRackSelection(1, "  za ");
  assert.equal(result.selectedRack?.rack, 1);
  assert.equal(result.selectedArea, "ZA");
});

test("Rack atau Area di luar daftar ditolak", () => {
  assert.equal(canonicalRackSelection(51, "ZA").selectedRack, null);
  assert.equal(canonicalRackSelection(1, "AREA BEBAS").selectedArea, null);
});
