import { Button, ErrorState, Input, PageHeader, Select, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import {
  ApiClientError,
  type CatalogAttributeField,
  type CatalogCategory,
  type CatalogProduct,
} from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { RequirePermission } from "../../components/settings/RequirePermission";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { formatMoney } from "../../lib/quotes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/catalog")({
  component: CatalogPage,
});

type Draft = {
  name: string;
  sku: string;
  kind: string;
  unit: string;
  list_price: string;
  cost: string;
  description: string;
  manufacturer: string;
  model: string;
  root_id: string;
  category_id: string;
  is_active: boolean;
  attributes: Record<string, string | boolean>;
};

const emptyDraft: Draft = {
  name: "",
  sku: "",
  kind: "product",
  unit: "unit",
  list_price: "",
  cost: "",
  description: "",
  manufacturer: "",
  model: "",
  root_id: "",
  category_id: "",
  is_active: true,
  attributes: {},
};

const UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "unit", label: he.catalogUnitUnit },
  { value: "m", label: he.catalogUnitM },
  { value: "roll", label: he.catalogUnitRoll },
  { value: "hour", label: he.catalogUnitHour },
  { value: "job", label: he.catalogUnitJob },
  { value: "pack", label: he.catalogUnitPack },
];

function CatalogPage() {
  return (
    <RequirePermission permission="catalog.view">
      <CatalogBody />
    </RequirePermission>
  );
}

