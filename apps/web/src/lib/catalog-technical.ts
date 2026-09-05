/**
 * Typed CCTV catalog technical attributes for Task 13B consumers.
 * Missing keys / null mean unknown — never treat as 0 or false.
 */

export type CameraEnvironment = "indoor" | "outdoor" | "indoor_outdoor";
export type CameraFormFactor = "bullet" | "dome" | "turret" | "ptz" | "other";

export type CameraTechnicalAttrs = {
  resolution_mp: number | null;
  environment: CameraEnvironment | null;
  form_factor: CameraFormFactor | null;
  poe: boolean | null;
  max_power_w: number | null;
  codec: string | null;
  fps: number | null;
  onvif: boolean | null;
  lens_mm: number | null;
};

export type NvrTechnicalAttrs = {
  channels: number | null;
  poe_ports: number | null;
  poe_budget_w: number | null;
  drive_bays: number | null;
  max_hdd_tb: number | null;
  max_incoming_bandwidth_mbps: number | null;
  codecs: string | null;
};

export type HddTechnicalAttrs = {
  capacity_tb: number | null;
  surveillance_grade: boolean | null;
};

export type SwitchTechnicalAttrs = {
  ports: number | null;
  poe_ports: number | null;
  poe_budget_w: number | null;
  port_speed_mbps: number | null;
  uplink_speed_mbps: number | null;
};

function asRecord(attributes: unknown): Record<string, unknown> {
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? (attributes as Record<string, unknown>)
    : {};
}

function readNumber(attrs: Record<string, unknown>, key: string, ...aliases: string[]): number | null {
  for (const k of [key, ...aliases]) {
    const raw = attrs[k];
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readBool(attrs: Record<string, unknown>, key: string): boolean | null {
  if (!(key in attrs) || attrs[key] == null || attrs[key] === "") return null;
  const raw = attrs[key];
  if (typeof raw === "boolean") return raw;
  return null;
}

function readString(attrs: Record<string, unknown>, key: string): string | null {
  const raw = attrs[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export function parseCameraTechnicalAttrs(attributes: unknown): CameraTechnicalAttrs {
  const attrs = asRecord(attributes);
  const environment = readString(attrs, "environment");
  const formFactor = readString(attrs, "form_factor");
  return {
    resolution_mp: readNumber(attrs, "resolution_mp"),
    environment:
      environment === "indoor" || environment === "outdoor" || environment === "indoor_outdoor"
        ? environment
        : null,
    form_factor:
      formFactor === "bullet" ||
      formFactor === "dome" ||
      formFactor === "turret" ||
      formFactor === "ptz" ||
      formFactor === "other"
        ? formFactor
        : null,
    poe: readBool(attrs, "poe"),
    max_power_w: readNumber(attrs, "max_power_w"),
    codec: readString(attrs, "codec"),
    fps: readNumber(attrs, "fps"),
    onvif: readBool(attrs, "onvif"),
    lens_mm: readNumber(attrs, "lens_mm"),
  };
}

export function parseNvrTechnicalAttrs(attributes: unknown): NvrTechnicalAttrs {
  const attrs = asRecord(attributes);
  return {
    channels: readNumber(attrs, "channels"),
    poe_ports: readNumber(attrs, "poe_ports"),
    poe_budget_w: readNumber(attrs, "poe_budget_w", "poe_budget"),
    drive_bays: readNumber(attrs, "drive_bays", "hdd_bays"),
    max_hdd_tb: readNumber(attrs, "max_hdd_tb"),
    max_incoming_bandwidth_mbps: readNumber(attrs, "max_incoming_bandwidth_mbps"),
    codecs: readString(attrs, "codecs"),
  };
}

export function parseHddTechnicalAttrs(attributes: unknown): HddTechnicalAttrs {
  const attrs = asRecord(attributes);
  return {
    capacity_tb: readNumber(attrs, "capacity_tb"),
    surveillance_grade: readBool(attrs, "surveillance_grade"),
  };
}

export function parseSwitchTechnicalAttrs(attributes: unknown): SwitchTechnicalAttrs {
  const attrs = asRecord(attributes);
  return {
    ports: readNumber(attrs, "ports"),
    poe_ports: readNumber(attrs, "poe_ports"),
    poe_budget_w: readNumber(attrs, "poe_budget_w", "poe_budget"),
    port_speed_mbps: readNumber(attrs, "port_speed_mbps"),
    uplink_speed_mbps: readNumber(attrs, "uplink_speed_mbps"),
  };
}

/** Whether core sizing fields are present for a CCTV category family. */
export function hasStructuredTechnicalData(
  categoryKey: string | null | undefined,
  attributes: unknown,
): boolean {
  const attrs = asRecord(attributes);
  const key = (categoryKey || "").trim();
  if (key.startsWith("cameras_")) {
    return ["resolution_mp", "environment", "form_factor", "poe", "max_power_w"].every(
      (k) => attrs[k] != null && attrs[k] !== "",
    );
  }
  if (key === "nvr" || key === "dvr_xvr") {
    return ["channels", "drive_bays", "max_hdd_tb"].every((k) => attrs[k] != null && attrs[k] !== "");
  }
  if (key === "hdd_recorders") {
    return attrs.capacity_tb != null && attrs.capacity_tb !== "";
  }
  if (key.startsWith("switch") || key.startsWith("poe")) {
    return ["ports", "poe_ports", "poe_budget_w"].every((k) => attrs[k] != null && attrs[k] !== "");
  }
  return false;
}
