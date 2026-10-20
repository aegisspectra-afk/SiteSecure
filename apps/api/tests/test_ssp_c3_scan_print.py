"""C3 — scan result contract + print must not invent checkpoint codes (no live DB)."""

from __future__ import annotations

from pathlib import Path

from app.ssp.scan_rules import resolve_scan_result

ROOT = Path(__file__).resolve().parents[3]
SSP = ROOT / "apps" / "ssp" / "src"


def test_scan_api_results_unchanged():
    assert resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=False, run_status="active") == "ok"
    assert resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=True, run_status="active") == "duplicate"
    assert resolve_scan_result(checkpoint_on_route=False, already_ok_scanned=False, run_status="active") == "out_of_route"
    assert resolve_scan_result(checkpoint_on_route=True, already_ok_scanned=False, run_status="planned") == "unauthorized"


def test_scan_page_sends_existing_api_and_locks_pending():
    src = (SSP / "routes" / "ScanPage.tsx").read_text(encoding="utf-8")
    assert "createSspScan" in src
    assert "canSubmitScan" in src
    assert "pendingRef" in src
    assert "QrScanner" in src
    assert "ezguard" not in src.lower()


def test_print_uses_server_code_not_client_minted_ids():
    print_lib = (SSP / "lib" / "printCheckpoints.ts").read_text(encoding="utf-8")
    assert "cp_[a-f0-9]{24}" in print_lib
    assert "printableCheckpoints" in print_lib
    card = (SSP / "components" / "CheckpointPrintCard.tsx").read_text(encoding="utf-8")
    assert "qrSvgMarkup" in card
    assert "checkpoint.code" in card
    assert "gen_random" not in card
    assert "ezguard" not in card.lower()


def test_camera_released_on_unmount():
    scanner = (SSP / "components" / "QrScanner.tsx").read_text(encoding="utf-8")
    assert "ctl.stop()" in scanner
    cam = (SSP / "lib" / "cameraQr.ts").read_text(encoding="utf-8")
    assert "getTracks()" in cam
    assert "facingMode" in cam
