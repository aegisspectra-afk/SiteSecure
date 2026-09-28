import {
  ApiClientError,
  type AssetConnectionOut,
  type TopologyNodeOut,
} from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { he } from "../../i18n/he";
import { equipmentCategoryLabel } from "../../lib/site-assets";
import { useSession } from "../../lib/session";

const NODE_W = 168;
const NODE_H = 72;
const H_GAP = 36;
const V_GAP = 56;

type LaidOutNode = TopologyNodeOut & { x: number; y: number; layer: number };

function connectionTypeLabel(type: string): string {
  return he.connectionTypes[type as keyof typeof he.connectionTypes] ?? type;
}

/** Layered top-down layout from roots (no incoming edges). Directional, not mirrored for RTL. */
function layoutNodes(nodes: TopologyNodeOut[], edges: AssetConnectionOut[]): LaidOutNode[] {
  if (!nodes.length) return [];
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of ids) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source_equipment_id) || !ids.has(e.target_equipment_id)) continue;
    incoming.set(e.target_equipment_id, (incoming.get(e.target_equipment_id) || 0) + 1);
    outgoing.get(e.source_equipment_id)!.push(e.target_equipment_id);
  }

  const layerOf = new Map<string, number>();
  const roots = [...ids].filter((id) => (incoming.get(id) || 0) === 0);
  const seed = roots.length ? roots : [nodes[0]!.id];
  const queue = [...seed];
  for (const id of seed) layerOf.set(id, 0);

  while (queue.length) {
    const cur = queue.shift()!;
    const base = layerOf.get(cur) ?? 0;
    for (const next of outgoing.get(cur) || []) {
      const prev = layerOf.get(next);
      if (prev == null || prev < base + 1) {
        layerOf.set(next, base + 1);
        queue.push(next);
      }
    }
  }

  // orphans / cycles leftover
  for (const id of ids) {
    if (!layerOf.has(id)) layerOf.set(id, 0);
  }

  const byLayer = new Map<number, string[]>();
  for (const id of ids) {
    const layer = layerOf.get(id) ?? 0;
    const list = byLayer.get(layer) || [];
    list.push(id);
    byLayer.set(layer, list);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const laid: LaidOutNode[] = [];
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const layer of layers) {
    const row = (byLayer.get(layer) || []).sort((a, b) => {
      const na = nodeById.get(a);
      const nb = nodeById.get(b);
      return (na?.asset_code || na?.name || a).localeCompare(nb?.asset_code || nb?.name || b);
    });
    const rowWidth = row.length * NODE_W + Math.max(0, row.length - 1) * H_GAP;
    const startX = -rowWidth / 2;
    row.forEach((id, i) => {
      const n = nodeById.get(id)!;
      laid.push({
        ...n,
        layer,
        x: startX + i * (NODE_W + H_GAP),
        y: layer * (NODE_H + V_GAP),
      });
    });
  }
  return laid;
}