function CatalogBody() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "catalog.edit", features);
  const canViewCost = can(membership?.role_key, "quotes.view_cost", features);
  const [q, setQ] = useState("");
  const [filterRootId, setFilterRootId] = useState("");
  const [filterLeafId, setFilterLeafId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["catalog-categories", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listCatalogCategories(workspaceId!),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const roots = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [categories],
  );
  const leavesByParent = useMemo(() => {
    const map = new Map<string, CatalogCategory[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      const list = map.get(c.parent_id) ?? [];
      list.push(c);
      map.set(c.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return map;
  }, [categories]);

  const filterCategoryId = filterLeafId || filterRootId;
  const draftLeaves = draft.root_id ? leavesByParent.get(draft.root_id) ?? [] : [];
  const selectedLeaf = categories.find((c) => c.id === draft.category_id);
  const attrSchema: CatalogAttributeField[] = selectedLeaf?.attribute_schema ?? [];

  const productsQuery = useQuery({
    queryKey: ["catalog-products", workspaceId, q, filterCategoryId],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listCatalogProducts(workspaceId!, {
        q,
        category_id: filterCategoryId || undefined,
        include_inactive: true,
        limit: 100,
      }),
  });

  const visible = useMemo(() => {
    const rows = productsQuery.data?.items ?? [];
    return rows.filter((row) => {
      const active = row.active ?? row.is_active ?? true;
      if (status === "active") return active;
      if (status === "inactive") return !active;
      return true;
    });
  }, [productsQuery.data, status]);

  const save = useMutation({
    mutationFn: async () => {
      const attrs: Record<string, unknown> = {};
      for (const field of attrSchema) {
        const raw = draft.attributes[field.key];
        if (field.type === "bool") {
          attrs[field.key] = Boolean(raw);
        } else if (raw != null && String(raw).trim() !== "") {
          attrs[field.key] = String(raw).trim();
        }
      }
      const body = {
        name: draft.name.trim(),
        sku: draft.sku.trim() || undefined,
        kind: draft.kind,
        unit: draft.unit,
        description: draft.description.trim() || undefined,
        manufacturer: draft.manufacturer.trim() || null,
        model: draft.model.trim() || null,
        list_price: Number(draft.list_price) || 0,
        cost: canViewCost && draft.cost.trim() !== "" ? Number(draft.cost) : undefined,
        category_id: draft.category_id || undefined,
        is_active: draft.is_active,
        attributes: attrs,
      };
      if (editingId && editingId !== "new") {
        return api.patchCatalogProduct(workspaceId!, editingId, body);
      }
      return api.createCatalogProduct(workspaceId!, body);
    },
    onSuccess: () => {
      setEditingId(null);
      setDraft(emptyDraft);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["catalog-products", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["cpq-catalog", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.catalogError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.catalogError} />;
  if (productsQuery.isError) return <ErrorState title={he.catalogError} />;

  function startCreate() {
    setEditingId("new");
    setDraft(emptyDraft);
    setFormError(null);
  }

  function startEdit(row: CatalogProduct) {
    const leaf = categories.find((c) => c.id === row.category_id);
    const rootId = leaf?.parent_id ?? "";
    const attrs: Record<string, string | boolean> = {};
    const rawAttrs = row.attributes && typeof row.attributes === "object" ? row.attributes : {};
    for (const [key, value] of Object.entries(rawAttrs)) {
      attrs[key] = typeof value === "boolean" ? value : String(value ?? "");
    }
    setEditingId(row.id);
    setDraft({
      name: row.name,
      sku: row.sku ?? "",
      kind: row.kind || "product",
      unit: row.unit || "unit",
      list_price: String(row.selling_price ?? row.list_price ?? 0),
      cost: row.cost != null ? String(row.cost) : "",
      description: row.description ?? "",
      manufacturer: row.manufacturer ?? "",
      model: row.model ?? "",
      root_id: rootId || "",
      category_id: row.category_id ?? "",
      is_active: row.active ?? row.is_active ?? true,
      attributes: attrs,
    });
    setFormError(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    save.mutate();
  }

  function setRoot(rootId: string) {
    setDraft((p) => ({
      ...p,
      root_id: rootId,
      category_id: "",
      attributes: {},
    }));
  }

  function setLeaf(leafId: string) {
    setDraft((p) => ({
      ...p,
      category_id: leafId,
      attributes: {},
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={he.catalogTitle}
        description={he.catalogLead}
        action={
          canEdit ? (
            <Button onClick={startCreate} disabled={editingId === "new"}>
              {he.catalogCreate}
            </Button>
          ) : null
        }
      />

      <div className="ops-card flex flex-col gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input id="catalog-search" label={he.catalogSearch} value={q} onChange={(ev) => setQ(ev.target.value)} />
          <Select
            id="catalog-filter-root"
            label={he.catalogCategoryRoot}
            value={filterRootId}
            onChange={(ev) => {
              setFilterRootId(ev.target.value);
              setFilterLeafId("");
            }}
          >
            <option value="">{he.catalogCategoryAll}</option>
            {roots.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name_he}
              </option>
            ))}
          </Select>
          <Select
            id="catalog-filter-leaf"
            label={he.catalogCategorySub}
            value={filterLeafId}
            onChange={(ev) => setFilterLeafId(ev.target.value)}
            disabled={!filterRootId}
          >
            <option value="">{he.catalogCategoryAll}</option>
            {(filterRootId ? leavesByParent.get(filterRootId) ?? [] : []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.name_he}
              </option>
            ))}
          </Select>
          <Select id="catalog-status" label={he.catalogStatus} value={status} onChange={(ev) => setStatus(ev.target.value as typeof status)}>
            <option value="all">{he.catalogStatusAll}</option>
            <option value="active">{he.catalogStatusActive}</option>
            <option value="inactive">{he.catalogStatusInactive}</option>
          </Select>
        </div>

        {editingId && canEdit ? (
          <form className="grid gap-3 rounded-[var(--radius-control)] border border-border p-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Input id="product-name" label={he.catalogName} value={draft.name} onChange={(ev) => setDraft((p) => ({ ...p, name: ev.target.value }))} />
            <Input id="product-sku" label={he.catalogSku} value={draft.sku} onChange={(ev) => setDraft((p) => ({ ...p, sku: ev.target.value }))} />
            <Input
              id="product-manufacturer"
              label={he.catalogManufacturer}
              value={draft.manufacturer}
              onChange={(ev) => setDraft((p) => ({ ...p, manufacturer: ev.target.value }))}
            />
            <Input id="product-model" label={he.catalogModel} value={draft.model} onChange={(ev) => setDraft((p) => ({ ...p, model: ev.target.value }))} />
            <Select id="product-kind" label={he.catalogKind} value={draft.kind} onChange={(ev) => setDraft((p) => ({ ...p, kind: ev.target.value }))}>
              <option value="product">{he.quoteKindProduct}</option>
              <option value="service">{he.quoteKindService}</option>
              <option value="bundle">{he.quoteKindBundle}</option>
            </Select>
            <Select id="product-unit" label={he.catalogUnit} value={draft.unit} onChange={(ev) => setDraft((p) => ({ ...p, unit: ev.target.value }))}>
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select id="product-root" label={he.catalogCategoryRoot} value={draft.root_id} onChange={(ev) => setRoot(ev.target.value)}>
              <option value="">{he.catalogCategoryAll}</option>
              {roots.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name_he}
                </option>
              ))}
            </Select>
            <Select
              id="product-leaf"
              label={he.catalogCategorySub}
              value={draft.category_id}
              onChange={(ev) => setLeaf(ev.target.value)}
              disabled={!draft.root_id}
            >
              <option value="">{he.catalogCategoryAll}</option>
              {draftLeaves.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name_he}
                </option>
              ))}
            </Select>
            <Input id="product-price" label={he.catalogPrice} value={draft.list_price} onChange={(ev) => setDraft((p) => ({ ...p, list_price: ev.target.value }))} />
            {canViewCost ? (
              <Input id="product-cost" label={he.catalogCost} value={draft.cost} onChange={(ev) => setDraft((p) => ({ ...p, cost: ev.target.value }))} />
            ) : null}
            <Select
              id="product-active"
              label={he.catalogStatus}
              value={draft.is_active ? "active" : "inactive"}
              onChange={(ev) => setDraft((p) => ({ ...p, is_active: ev.target.value === "active" }))}
            >
              <option value="active">{he.catalogStatusActive}</option>
              <option value="inactive">{he.catalogStatusInactive}</option>
            </Select>
            <Input
              id="product-description"
              label={he.catalogDescription}
              className="md:col-span-2"
              value={draft.description}
              onChange={(ev) => setDraft((p) => ({ ...p, description: ev.target.value }))}
            />
            {attrSchema.length ? (
              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <p className="text-sm font-medium text-fg md:col-span-2">{he.catalogAttributes}</p>
                {attrSchema.map((field) =>
                  field.type === "bool" ? (
                    <Select
                      key={field.key}
                      id={`attr-${field.key}`}
                      label={field.label_he}
                      value={draft.attributes[field.key] ? "yes" : "no"}
                      onChange={(ev) =>
                        setDraft((p) => ({
                          ...p,
                          attributes: { ...p.attributes, [field.key]: ev.target.value === "yes" },
                        }))
                      }
                    >
                      <option value="no">לא</option>
                      <option value="yes">כן</option>
                    </Select>
                  ) : (
                    <Input
                      key={field.key}
                      id={`attr-${field.key}`}
                      label={field.label_he}
                      value={String(draft.attributes[field.key] ?? "")}
                      onChange={(ev) =>
                        setDraft((p) => ({
                          ...p,
                          attributes: { ...p.attributes, [field.key]: ev.target.value },
                        }))
                      }
                    />
                  ),
                )}
              </div>
            ) : null}
            {formError ? <p className="text-sm text-danger md:col-span-2">{formError}</p> : null}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" loading={save.isPending} disabled={!draft.name.trim()}>
                {he.catalogSave}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                  setFormError(null);
                }}
              >
                {he.catalogCancel}
              </Button>
            </div>
          </form>
        ) : null}

        {productsQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!productsQuery.isLoading && visible.length === 0 ? (
          <p className="text-sm text-fg-muted">{editingId ? he.catalogEmpty : `${he.catalogEmpty}. ${he.catalogEmptyBody}`}</p>
        ) : null}
        {visible.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>{he.catalogSku}</TH>
                <TH>{he.catalogName}</TH>
                <TH>{he.catalogManufacturer}</TH>
                <TH>{he.catalogCategory}</TH>
                <TH>{he.catalogPrice}</TH>
                {canViewCost ? <TH>{he.catalogCost}</TH> : null}
                <TH>{he.catalogStatus}</TH>
                {canEdit ? <TH>{he.catalogEdit}</TH> : null}
              </TR>
            </THead>
            <TBody>
              {visible.map((row) => {
                const active = row.active ?? row.is_active ?? true;
                return (
                  <TR key={row.id}>
                    <TD className="public-mono text-xs">{row.sku || "—"}</TD>
                    <TD className="font-medium">{row.name}</TD>
                    <TD>{row.manufacturer || "—"}</TD>
                    <TD>{row.category_path || "—"}</TD>
                    <TD>{formatMoney(row.selling_price ?? row.list_price)}</TD>
                    {canViewCost ? <TD>{row.cost != null ? formatMoney(row.cost) : "—"}</TD> : null}
                    <TD>
                      <Status
                        label={active ? he.catalogStatusActive : he.catalogStatusInactive}
                        tone={active ? "success" : "neutral"}
                      />
                    </TD>
                    {canEdit ? (
                      <TD>
                        <Button variant="ghost" onClick={() => startEdit(row)}>
                          {he.catalogEdit}
                        </Button>
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : null}
      </div>
    </div>
  );
}
