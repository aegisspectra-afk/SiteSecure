import {
  ApiClientError,
  type AssetConnectionOut,
  type EquipmentOut,
} from "@site-secure/api-client";
import { Button, Input, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { equipmentCategoryLabel } from "../../lib/site-assets";
import { useSession } from "../../lib/session";

const CONNECTION_TYPES = ["ethernet", "fiber", "poe", "wireless", "uplink", "wan", "other"] as const;

function connectionTypeLabel(type: string): string {
  return he.connectionTypes[type as keyof typeof he.connectionTypes] ?? type;
}

function peerOf(row: AssetConnectionOut, assetId: string): {
  id: string;
  name?: string | null;
  code?: string | null;
  category?: string | null;
  ip?: string | null;
  direction: "out" | "in";
} {
  if (row.source_equipment_id === assetId) {
    return {
      id: row.target_equipment_id,
      name: row.target_name,
      code: row.target_asset_code,
      category: row.target_category,
      ip: row.target_ip,
      direction: "out",
    };
  }
  return {
    id: row.source_equipment_id,
    name: row.source_name,
    code: row.source_asset_code,
    category: row.source_category,
    ip: row.source_ip,
    direction: "in",
  };
}

export function AssetConnectionsSection({
  siteId,
  assetId,
  canEdit,
}: {
  siteId: string;
  assetId: string;
  canEdit: boolean;
}) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOutgoing, setEditingOutgoing] = useState(true);

  const [targetId, setTargetId] = useState("");
  const [connectionType, setConnectionType] = useState<string>("ethernet");
  const [sourcePort, setSourcePort] = useState("");
  const [targetPort, setTargetPort] = useState("");
  const [notes, setNotes] = useState("");

  const connectionsQuery = useQuery({
    queryKey: ["equipment-connections", workspaceId, assetId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listEquipmentAssetConnections(workspaceId!, assetId),
  });

  const siteEquipmentQuery = useQuery({
    queryKey: ["site-equipment", workspaceId, siteId],
    enabled: Boolean(workspaceId && (showForm || editingId)),
    queryFn: () => api.listEquipment(workspaceId!, siteId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["equipment-connections", workspaceId, assetId] });
    void queryClient.invalidateQueries({ queryKey: ["site-topology", workspaceId, siteId] });
    void queryClient.invalidateQueries({ queryKey: ["site-connections", workspaceId, siteId] });
  };

  const resetForm = () => {
    setTargetId("");
    setConnectionType("ethernet");
    setSourcePort("");
    setTargetPort("");
    setNotes("");
    setEditingId(null);
    setEditingOutgoing(true);
    setShowForm(false);
    setError(null);
  };

  const create = useMutation({
    mutationFn: () =>
      api.createAssetConnection(workspaceId!, {
        site_id: siteId,
        source_equipment_id: assetId,
        target_equipment_id: targetId,
        connection_type: connectionType,
        source_port: sourcePort.trim() || null,
        target_port: targetPort.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      resetForm();
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.connectionError),
  });

  const patch = useMutation({
    mutationFn: () =>
      api.patchAssetConnection(workspaceId!, editingId!, {
        ...(editingOutgoing && targetId ? { target_equipment_id: targetId } : {}),
        connection_type: connectionType,
        source_port: sourcePort.trim() || null,
        target_port: targetPort.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      resetForm();
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.connectionError),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAssetConnection(workspaceId!, id),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.connectionError),
  });

  const items: AssetConnectionOut[] = connectionsQuery.data?.items ?? [];
  const siteEquipment: EquipmentOut[] = siteEquipmentQuery.data?.items ?? [];
  const targets = useMemo(
    () => siteEquipment.filter((row) => row.id !== assetId),
    [siteEquipment, assetId],
  );

  const openEdit = (row: AssetConnectionOut) => {
    const outgoing = row.source_equipment_id === assetId;
    setEditingId(row.id);
    setEditingOutgoing(outgoing);
    setShowForm(true);
    setTargetId(outgoing ? row.target_equipment_id : row.source_equipment_id);
    setConnectionType(row.connection_type || "ethernet");
    setSourcePort(row.source_port || "");
    setTargetPort(row.target_port || "");
    setNotes(row.notes || "");
    setError(null);
  };

  return (
    <div className="space-y-3" data-testid="asset-connections">
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {items.length ? (
        <ul className="divide-y divide-border border-y border-border" data-testid="asset-connections-list">
          {items.map((row) => {
            const peer = peerOf(row, assetId);
            const ports = [row.source_port, row.target_port].filter(Boolean).join(" → ");
            return (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-muted">
                    {peer.direction === "out" ? he.connectionConnectedTo : he.connectionConnectedFrom}
                  </p>
                  <Link
                    to="/app/sites/$siteId/assets/$assetId"
                    params={{ siteId, assetId: peer.id }}
                    className="mt-0.5 block font-medium text-fg hover:underline"
                  >
                    <span className="public-mono text-xs text-fg-muted" dir="ltr">
                      {peer.code || "—"}
                    </span>
                    <span className="ms-2">{peer.name || peer.id}</span>
                  </Link>
                  <p className="mt-1 text-xs text-fg-muted">
                    {[
                      connectionTypeLabel(row.connection_type),
                      peer.category ? equipmentCategoryLabel(peer.category) : null,
                      peer.ip,
                      ports || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {row.notes ? <p className="mt-1 text-xs text-fg-muted">{row.notes}</p> : null}
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => openEdit(row)}
                      data-testid={`connection-edit-${row.id}`}
                    >
                      {he.assetEdit}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(row.id)}
                      data-testid={`connection-delete-${row.id}`}
                    >
                      {he.connectionDelete}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted" data-testid="asset-connections-empty">
          {he.connectionEmpty}
        </p>
      )}

      {canEdit && !showForm ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setError(null);
          }}
          data-testid="connection-add-open"
        >
          {he.connectionAdd}
        </Button>
      ) : null}

      {canEdit && showForm ? (
        <form
          className="space-y-3 rounded-md border border-border p-4"
          data-testid="connection-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingId) patch.mutate();
            else create.mutate();
          }}
        >
          <p className="text-sm font-semibold text-fg">
            {editingId ? he.connectionEdit : he.connectionAdd}
          </p>
          <Select
            id="connection-target"
            label={he.connectionTarget}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required={!editingId || editingOutgoing}
            disabled={Boolean(editingId && !editingOutgoing)}
          >
            <option value="">{he.connectionPickAsset}</option>
            {targets.map((row) => (
              <option key={row.id} value={row.id}>
                {[row.asset_code, row.name, equipmentCategoryLabel(row.category), row.ip]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </Select>
          <Select
            id="connection-type"
            label={he.connectionType}
            value={connectionType}
            onChange={(e) => setConnectionType(e.target.value)}
          >
            {CONNECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {connectionTypeLabel(t)}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="connection-source-port"
              label={he.connectionSourcePort}
              value={sourcePort}
              onChange={(e) => setSourcePort(e.target.value)}
              placeholder="eth0 / 24"
            />
            <Input
              id="connection-target-port"
              label={he.connectionTargetPort}
              value={targetPort}
              onChange={(e) => setTargetPort(e.target.value)}
              placeholder="1 / 12"
            />
          </div>
          <Input
            id="connection-notes"
            label={he.connectionNotes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="min-h-11"
              loading={create.isPending || patch.isPending}
              disabled={!targetId}
              data-testid="connection-save"
            >
              {he.save}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={resetForm}>
              {he.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