export function SiteTopologyPanel({
  siteId,
  canEdit,
}: {
  siteId: string;
  canEdit?: boolean;
}) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const topologyQuery = useQuery({
    queryKey: ["site-topology", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSiteTopology(workspaceId!, siteId),
  });

  const nodes = topologyQuery.data?.nodes ?? [];
  const edges = topologyQuery.data?.edges ?? [];
  const laid = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);
  const pos = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  const bounds = useMemo(() => {
    if (!laid.length) return { minX: 0, minY: 0, maxX: 400, maxY: 240 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of laid) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    }
    const pad = 48;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [laid]);

  const viewW = Math.max(320, bounds.maxX - bounds.minX);
  const viewH = Math.max(240, bounds.maxY - bounds.minY);

  const fit = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-topo-node]")) return;
    drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.ox + (e.clientX - drag.current.px),
      y: drag.current.oy + (e.clientY - drag.current.py),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const openAsset = (id: string) => {
    setSelectedId(id);
    void navigate({
      to: "/app/sites/$siteId/assets/$assetId",
      params: { siteId, assetId: id },
    });
  };

  if (topologyQuery.isError) {
    return (
      <p className="text-sm text-danger" role="alert">
        {topologyQuery.error instanceof ApiClientError
          ? topologyQuery.error.message
          : he.topologyLoadError}
      </p>
    );
  }

  if (topologyQuery.isLoading) {
    return <p className="text-sm text-fg-muted">{he.topologyLoading}</p>;
  }

  if (!nodes.length) {
    return (
      <div className="ops-panel p-5" data-testid="topology-empty-assets">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.topologyKicker}</p>
        <h2 className="mt-2 text-lg font-semibold text-fg">{he.topologyTitle}</h2>
        <p className="mt-2 text-sm text-fg-muted">{he.topologyNeedAssets}</p>
      </div>
    );
  }

  if (!edges.length) {
    return (
      <div className="ops-panel p-5" data-testid="topology-empty-connections">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.topologyKicker}</p>
        <h2 className="mt-2 text-lg font-semibold text-fg">{he.topologyTitle}</h2>
        <p className="mt-2 text-sm text-fg-muted">{he.topologyNoConnections}</p>
        {canEdit ? (
          <p className="mt-3 text-sm text-fg-muted">{he.topologyAddFromAsset}</p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="ops-panel overflow-hidden p-4 sm:p-5" data-testid="site-topology">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.topologyKicker}</p>
          <h2 className="mt-1 text-lg font-semibold text-fg">{he.topologyTitle}</h2>
          <p className="mt-1 text-xs text-fg-muted">{he.topologyLead}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="min-h-11 min-w-11" onClick={fit} data-testid="topology-fit">
            {he.topologyFit}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            data-testid="topology-zoom-in"
          >
            +
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            data-testid="topology-zoom-out"
          >
            −
          </Button>
        </div>
      </div>

      <div
        className="relative h-[min(70vh,560px)] w-full overflow-hidden rounded-md border border-border bg-[color-mix(in_oklab,var(--color-bg)_92%,var(--color-fg)_8%)] touch-pan-x touch-pan-y"
        data-testid="topology-canvas"
      >
        <svg
          ref={svgRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          viewBox={`${bounds.minX} ${bounds.minY} ${viewW} ${viewH}`}
          role="img"
          aria-label={he.topologyTitle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <g transform={`translate(${pan.x / zoom}, ${pan.y / zoom}) scale(${zoom})`} style={{ transformOrigin: "center" }}>
            <defs>
              <marker
                id="topo-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-fg-muted" />
              </marker>
            </defs>

            {edges.map((e) => {
              const s = pos.get(e.source_equipment_id);
              const t = pos.get(e.target_equipment_id);
              if (!s || !t) return null;
              const x1 = s.x + NODE_W / 2;
              const y1 = s.y + NODE_H;
              const x2 = t.x + NODE_W / 2;
              const y2 = t.y;
              const midY = (y1 + y2) / 2;
              const label = [
                connectionTypeLabel(e.connection_type),
                e.source_port || e.target_port
                  ? `${e.source_port || "—"}→${e.target_port || "—"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <g key={e.id}>
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="currentColor"
                    className="text-fg-muted"
                    strokeWidth={1.75}
                    markerEnd="url(#topo-arrow)"
                    opacity={0.9}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={midY - 4}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-fg-muted"
                    fontSize={10}
                    style={{ direction: "ltr", unicodeBidi: "isolate" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {laid.map((n) => {
              const selected = selectedId === n.id;
              const ip = n.primary_ip || n.ip;
              return (
                <g
                  key={n.id}
                  data-topo-node={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openAsset(n.id);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      openAsset(n.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={n.name}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill="var(--color-bg)"
                    stroke={selected ? "var(--color-accent, #2563eb)" : "var(--color-border)"}
                    strokeWidth={selected ? 2.5 : 1.25}
                  />
                  <text
                    x={12}
                    y={22}
                    fill="currentColor"
                    className="text-fg-muted"
                    fontSize={10}
                    style={{ direction: "ltr", unicodeBidi: "isolate" }}
                  >
                    {(n.asset_code || "").slice(0, 18) || "—"}
                  </text>
                  <text x={12} y={40} fill="currentColor" className="text-fg" fontSize={12} fontWeight={600}>
                    {(n.name || "").slice(0, 18)}
                  </text>
                  <text
                    x={12}
                    y={58}
                    fill="currentColor"
                    className="text-fg-muted"
                    fontSize={10}
                    style={{ direction: "ltr", unicodeBidi: "isolate" }}
                  >
                    {[equipmentCategoryLabel(n.category).slice(0, 10), ip].filter(Boolean).join(" · ")}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
