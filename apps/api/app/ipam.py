"""INF-1B: Network / IPAM validation helpers (stdlib ipaddress)."""

from __future__ import annotations

import ipaddress
import re
from typing import Any

from .errors import ApiError

_MAC_RE = re.compile(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")


def normalize_ip(value: str) -> str:
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError as exc:
        raise ApiError(400, "VALIDATION_ERROR", "כתובת IP אינה תקינה", details={"ip": value}) from exc


def parse_network(cidr: str) -> ipaddress.IPv4Network | ipaddress.IPv6Network:
    try:
        return ipaddress.ip_network(cidr.strip(), strict=False)
    except ValueError as exc:
        raise ApiError(400, "VALIDATION_ERROR", "CIDR אינו תקין", details={"cidr": cidr}) from exc


def normalize_cidr(cidr: str) -> str:
    return str(parse_network(cidr))


def assert_ip_in_network(ip: str, cidr: str) -> str:
    addr = ipaddress.ip_address(normalize_ip(ip))
    net = parse_network(cidr)
    if addr not in net:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "כתובת ה-IP אינה בתוך הרשת שנבחרה",
            details={"ip": str(addr), "cidr": str(net)},
        )
    return str(addr)


def assert_dhcp_range(cidr: str, start: str | None, end: str | None) -> tuple[str | None, str | None]:
    if not start and not end:
        return None, None
    if not start or not end:
        raise ApiError(400, "VALIDATION_ERROR", "טווח DHCP דורש התחלה וסיום")
    s = assert_ip_in_network(start, cidr)
    e = assert_ip_in_network(end, cidr)
    if ipaddress.ip_address(s) > ipaddress.ip_address(e):
        raise ApiError(400, "VALIDATION_ERROR", "טווח DHCP אינו תקין")
    return s, e


def optional_ip(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    return normalize_ip(value)


def optional_mac(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    raw = str(value).strip()
    if not _MAC_RE.match(raw):
        raise ApiError(400, "VALIDATION_ERROR", "כתובת MAC אינה תקינה", details={"mac": raw})
    return raw.upper().replace("-", ":")


def validate_vlan_number(n: int) -> int:
    if n < 1 or n > 4094:
        raise ApiError(400, "VALIDATION_ERROR", "מספר VLAN חייב להיות בין 1 ל-4094")
    return n


def derive_status(*, assignment_type: str, equipment_id: str | None, explicit: str | None) -> str:
    if explicit:
        return explicit
    if equipment_id:
        return "assigned"
    if assignment_type == "reserved":
        return "reserved"
    return "available"


def is_unique_violation(res: Any) -> bool:
    code = getattr(res, "status_code", None)
    try:
        body = res.json() if hasattr(res, "json") else {}
    except Exception:
        body = {}
    if not isinstance(body, dict):
        return False
    pg = str(body.get("code") or "")
    msg = str(body.get("message") or "").lower()
    details = str(body.get("details") or "").lower()
    return (
        code in {409, 400}
        and (
            pg == "23505"
            or "duplicate" in msg
            or "unique" in msg
            or "site_ip_addresses_site_ip" in details
            or "site_vlans_site_number" in details
        )
    )
