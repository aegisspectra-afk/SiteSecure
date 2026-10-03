import {
  Button,
  Checkbox,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Status,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@site-secure/ui";
import {
  ApiClientError,
  type CatalogAttributeField,
  type CatalogCategory,
  type CatalogProduct,
} from "@site-secure/api-client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RequirePermission } from "../../components/settings/RequirePermission";
import {
  CatalogBulkDeleteDialog,
  type BulkDeletePhase,
} from "../../components/catalog/CatalogBulkDeleteDialog";
import { CatalogImportWizard } from "../../components/catalog/CatalogImportWizard";
import { CatalogBulkPricing } from "../../components/catalog/CatalogBulkPricing";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { formatMoney } from "../../lib/quotes";
import { useSession } from "../../lib/session";

const BULK_DELETE_CHUNK = 25;

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
  /** string values; bools use "" | "true" | "false" so unknown ≠ false */
  attributes: Record<string, string>;
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
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhase, setDeletePhase] = useState<BulkDeletePhase>("confirm");
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    ok: number;
    fail: Array<{ id: string; label: string; error: string }>;
  } | null>(null);

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

  const productsQuery = useInfiniteQuery({
    queryKey: ["catalog-products", workspaceId, q, filterCategoryId],
    enabled: Boolean(workspaceId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listCatalogProducts(workspaceId!, {
        q,
        category_id: filterCategoryId || undefined,
        include_inactive: true,
        limit: 200,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  // Auto-load additional pages so search (e.g. Uniview × 300) is not capped at one page.
  const pageCount = productsQuery.data?.pages.length ?? 0;
  useEffect(() => {
    if (pageCount >= 25) return;
    if (productsQuery.hasNextPage && !productsQuery.isFetchingNextPage) {
      void productsQuery.fetchNextPage();
    }
  }, [pageCount, productsQuery.hasNextPage, productsQuery.isFetchingNextPage, productsQuery.fetchNextPage]);

  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    const out: CatalogProduct[] = [];
    for (const page of productsQuery.data?.pages ?? []) {
      for (const row of page.items) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [productsQuery.data]);

  const visible = useMemo(() => {
    return allProducts.filter((row) => {
      const active = row.active ?? row.is_active ?? true;
      if (status === "active") return active;
      if (status === "inactive") return !active;
      return true;
    });
  }, [allProducts, status]);

  useEffect(() => {
    setSelectedIds([]);
    setBulkResult(null);
  }, [q, filterCategoryId, status]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = visible.filter((row) => selectedSet.has(row.id)).length;
  const allVisibleSelected = visible.length > 0 && selectedCount === visible.length;
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected;

  function toggleOne(id: string, on: boolean) {
    setSelectedIds((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleAllVisible(on: boolean) {
    if (!on) {
      const visibleIds = new Set(visible.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of visible) next.add(row.id);
      return [...next];
    });
  }

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      setDeletePhase("running");
      setDeleteProgress({ done: 0, total: ids.length });
      setDeleteError(null);
      const fail: Array<{ id: string; label: string; error: string }> = [];
      let ok = 0;
      const deletedIds: string[] = [];
      for (let i = 0; i < ids.length; i += BULK_DELETE_CHUNK) {
        const chunk = ids.slice(i, i + BULK_DELETE_CHUNK);
        try {
          const res = await api.bulkDeleteCatalogProducts(workspaceId!, chunk);
          ok += res.deleted;
          deletedIds.push(...chunk);
        } catch (err) {
          // Fall back per-id so progress keeps moving if a chunk fails.
          for (const id of chunk) {
            try {
              await api.deleteCatalogProduct(workspaceId!, id);
              ok += 1;
              deletedIds.push(id);
            } catch (inner) {
              const row = visible.find((r) => r.id === id);
              fail.push({
                id,
                label: row?.name || row?.sku || id.slice(0, 8),
                error: inner instanceof ApiClientError ? inner.message : he.catalogError,
              });
            }
            setDeleteProgress({ done: ok + fail.length, total: ids.length });
          }
          if (!(err instanceof ApiClientError) && fail.length === 0) {
            setDeleteError(he.catalogError);
          }
          continue;
        }
        setDeleteProgress({ done: Math.min(ok + fail.length, ids.length), total: ids.length });
      }
      return { ok, fail, deletedIds };
    },
    onSuccess: (result) => {
      setDeletePhase("done");
      setDeleteProgress({ done: result.ok + result.fail.length, total: result.ok + result.fail.length });
      setBulkResult(result);
      setSelectedIds((ids) => ids.filter((id) => result.fail.some((f) => f.id === id)));
      if (editingId && result.deletedIds.includes(editingId)) {
        setEditingId(null);
        setDraft(emptyDraft);
        setFormError(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["catalog-products", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["cpq-catalog", workspaceId] });
      if (result.fail.length === 0) {
        window.setTimeout(() => {
          setDeleteOpen(false);
          setDeletePhase("confirm");
          setDeleteError(null);
        }, 900);
      }
    },
    onError: (err) => {
      setDeletePhase("confirm");
      setDeleteError(err instanceof ApiClientError ? err.message : he.catalogError);
    },
  });

  function openBulkDelete() {
    setBulkResult(null);
    setDeleteError(null);
    setDeletePhase("confirm");
    setDeleteProgress({ done: 0, total: selectedCount });
    setDeleteOpen(true);
  }

  function closeBulkDelete() {
    if (bulkDelete.isPending) return;
    setDeleteOpen(false);
    setDeletePhase("confirm");
    setDeleteError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const attrs: Record<string, unknown> = {};
      for (const field of attrSchema) {
        const raw = draft.attributes[field.key];
        if (raw == null || String(raw).trim() === "") continue;
        if (field.type === "bool") {
          if (raw === "true") attrs[field.key] = true;
          else if (raw === "false") attrs[field.key] = false;
          continue;
        }
        if (field.type === "number") {
          const n = Number(String(raw).replace(",", ""));
          if (!Number.isFinite(n)) {
            throw new ApiClientError(400, "VALIDATION_ERROR", `${field.label_he}: מספר לא תקין`);
          }
          attrs[field.key] = n;
          continue;
        }
        attrs[field.key] = String(raw).trim();
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
      if (err instanceof ApiClientError) {
        const fields = err.details?.fields;
        if (fields && typeof fields === "object") {
          const parts = Object.entries(fields as Record<string, string>).map(
            ([key, msg]) => `${key}: ${msg}`,
          );
          setFormError(parts.length ? `${err.message} — ${parts.join(" · ")}` : err.message);
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError(he.catalogError);
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
    const attrs: Record<string, string> = {};
    const rawAttrs = row.attributes && typeof row.attributes === "object" ? row.attributes : {};
    for (const [key, value] of Object.entries(rawAttrs)) {
      if (value === true) attrs[key] = "true";
      else if (value === false) attrs[key] = "false";
      else if (value == null) continue;
      else attrs[key] = String(value);
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

  async function downloadTemplate() {
    if (!workspaceId) return;
    try {
      const { blob, filename } = await api.catalogImportTemplate(workspaceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "site-secure-catalog-import-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    }
  }

  const isTrulyEmpty =
    !productsQuery.isLoading &&
    !productsQuery.isFetching &&
    allProducts.length === 0 &&
    !q &&
    !filterCategoryId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={he.catalogTitle}
        description={he.catalogLead}
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => void downloadTemplate()}>
                {he.catalogImportTemplate}
              </Button>
              <Button variant="ghost" onClick={() => setImportOpen(true)}>
                {he.catalogImport}
              </Button>
              {canViewCost ? (
                <Button variant="ghost" onClick={() => setBulkOpen((v) => !v)}>
                  {he.catalogBulkPricing}
                </Button>
              ) : null}
              <Button onClick={startCreate} disabled={editingId === "new"}>
                {he.catalogCreate}
              </Button>
            </div>
          ) : null
        }
      />

      <CatalogImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void queryClient.refetchQueries({ queryKey: ["catalog-products", workspaceId] });
          void queryClient.refetchQueries({ queryKey: ["catalog-categories", workspaceId] });
        }}
        categories={categories}
      />

      {canEdit && canViewCost ? (
        <CatalogBulkPricing
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onApplied={() => {
            void queryClient.refetchQueries({ queryKey: ["catalog-products", workspaceId] });
          }}
        />
      ) : null}

      <div className="ops-card flex flex-col gap-4 p-4">
        {isTrulyEmpty && canEdit && !editingId ? (
          <div className="flex flex-col items-start gap-3 rounded-[var(--radius-control)] border border-dashed border-border p-6">
            <div>
              <p className="text-base font-semibold text-fg">{he.catalogEmpty}</p>
              <p className="mt-1 text-sm text-fg-muted">{he.catalogEmptyBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setImportOpen(true)}>{he.catalogImport}</Button>
              <Button variant="ghost" onClick={startCreate}>
                {he.catalogAddManual}
              </Button>
              <Button variant="ghost" onClick={() => void downloadTemplate()}>
                {he.catalogImportTemplate}
              </Button>
            </div>
            <p className="text-xs text-fg-muted">{he.catalogImportGoogleHint}</p>
          </div>
        ) : null}

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
                {attrSchema.map((field) => {
                  const value = draft.attributes[field.key] ?? "";
                  const setAttr = (next: string) =>
                    setDraft((p) => ({
                      ...p,
                      attributes: { ...p.attributes, [field.key]: next },
                    }));
                  if (field.type === "bool") {
                    return (
                      <Select
                        key={field.key}
                        id={`attr-${field.key}`}
                        label={field.label_he}
                        value={value === "true" || value === "false" ? value : ""}
                        onChange={(ev) => setAttr(ev.target.value)}
                      >
                        <option value="">{he.catalogAttrUnknown}</option>
                        <option value="true">כן</option>
                        <option value="false">לא</option>
                      </Select>
                    );
                  }
                  if (field.type === "enum" && field.enum?.length) {
                    return (
                      <Select
                        key={field.key}
                        id={`attr-${field.key}`}
                        label={field.label_he}
                        value={value}
                        onChange={(ev) => setAttr(ev.target.value)}
                      >
                        <option value="">{he.catalogAttrUnknown}</option>
                        {field.enum.map((opt) => (
                          <option key={opt} value={opt}>
                            {field.enum_labels_he?.[opt] ?? opt}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  return (
                    <Input
                      key={field.key}
                      id={`attr-${field.key}`}
                      label={field.label_he}
                      type={field.type === "number" ? "number" : "text"}
                      inputMode={field.type === "number" ? "decimal" : undefined}
                      value={value}
                      onChange={(ev) => setAttr(ev.target.value)}
                    />
                  );
                })}
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

        {canEdit && selectedCount > 0 ? (
          <div className="admin-bulk-bar" role="region" aria-label={he.catalogBulkSelected.replace("{count}", String(selectedCount))}>
            <p className="text-sm text-fg">
              {he.catalogBulkSelected.replace("{count}", String(selectedCount))}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setSelectedIds([])} disabled={bulkDelete.isPending}>
                {he.catalogBulkClear}
              </Button>
              <Button variant="danger" disabled={bulkDelete.isPending} onClick={openBulkDelete}>
                {he.catalogBulkDelete}
              </Button>
            </div>
          </div>
        ) : null}

        <CatalogBulkDeleteDialog
          open={deleteOpen}
          phase={deletePhase}
          count={selectedCount || deleteProgress.total}
          done={deleteProgress.done}
          total={deleteProgress.total || selectedCount}
          error={deleteError}
          onClose={closeBulkDelete}
          onConfirm={() => {
            const ids = visible.filter((row) => selectedSet.has(row.id)).map((row) => row.id);
            if (!ids.length) {
              closeBulkDelete();
              return;
            }
            bulkDelete.mutate(ids);
          }}
        />

        {bulkResult && bulkResult.fail.length ? (
          <div className="rounded-[var(--radius-panel)] border border-border px-3 py-2 text-sm" role="status">
            <p className="text-fg">
              {he.catalogBulkResultOk.replace("{count}", String(bulkResult.ok))}
            </p>
            <div className="mt-2 text-fg-muted">
              <p>{he.catalogBulkResultFail.replace("{count}", String(bulkResult.fail.length))}</p>
              <ul className="mt-1 list-inside list-disc">
                {bulkResult.fail.slice(0, 8).map((f) => (
                  <li key={f.id}>
                    {f.label}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {productsQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!productsQuery.isLoading && visible.length === 0 ? (
          <p className="text-sm text-fg-muted">{editingId ? he.catalogEmpty : `${he.catalogEmpty}. ${he.catalogEmptyBody}`}</p>
        ) : null}
        {visible.length > 0 ? (
          <p className="text-xs text-fg-muted">
            {he.catalogShowingCount.replace("{count}", String(visible.length))}
            {productsQuery.isFetchingNextPage ? ` · ${he.catalogLoadingMore}` : null}
          </p>
        ) : null}
        {visible.length > 0 ? (
          <Table>
            <THead>
              <TR>
                {canEdit ? (
                  <TH className="w-10">
                    <SelectAllCheckbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={toggleAllVisible}
                    />
                  </TH>
                ) : null}
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
                const selected = selectedSet.has(row.id);
                return (
                  <TR key={row.id} className={selected ? "is-selected" : undefined}>
                    {canEdit ? (
                      <TD>
                        <Checkbox
                          hideLabel
                          label={he.catalogSelectRow.replace("{name}", row.name)}
                          checked={selected}
                          disabled={bulkDelete.isPending}
                          onChange={(event) => toggleOne(row.id, event.target.checked)}
                        />
                      </TD>
                    ) : null}
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
                        <Button variant="ghost" onClick={() => startEdit(row)} disabled={bulkDelete.isPending}>
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
        {productsQuery.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              loading={productsQuery.isFetchingNextPage}
              onClick={() => void productsQuery.fetchNextPage()}
            >
              {he.catalogLoadMore}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center">
      <input
        ref={ref}
        type="checkbox"
        className="size-4 rounded-[3px] border-border text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        checked={checked}
        aria-label={he.catalogSelectAll}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
