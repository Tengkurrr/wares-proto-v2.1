import assert from "node:assert/strict";
import test from "node:test";

import { inspectMasterSource } from "./config";

test("MASTER_SOURCE menerima postgres tanpa peka huruf dan spasi", () => {
  assert.deepEqual(inspectMasterSource("  PoStGrEs  "), {
    ok: true,
    source: "postgres",
    raw: "PoStGrEs",
  });
});
test("MASTER_SOURCE menerima sheets hanya bila disebut eksplisit", () => {
  assert.deepEqual(inspectMasterSource("sheets"), {
    ok: true,
    source: "sheets",
    raw: "sheets",
  });
});

test("MASTER_SOURCE kosong tidak memilih fallback", () => {
  assert.deepEqual(inspectMasterSource(undefined), {
    ok: false,
    source: null,
    raw: null,
    reason: "MISSING",
  });
  assert.deepEqual(inspectMasterSource("   "), {
    ok: false,
    source: null,
    raw: null,
    reason: "MISSING",
  });
});

test("MASTER_SOURCE salah ditolak secara deterministik", () => {
  assert.deepEqual(inspectMasterSource("google"), {
    ok: false,
    source: null,
    raw: "google",
    reason: "INVALID",
  });
});
