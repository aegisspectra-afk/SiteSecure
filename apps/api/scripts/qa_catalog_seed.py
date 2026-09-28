"""Idempotent QA catalog seed for one explicit workspace.

Refuses production APP_ENV and any workspace whose name does not contain "QA".
Does not touch other tenants. Safe to run again: QA SKUs are updated in place.

Usage:
  python apps/api/scripts/qa_catalog_seed.py \\
    --workspace-id <uuid> \\
    --expect-name "Phase1B QA 1790012816"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "api" / ".env")

SUP = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APP_ENV = (os.environ.get("APP_ENV") or "development").strip().lower()


def _headers(prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": SERVICE,
        "Authorization": f"Bearer {SERVICE}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _die(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def product(
    sku: str,
    name: str,
    category: str,
    *,
    unit: str = "unit",
    kind: str = "product",
    sell: float,
    cost: float,
    manufacturer: str,
    model: str,
    warranty_months: int | None = None,
    attributes: dict | None = None,
    vat_eligible: bool = True,
) -> dict:
    warranty = f" אחריות {warranty_months} חודשים." if warranty_months else ""
    return {
        "sku": sku,
        "name": name,
        "category": category,
        "unit": unit,
        "kind": kind,
        "is_labor": kind == "service",
        "list_price": sell,
        "cost": cost,
        "vat_eligible": vat_eligible,
        "is_active": True,
        "manufacturer": manufacturer,
        "model": model,
        "description": f"QA catalog seed.{warranty}".strip(),
        "attributes": attributes or {},
        "warranty_months": warranty_months,
    }


PRODUCTS: list[dict] = [
    product("QA-CAM-4MP-TURRET", "QA Camera 4MP Turret", "cameras_ip", sell=249.95, cost=119.90, manufacturer="QA Vision", model="QV-T4", warranty_months=24, attributes={"resolution_mp": 4, "environment": "indoor_outdoor", "form_factor": "turret", "poe": True, "max_power_w": 8, "lens_mm": 2.8, "fps": 25, "onvif": True, "codec": "H.265"}),
    product("QA-CAM-4MP-BULLET", "QA Camera 4MP Bullet", "cameras_ip", sell=219.00, cost=104.50, manufacturer="QA Vision", model="QV-B4", warranty_months=24, attributes={"resolution_mp": 4, "environment": "outdoor", "form_factor": "bullet", "poe": True, "max_power_w": 9, "lens_mm": 4, "fps": 25, "onvif": True, "codec": "H.265"}),
    product("QA-CAM-8MP-TURRET", "QA Camera 8MP Turret", "cameras_ip", sell=389.90, cost=210.00, manufacturer="QA Vision", model="QV-T8", warranty_months=36, attributes={"resolution_mp": 8, "environment": "outdoor", "form_factor": "turret", "poe": True, "max_power_w": 12, "lens_mm": 2.8, "fps": 20, "onvif": True, "codec": "H.265"}),
    product("QA-CAM-PTZ", "QA Camera PTZ", "cameras_ptz", sell=890.00, cost=510.00, manufacturer="QA Vision", model="QV-PTZ4", warranty_months=24, attributes={"resolution_mp": 4, "environment": "outdoor", "form_factor": "ptz", "poe": True, "max_power_w": 18, "lens_mm": 4.8, "fps": 25, "onvif": True, "codec": "H.265"}),
    product("QA-CAM-DOME", "QA Indoor Dome", "cameras_ip", sell=179.00, cost=86.40, manufacturer="QA Vision", model="QV-D4", warranty_months=12, attributes={"resolution_mp": 4, "environment": "indoor", "form_factor": "dome", "poe": True, "max_power_w": 6, "lens_mm": 2.8, "fps": 20, "onvif": True, "codec": "H.265"}),
    product("QA-CAM-ANALOG-2MP", "QA Analog Dome 2MP", "cameras_analog", sell=94.99, cost=48.00, manufacturer="QA Vision", model="QV-A2", warranty_months=12, attributes={"resolution_mp": 2, "environment": "indoor", "form_factor": "dome", "poe": False, "fps": 25}),
    product("QA-NVR-004", "QA NVR 4CH", "nvr", sell=640.00, cost=390.00, manufacturer="QA Secure", model="QS-N4", warranty_months=24, attributes={"channels": 4, "poe_ports": 4, "poe_budget_w": 40, "drive_bays": 1, "max_hdd_tb": 8, "max_incoming_bandwidth_mbps": 40, "codecs": "H.265"}),
    product("QA-NVR-008", "QA NVR 8CH", "nvr", sell=980.00, cost=560.00, manufacturer="QA Secure", model="QS-N8", warranty_months=24, attributes={"channels": 8, "poe_ports": 8, "poe_budget_w": 80, "drive_bays": 2, "max_hdd_tb": 16, "max_incoming_bandwidth_mbps": 80, "codecs": "H.265"}),
    product("QA-NVR-016", "QA NVR 16CH", "nvr", sell=1490.00, cost=820.00, manufacturer="QA Secure", model="QS-N16", warranty_months=36, attributes={"channels": 16, "poe_ports": 16, "poe_budget_w": 160, "drive_bays": 2, "max_hdd_tb": 32, "max_incoming_bandwidth_mbps": 160, "codecs": "H.265"}),
    product("QA-NVR-032", "QA NVR 32CH", "nvr", sell=2490.00, cost=1380.00, manufacturer="QA Secure", model="QS-N32", warranty_months=36, attributes={"channels": 32, "poe_ports": 16, "poe_budget_w": 200, "drive_bays": 4, "max_hdd_tb": 64, "max_incoming_bandwidth_mbps": 320, "codecs": "H.265"}),
    product("QA-DVR-008", "QA DVR 8CH", "dvr_xvr", sell=720.00, cost=410.00, manufacturer="QA Secure", model="QS-D8", warranty_months=12, attributes={"channels": 8, "poe_ports": 0, "drive_bays": 1, "max_hdd_tb": 10, "max_incoming_bandwidth_mbps": 40, "codecs": "H.265"}),
    product("QA-HDD-2TB", "QA HDD 2TB Surveillance", "hdd_recorders", sell=189.00, cost=112.00, manufacturer="QA Secure", model="QS-H2", warranty_months=24, attributes={"capacity_tb": 2, "surveillance_grade": True}),
    product("QA-HDD-4TB", "QA HDD 4TB Surveillance", "hdd_recorders", sell=249.95, cost=148.50, manufacturer="QA Secure", model="QS-H4", warranty_months=24, attributes={"capacity_tb": 4, "surveillance_grade": True}),
    product("QA-HDD-8TB", "QA HDD 8TB Surveillance", "hdd_recorders", sell=419.00, cost=255.00, manufacturer="QA Secure", model="QS-H8", warranty_months=36, attributes={"capacity_tb": 8, "surveillance_grade": True}),
    product("QA-HDD-12TB", "QA HDD 12TB Surveillance", "hdd_recorders", sell=589.90, cost=360.00, manufacturer="QA Secure", model="QS-H12", warranty_months=36, attributes={"capacity_tb": 12, "surveillance_grade": True}),
    product("QA-POE-004", "QA PoE Switch 4-Port", "poe", sell=210.00, cost=118.00, manufacturer="QA Network", model="QN-P4", warranty_months=24, attributes={"ports": 4, "poe_ports": 4, "poe_budget_w": 60, "port_speed_mbps": 1000, "uplink_speed_mbps": 1000}),
    product("QA-POE-008", "QA PoE Switch 8-Port", "poe", sell=289.00, cost=165.00, manufacturer="QA Network", model="QN-P8", warranty_months=24, attributes={"ports": 8, "poe_ports": 8, "poe_budget_w": 120, "port_speed_mbps": 1000, "uplink_speed_mbps": 1000}),
    product("QA-POE-016", "QA PoE Switch 16-Port", "poe_plus", sell=549.00, cost=320.00, manufacturer="QA Network", model="QN-P16", warranty_months=36, attributes={"ports": 16, "poe_ports": 16, "poe_budget_w": 250, "port_speed_mbps": 1000, "uplink_speed_mbps": 1000}),
    product("QA-POE-024", "QA PoE Switch 24-Port", "poe_plusplus", sell=890.00, cost=510.00, manufacturer="QA Network", model="QN-P24", warranty_months=36, attributes={"ports": 24, "poe_ports": 24, "poe_budget_w": 400, "port_speed_mbps": 1000, "uplink_speed_mbps": 10000}),
    product("QA-SW-GIG-008", "QA Gigabit Network Switch", "switch_unmanaged", sell=119.90, cost=62.00, manufacturer="QA Network", model="QN-G8", warranty_months=12, attributes={"ports": 8, "poe_ports": 0, "port_speed_mbps": 1000, "uplink_speed_mbps": 1000}),
    product("QA-RTR-001", "QA Router", "router", sell=320.00, cost=175.00, manufacturer="QA Network", model="QN-R1", warranty_months=24),
    product("QA-AP-001", "QA WiFi Access Point", "access_point", sell=210.00, cost=98.00, manufacturer="QA Network", model="QN-AP1", warranty_months=24),
    product("QA-RADIO-PTP", "QA Point-to-Point Radio", "network_accessories", sell=640.00, cost=360.00, manufacturer="QA Network", model="QN-PTP", warranty_months=12),
    product("QA-MC-001", "QA Media Converter", "media_converter", sell=89.90, cost=42.00, manufacturer="QA Network", model="QN-MC", warranty_months=12),
    product("QA-SFP-001", "QA SFP Module", "sfp", sell=64.90, cost=28.00, manufacturer="QA Network", model="QN-SFP1G", warranty_months=12),
    product("QA-CBL-CAT6-M", "QA CAT6 Cable", "cat6", unit="m", sell=3.90, cost=1.80, manufacturer="QA Network", model="QN-C6", attributes={"outdoor": False, "shielded": False}),
    product("QA-CBL-CAT6-305", "QA CAT6 Box 305m", "cat6", unit="roll", sell=890.00, cost=520.00, manufacturer="QA Network", model="QN-C6-305", attributes={"length_m": 305, "outdoor": False, "shielded": False}),
    product("QA-CBL-CAT6-OUT", "QA Outdoor CAT6", "outdoor_network_cable", unit="m", sell=6.50, cost=3.20, manufacturer="QA Network", model="QN-C6-OUT", attributes={"outdoor": True, "shielded": True}),
    product("QA-PATCH-1M", "QA Patch Cord", "cat6", sell=12.50, cost=4.20, manufacturer="QA Network", model="QN-PC1", attributes={"length_m": 1, "outdoor": False, "shielded": False}),
    product("QA-RJ45-100", "QA RJ45 Connector", "rj45_connectors", unit="pack", sell=24.90, cost=8.50, manufacturer="QA Network", model="QN-RJ45"),
    product("QA-JBOX", "QA Junction Box", "junction_boxes", sell=18.00, cost=7.40, manufacturer="QA Network", model="QN-JB"),
    product("QA-MOUNT", "QA Camera Mount", "camera_mounts", sell=29.90, cost=11.00, manufacturer="QA Vision", model="QV-MNT"),
    product("QA-CONDUIT", "QA Conduit", "conduit", unit="m", sell=8.50, cost=3.10, manufacturer="QA Network", model="QN-CND"),
    product("QA-TRUNK", "QA Trunking", "trunking", unit="m", sell=11.90, cost=4.60, manufacturer="QA Network", model="QN-TRK"),
    product("QA-UPS-650", "QA UPS 650VA", "ups", sell=249.00, cost=142.00, manufacturer="QA Secure", model="QS-U650", warranty_months=24),
    product("QA-UPS-1000", "QA UPS 1000VA", "ups", sell=389.00, cost=220.00, manufacturer="QA Secure", model="QS-U1000", warranty_months=24),
    product("QA-PSU-12V", "QA 12V PSU", "psu", sell=45.00, cost=18.50, manufacturer="QA Secure", model="QS-12V"),
    product("QA-PDU", "QA Power Distribution Unit", "power_accessories", sell=79.90, cost=34.00, manufacturer="QA Secure", model="QS-PDU"),
    product("QA-RACK-6U", "QA Network Rack 6U", "rack", sell=420.00, cost=240.00, manufacturer="QA Network", model="QN-R6", warranty_months=12),
    product("QA-RACK-9U", "QA Network Rack 9U", "rack", sell=560.00, cost=320.00, manufacturer="QA Network", model="QN-R9", warranty_months=12),
    product("QA-RACK-12U", "QA Network Rack 12U", "rack", sell=740.00, cost=410.00, manufacturer="QA Network", model="QN-R12", warranty_months=12),
    product("QA-RACK-SHELF", "QA Rack Shelf", "rack", sell=64.90, cost=28.00, manufacturer="QA Network", model="QN-SH"),
    product("QA-PATCH-PANEL", "QA Patch Panel", "patch_panel", sell=119.00, cost=54.00, manufacturer="QA Network", model="QN-PP24", warranty_months=12),
    product("QA-ACC-2D", "QA Access Controller 2-Door", "access_controllers", sell=680.00, cost=390.00, manufacturer="QA Access", model="QA-C2", warranty_months=24),
    product("QA-ACC-4D", "QA Access Controller 4-Door", "access_controllers", sell=980.00, cost=560.00, manufacturer="QA Access", model="QA-C4", warranty_months=36),
    product("QA-RFID", "QA RFID Reader", "rfid_readers", sell=149.90, cost=72.00, manufacturer="QA Access", model="QA-RF", warranty_months=24),
    product("QA-KEYPAD", "QA Keypad Reader", "card_readers", sell=189.00, cost=92.00, manufacturer="QA Access", model="QA-KP", warranty_months=24),
    product("QA-MAGLOCK", "QA Magnetic Lock", "magnetic_locks", sell=189.00, cost=95.00, manufacturer="QA Access", model="QA-ML600", warranty_months=24),
    product("QA-STRIKE", "QA Electric Strike", "electric_locks", sell=160.00, cost=78.00, manufacturer="QA Access", model="QA-ES", warranty_months=24),
    product("QA-EXIT", "QA Exit Button", "exit_buttons", sell=42.00, cost=16.50, manufacturer="QA Access", model="QA-EX"),
    product("QA-DOOR-CONTACT", "QA Door Contact", "access_accessories", sell=22.00, cost=7.80, manufacturer="QA Access", model="QA-DC"),
    product("QA-CARD", "QA Access Card", "access_cards", unit="pack", sell=35.00, cost=12.00, manufacturer="QA Access", model="QA-CARD"),
    product("QA-FOB", "QA Access Fob", "rfid_tags", unit="pack", sell=28.00, cost=9.50, manufacturer="QA Access", model="QA-FOB"),
    product("QA-CLOSER", "QA Door Closer", "access_accessories", sell=85.00, cost=38.00, manufacturer="QA Access", model="QA-CL"),
    product("QA-ALM-PANEL", "QA Alarm Panel", "alarm_panels", sell=760.00, cost=420.00, manufacturer="QA Alarm", model="QAL-P", warranty_months=24),
    product("QA-PIR", "QA PIR Detector", "pir_detectors", sell=68.00, cost=29.00, manufacturer="QA Alarm", model="QAL-PIR"),
    product("QA-MAG-ALM", "QA Door Magnetic Contact", "magnetic_contacts", sell=18.50, cost=6.20, manufacturer="QA Alarm", model="QAL-MC"),
    product("QA-PIR-OUT", "QA Outdoor Detector", "pir_detectors", sell=119.90, cost=58.00, manufacturer="QA Alarm", model="QAL-OUT"),
    product("QA-SIREN", "QA Siren", "sirens", sell=95.00, cost=41.00, manufacturer="QA Alarm", model="QAL-SR"),
    product("QA-ALM-KP", "QA Keypad", "keypads", sell=140.00, cost=66.00, manufacturer="QA Alarm", model="QAL-KP"),
    product("QA-BATT", "QA Backup Battery", "alarm_batteries", sell=54.90, cost=22.00, manufacturer="QA Alarm", model="QAL-BAT"),
    product("QA-EXPANDER", "QA Wireless Expander", "alarm_modules", sell=180.00, cost=88.00, manufacturer="QA Alarm", model="QAL-WX", warranty_months=12),
    product("QA-IC-DOOR", "QA IP Door Station", "intercom_ip", sell=540.00, cost=290.00, manufacturer="QA Access", model="QA-DS", warranty_months=24),
    product("QA-IC-MON", "QA Indoor Monitor", "intercom_monitors", sell=420.00, cost=230.00, manufacturer="QA Access", model="QA-MON", warranty_months=24),
    product("QA-IC-PSU", "QA Intercom Power Supply", "intercom_psu", sell=75.00, cost=32.00, manufacturer="QA Access", model="QA-IPS"),
    product("QA-IC-CTRL", "QA Intercom Controller", "intercom_panels", sell=310.00, cost=160.00, manufacturer="QA Access", model="QA-IC", warranty_months=24),
    product("QA-FIRE-PANEL", "QA Fire Panel", "fire_panels", sell=980.00, cost=540.00, manufacturer="QA Alarm", model="QAL-FP", warranty_months=24),
    product("QA-SMOKE", "QA Smoke Detector", "smoke_detectors_fire", sell=72.00, cost=31.00, manufacturer="QA Alarm", model="QAL-SM"),
    product("QA-FIRE-SIREN", "QA Fire Siren", "fire_sirens", sell=88.00, cost=36.00, manufacturer="QA Alarm", model="QAL-FS"),
    product("QA-LAB-HOUR", "QA Installation Labor — Hour", "labor_hourly", unit="hour", kind="service", sell=180.00, cost=90.00, manufacturer="QA Secure", model="LAB-H"),
    product("QA-LAB-TECH", "QA Technician Labor — Hour", "labor_hourly", unit="hour", kind="service", sell=160.00, cost=80.00, manufacturer="QA Secure", model="LAB-T"),
    product("QA-LAB-CAM", "QA Camera Installation — Unit", "labor_install_cameras", kind="service", sell=120.00, cost=55.00, manufacturer="QA Secure", model="LAB-CAM"),
    product("QA-LAB-CBL", "QA Cable Installation — Meter", "labor_cable_pull", unit="m", kind="service", sell=8.00, cost=3.50, manufacturer="QA Secure", model="LAB-CBL"),
    product("QA-LAB-PROG", "QA Programming / Commissioning", "labor_system_setup", unit="hour", kind="service", sell=220.00, cost=100.00, manufacturer="QA Secure", model="LAB-PRG"),
    product("QA-LAB-SURVEY", "QA Site Survey", "labor_tech_visit", unit="job", kind="service", sell=250.00, cost=80.00, manufacturer="QA Secure", model="LAB-SRV"),
    product("QA-LAB-CALLOUT", "QA Travel / Call-out", "labor_tech_visit", unit="job", kind="service", sell=150.00, cost=40.00, manufacturer="QA Secure", model="LAB-CO"),
    product("QA-LAB-MAINT", "QA Maintenance Visit", "labor_maintenance", unit="job", kind="service", sell=280.00, cost=110.00, manufacturer="QA Secure", model="LAB-MNT"),
    product("QA-LAB-ACC", "QA Access Installation — Door", "labor_install_access", unit="job", kind="service", sell=320.00, cost=140.00, manufacturer="QA Access", model="LAB-ACC"),
    product("QA-MISC", "QA Misc Hardware", "install_accessories", sell=15.00, cost=4.50, manufacturer="QA Network", model="QN-MISC"),
    product("QA-CONS", "QA Consumables", "install_accessories", unit="pack", sell=19.90, cost=6.40, manufacturer="QA Network", model="QN-CON"),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--expect-name", required=True)
    args = parser.parse_args()
    workspace_id = args.workspace_id.strip()
    expect_name = args.expect_name.strip()

    host = urlparse(SUP).hostname or ""
    api_public = os.environ.get("API_PUBLIC_URL") or "http://localhost:8000"
    web_public = os.environ.get("WEB_PUBLIC_URL") or "http://localhost:5173"
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if APP_ENV == "production":
        _die("refusing: APP_ENV=production")
    if not host:
        _die("refusing: SUPABASE_URL host missing")
    for label, url in (("API_PUBLIC_URL", api_public), ("WEB_PUBLIC_URL", web_public)):
        public_host = urlparse(url).hostname or ""
        if public_host not in local_hosts:
            _die(f"refusing: {label} is not a local host ({public_host})")
    print(json.dumps({
        "app_env": APP_ENV,
        "supabase_host": host,
        "api_public_url": api_public,
        "web_public_url": web_public,
    }, ensure_ascii=False))

    with httpx.Client(timeout=60) as client:
        ws = client.get(
            f"{SUP}/rest/v1/workspaces",
            headers=_headers(),
            params={"id": f"eq.{workspace_id}", "select": "id,name,status"},
        )
        if ws.status_code != 200:
            _die(f"workspace lookup failed {ws.status_code}")
        rows = ws.json()
        if len(rows) != 1:
            _die("workspace not found")
        workspace = rows[0]
        if workspace["name"] != expect_name:
            _die("workspace name does not match --expect-name; refusing")
        if "qa" not in workspace["name"].lower():
            _die("workspace name does not contain QA; refusing")

        cats = client.get(
            f"{SUP}/rest/v1/product_categories",
            headers=_headers(),
            params={"workspace_id": f"eq.{workspace_id}", "select": "id,key", "archived_at": "is.null"},
        )
        if cats.status_code != 200:
            _die(f"category lookup failed {cats.status_code} {cats.text[:200]}")
        by_key = {row["key"]: row["id"] for row in cats.json()}
        missing = sorted({item["category"] for item in PRODUCTS if item["category"] not in by_key})
        if missing:
            _die("missing category keys: " + ", ".join(missing))

        existing = client.get(
            f"{SUP}/rest/v1/products",
            headers=_headers(),
            params={"workspace_id": f"eq.{workspace_id}", "sku": "like.QA-*", "select": "sku"},
        )
        if existing.status_code != 200:
            _die(f"existing sku lookup failed {existing.status_code}")
        had = {row["sku"] for row in existing.json()}

        payload = []
        for item in PRODUCTS:
            row = {k: v for k, v in item.items() if k not in {"category", "warranty_months"}}
            row["workspace_id"] = workspace_id
            row["category_id"] = by_key[item["category"]]
            payload.append(row)
        saved = client.post(
            f"{SUP}/rest/v1/products",
            headers=_headers("resolution=merge-duplicates,return=representation"),
            params={"on_conflict": "workspace_id,sku"},
            json=payload,
        )
        if saved.status_code not in {200, 201}:
            _die(f"product upsert failed {saved.status_code} {saved.text[:500]}")
        saved_rows = saved.json()
        sku_to_id = {row["sku"]: row["id"] for row in saved_rows}
        created = sorted(set(sku_to_id) - had)
        updated = sorted(set(sku_to_id) & had)

        packages = [
            {
                "name": "QA CCTV — 4 Cameras",
                "description": "QA package: 4 turret cameras, 8CH NVR, 4TB disk, 8-port PoE, installation.",
                "category": "cctv",
                "items": [
                    ("QA-CAM-4MP-TURRET", 4),
                    ("QA-NVR-008", 1),
                    ("QA-HDD-4TB", 1),
                    ("QA-POE-008", 1),
                    ("QA-LAB-CAM", 4),
                ],
            },
            {
                "name": "QA CCTV — 8 Cameras",
                "description": "QA package: 8 cameras, 16CH NVR, 8TB disk, 16-port PoE, installation.",
                "category": "cctv",
                "items": [
                    ("QA-CAM-4MP-TURRET", 4),
                    ("QA-CAM-4MP-BULLET", 4),
                    ("QA-NVR-016", 1),
                    ("QA-HDD-8TB", 1),
                    ("QA-POE-016", 1),
                    ("QA-LAB-CAM", 8),
                    ("QA-LAB-HOUR", 4),
                ],
            },
            {
                "name": "QA Access Control — Single Door",
                "description": "QA package: controller, reader, lock, exit button, door contact, labor.",
                "category": "access",
                "items": [
                    ("QA-ACC-2D", 1),
                    ("QA-RFID", 1),
                    ("QA-MAGLOCK", 1),
                    ("QA-EXIT", 1),
                    ("QA-DOOR-CONTACT", 1),
                    ("QA-LAB-ACC", 1),
                ],
            },
        ]
        package_ids = []
        for spec in packages:
            found = client.get(
                f"{SUP}/rest/v1/quote_packages",
                headers=_headers(),
                params={"workspace_id": f"eq.{workspace_id}", "name": f"eq.{spec['name']}", "select": "id"},
            )
            if found.status_code != 200:
                _die(f"package lookup failed {found.status_code}")
            current = found.json()
            if current:
                package_id = current[0]["id"]
                patched = client.patch(
                    f"{SUP}/rest/v1/quote_packages",
                    headers=_headers("return=representation"),
                    params={"id": f"eq.{package_id}", "workspace_id": f"eq.{workspace_id}"},
                    json={"description": spec["description"], "category": spec["category"], "is_active": True},
                )
                if patched.status_code not in {200, 204}:
                    _die(f"package patch failed {patched.status_code} {patched.text[:300]}")
                deleted = client.delete(
                    f"{SUP}/rest/v1/quote_package_items",
                    headers=_headers(),
                    params={"package_id": f"eq.{package_id}", "workspace_id": f"eq.{workspace_id}"},
                )
                if deleted.status_code not in {200, 204}:
                    _die(f"package item reset failed {deleted.status_code}")
            else:
                inserted = client.post(
                    f"{SUP}/rest/v1/quote_packages",
                    headers=_headers("return=representation"),
                    json={
                        "workspace_id": workspace_id,
                        "name": spec["name"],
                        "description": spec["description"],
                        "category": spec["category"],
                        "is_active": True,
                    },
                )
                if inserted.status_code not in {200, 201}:
                    _die(f"package insert failed {inserted.status_code} {inserted.text[:300]}")
                package_id = inserted.json()[0]["id"]
            items = []
            for index, (sku, qty) in enumerate(spec["items"], start=1):
                items.append({
                    "workspace_id": workspace_id,
                    "package_id": package_id,
                    "product_id": sku_to_id[sku],
                    "description": next(p["name"] for p in PRODUCTS if p["sku"] == sku),
                    "qty": qty,
                    "sort_order": index * 10,
                })
            item_save = client.post(
                f"{SUP}/rest/v1/quote_package_items",
                headers=_headers("return=minimal"),
                json=items,
            )
            if item_save.status_code not in {200, 201}:
                _die(f"package items failed {item_save.status_code} {item_save.text[:300]}")
            package_ids.append({"name": spec["name"], "id": package_id, "items": len(items)})

        templates = [
            {
                "key": "qa_cctv_standard",
                "name_he": "QA TEMPLATE — CCTV Standard",
                "description": "QA template for CCTV quotes.",
                "category": "cctv",
                "default_warranty": "24 חודשים לציוד CCTV",
                "default_notes": "QA template. נתוני בדיקה בלבד.",
                "lines": [
                    ("ציוד CCTV", "QA-CAM-4MP-TURRET", 4, "catalog"),
                    ("ציוד CCTV", "QA-NVR-008", 1, "catalog"),
                    ("ציוד CCTV", "QA-HDD-4TB", 1, "catalog"),
                    ("תשתיות", "QA-POE-008", 1, "catalog"),
                    ("תשתיות", "QA-CBL-CAT6-M", 80, "catalog"),
                    ("התקנה ועבודה", "QA-LAB-CAM", 4, "labor"),
                    ("התקנה ועבודה", "QA-LAB-PROG", 2, "labor"),
                    ("הערות / תנאים", None, 1, "note"),
                ],
            },
            {
                "key": "qa_access_control",
                "name_he": "QA TEMPLATE — Access Control",
                "description": "QA template for a single access-controlled door.",
                "category": "access",
                "default_warranty": "24 חודשים לבקר ולקורא",
                "default_notes": "QA template. נתוני בדיקה בלבד.",
                "lines": [
                    ("בקרת כניסה", "QA-ACC-2D", 1, "catalog"),
                    ("בקרת כניסה", "QA-RFID", 1, "catalog"),
                    ("בקרת כניסה", "QA-MAGLOCK", 1, "catalog"),
                    ("בקרת כניסה", "QA-EXIT", 1, "catalog"),
                    ("התקנה ועבודה", "QA-LAB-ACC", 1, "labor"),
                    ("הערות / תנאים", None, 1, "note"),
                ],
            },
        ]
        template_ids = []
        for spec in templates:
            found = client.get(
                f"{SUP}/rest/v1/quote_templates",
                headers=_headers(),
                params={"workspace_id": f"eq.{workspace_id}", "key": f"eq.{spec['key']}", "select": "id"},
            )
            if found.status_code != 200:
                _die(f"template lookup failed {found.status_code}")
            current = found.json()
            body = {
                "name_he": spec["name_he"],
                "description": spec["description"],
                "category": spec["category"],
                "is_active": True,
                "default_warranty": spec["default_warranty"],
                "default_notes": spec["default_notes"],
            }
            if current:
                template_id = current[0]["id"]
                patched = client.patch(
                    f"{SUP}/rest/v1/quote_templates",
                    headers=_headers("return=minimal"),
                    params={"id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}"},
                    json=body,
                )
                if patched.status_code not in {200, 204}:
                    _die(f"template patch failed {patched.status_code} {patched.text[:300]}")
                deleted = client.delete(
                    f"{SUP}/rest/v1/quote_template_items",
                    headers=_headers(),
                    params={"template_id": f"eq.{template_id}", "workspace_id": f"eq.{workspace_id}"},
                )
                if deleted.status_code not in {200, 204}:
                    _die(f"template item reset failed {deleted.status_code}")
            else:
                inserted = client.post(
                    f"{SUP}/rest/v1/quote_templates",
                    headers=_headers("return=representation"),
                    json={"workspace_id": workspace_id, "key": spec["key"], **body},
                )
                if inserted.status_code not in {200, 201}:
                    _die(f"template insert failed {inserted.status_code} {inserted.text[:300]}")
                template_id = inserted.json()[0]["id"]
            lines = []
            for index, (section, sku, qty, item_type) in enumerate(spec["lines"], start=1):
                lines.append({
                    "workspace_id": workspace_id,
                    "template_id": template_id,
                    "product_id": sku_to_id[sku] if sku else None,
                    "description": "QA תנאים: נתוני בדיקה בלבד. האחריות לפי תיאור הפריט ואינה ייעוץ." if sku is None else next(p["name"] for p in PRODUCTS if p["sku"] == sku),
                    "qty": qty,
                    "sort_order": index * 10,
                    "section_name": section,
                    "item_type": item_type,
                    "discount": 0,
                    "discount_type": "amount",
                })
            line_save = client.post(
                f"{SUP}/rest/v1/quote_template_items",
                headers=_headers("return=minimal"),
                json=lines,
            )
            if line_save.status_code not in {200, 201}:
                _die(f"template lines failed {line_save.status_code} {line_save.text[:400]}")
            template_ids.append({"key": spec["key"], "id": template_id, "lines": len(lines)})

        roles = client.get(
            f"{SUP}/rest/v1/workspace_memberships",
            headers=_headers(),
            params={"workspace_id": f"eq.{workspace_id}", "select": "role_key,status"},
        )
        role_rows = roles.json() if roles.status_code == 200 else []

    summary = {
        "workspace_id": workspace_id,
        "workspace_name": workspace["name"],
        "workspace_status": workspace["status"],
        "products_total": len(PRODUCTS),
        "products_created": len(created),
        "products_updated": len(updated),
        "categories": sorted({item["category"] for item in PRODUCTS}),
        "services": [item["sku"] for item in PRODUCTS if item["kind"] == "service"],
        "warranty_descriptions": sum(1 for item in PRODUCTS if item["warranty_months"]),
        "with_cost": sum(1 for item in PRODUCTS if item["cost"] is not None),
        "packages": package_ids,
        "templates": template_ids,
        "roles": role_rows,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
