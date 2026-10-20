/**
 * C3 unit checks (no camera hardware, no DB).
 */
import { canSubmitScan, isScanResult, normalizeScanCode, scanResultTone } from "../src/lib/scanGate.ts";
import {
  isServerCheckpointCode,
  mayRenderBarcodeBars,
  printableCheckpoints,
} from "../src/lib/printCheckpoints.ts";
import { qrSvgMarkup } from "../src/lib/qrSvg.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(canSubmitScan({ code: "cp_ab", pending: false }) === true, "submit allowed");
assert(canSubmitScan({ code: "cp_ab", pending: true }) === false, "lock while pending");
assert(canSubmitScan({ code: "   ", pending: false }) === false, "empty rejected");
assert(normalizeScanCode("  CP_ABC  ") === "cp_abc", "normalize");
assert(isScanResult("ok") && isScanResult("duplicate") && isScanResult("out_of_route"), "results");
assert(isScanResult("unauthorized") && isScanResult("error"), "error result");
assert(scanResultTone("ok") === "ok", "ok tone");
assert(scanResultTone("duplicate") === "warn", "dup tone");
assert(scanResultTone("unauthorized") === "danger", "unauth tone");

const valid = "cp_" + "ab".repeat(12);
assert(valid.length === 27 && isServerCheckpointCode(valid), "server code shape");
assert(!isServerCheckpointCode("cp_short"), "reject short");
assert(!isServerCheckpointCode("invented-client-id"), "reject invented");

const kept = printableCheckpoints([
  { id: "1", name: "A", code: valid, code_format: "qr" },
  { id: "2", name: "B", code: "not-a-code", code_format: "qr" },
]);
assert(kept.length === 1 && kept[0]!.code === valid, "print drops invalid codes");
assert(mayRenderBarcodeBars() === false, "no fake barcode bars");

const svg = qrSvgMarkup(valid);
assert(svg.includes("<svg"), "qr svg");
assert(svg.includes(valid) === false, "payload is modules not raw text in svg path");
assert(svg.includes('fill="#111"'), "dark modules");

console.log("ssp-c3 unit OK");
