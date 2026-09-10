import { Button, ErrorState } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QuotesWorkspace } from "../../../components/quotes/QuotesWorkspace";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { listQuotesFilter, type QuoteTab } from "../../../lib/quote-workspace";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/")({
  validateSearch: (search: Record<string, unknown>): { tab?: QuoteTab } => {
    const tab = typeof search.tab === "string" ? search.tab : undefined;
    const allowed = new Set(["all", "draft", "open", "approved", "rejected", "expired"]);
    if (tab && allowed.has(tab) && tab !== "all") return { tab: tab as QuoteTab };
    return {};
  },
  component: QuotesPage,
});

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function QuotesPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuotesBody />
    </RequirePermission>
  );
}

function QuotesBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "quotes.create", features);
  const canDelete = can(membership?.role_key, "quotes.delete", features);
  const canViewCost = can(membership?.role_key, "quotes.view_cost", features);
  const routeSearch = Route.useSearch();
  const [tab, setTab] = useState<QuoteTab>(routeSearch.tab ?? "all");
  const [query, setQuery] = useState("");
  const debouncedSearch = useDebouncedValue(query, 350);
  const listFilter = listQuotesFilter(tab);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (routeSearch.tab) setTab(routeSearch.tab);
  }, [routeSearch.tab]);

  const onTab = (next: QuoteTab) => {
    setTab(next);
    void navigate({
      to: "/app/quotes",
      search: next === "all" ? {} : { tab: next },
      replace: true,
    });
  };

  const quotesQuery = useInfiniteQuery({
    queryKey: [
      "quotes",
      workspaceId,
      debouncedSearch,
      listFilter.status ?? null,
      listFilter.exclude_status ?? null,
    ],
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listQuotes(workspaceId!, {
        q: debouncedSearch,
        status: listFilter.status,
        exclude_status: listFilter.exclude_status,
        limit: 50,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!workspaceId || !ids.length) return { deleted: 0, failed: 0 };
      const results = await Promise.allSettled(ids.map((id) => api.deleteQuote(workspaceId, id)));
      let deleted = 0;
      let failed = 0;
      const deletedIds: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          deleted += 1;
          deletedIds.push(ids[index]!);
          return;
        }
        const err = result.reason;
        if (err instanceof ApiClientError && err.code === "RESOURCE_STATE") return;
        failed += 1;
      });
      if (deletedIds.length) {
        queryClient.setQueriesData({ queryKey: ["quotes", workspaceId] }, (prev: unknown) => {
          if (!prev || typeof prev !== "object" || !("pages" in prev)) return prev;
          const pages = (prev as { pages: Array<{ items: Array<{ id: string }> }> }).pages.map((page) => ({
            ...page,
            items: page.items.filter((row) => !deletedIds.includes(row.id)),
          }));
          return { ...(prev as object), pages };
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      if (failed) throw new Error("delete-failed");
      if (!deleted && ids.length) throw new Error("delete-blocked");
      return { deleted, failed };
    },
  });
  const duplicate = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!workspaceId) return [];
      const unique = [...new Set(ids)];
      const created: Awaited<ReturnType<typeof api.duplicateQuote>>[] = [];
      for (const id of unique) {
        const row = await api.duplicateQuote(workspaceId, id);
        created.push(row);
      }
      return created;
    },
    onSuccess: async (created) => {
      if (!workspaceId || !created.length) return;
      queryClient.setQueriesData({ queryKey: ["quotes", workspaceId] }, (prev: unknown) => {
        if (!prev || typeof prev !== "object" || !("pages" in prev)) return prev;
        const pages = (prev as { pages: Array<{ items: unknown[] }> }).pages.map((page, index) => {
          if (index !== 0) return page;
          return { ...page, items: [...created, ...page.items] };
        });
        return { ...(prev as object), pages };
      });
      await queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      if (created.length === 1) {
        void navigate({ to: "/app/quotes/$quoteId", params: { quoteId: created[0]!.id } });
      }
    },
  });
  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (quotesQuery.isError) {
    return (
      <ErrorState
        title={he.quotesError}
        action={
          <Button variant="secondary" onClick={() => void quotesQuery.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const quotes = quotesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = quotesQuery.data?.pages[0]?.counts ?? null;

  return (
    <QuotesWorkspace
      quotes={quotes}
      counts={counts}
      search={query}
      tab={tab}
      canCreate={canCreate}
      canDelete={canDelete}
      canViewCost={canViewCost}
      loading={quotesQuery.isLoading}
      busy={remove.isPending || duplicate.isPending || quotesQuery.isFetchingNextPage}
      hasMore={Boolean(quotesQuery.hasNextPage)}
      onSearch={setQuery}
      onTab={onTab}
      onOpenQuote={(quoteId) =>
        void navigate({ to: "/app/quotes/$quoteId", params: { quoteId } })
      }
      onPreviewQuote={(quoteId) =>
        void navigate({ to: "/app/quotes/$quoteId/preview", params: { quoteId } })
      }
      onLoadMore={() => void quotesQuery.fetchNextPage()}
      onDelete={canDelete ? (ids) => remove.mutateAsync(ids).then(() => undefined) : undefined}
      onDuplicate={canCreate ? (ids) => duplicate.mutateAsync(ids).then(() => undefined) : undefined}
    />
  );
}
