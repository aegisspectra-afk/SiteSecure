import { Button, ErrorState } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QuotesWorkspace } from "../../../components/quotes/QuotesWorkspace";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { listStatusParam, type QuoteTab } from "../../../lib/quote-workspace";
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
  const status = listStatusParam(tab);
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
    queryKey: ["quotes", workspaceId, debouncedSearch, status ?? "any"],
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listQuotes(workspaceId!, {
        q: debouncedSearch,
        status,
        limit: 50,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!workspaceId) return;
      let failed = 0;
      for (const id of ids) {
        try {
          await api.deleteQuote(workspaceId, id);
        } catch (err) {
          if (err instanceof ApiClientError && err.code === "RESOURCE_STATE") continue;
          failed += 1;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      if (failed) throw new Error("delete-failed");
    },
  });
  const duplicate = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!workspaceId) return [];
      const created: string[] = [];
      for (const id of ids) {
        const row = await api.duplicateQuote(workspaceId, id);
        created.push(row.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      return created;
    },
    onSuccess: (created) => {
      if (created.length === 1) {
        void navigate({ to: "/app/quotes/$quoteId", params: { quoteId: created[0] } });
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
      onDelete={canDelete ? (ids) => remove.mutateAsync(ids) : undefined}
      onDuplicate={canCreate ? (ids) => duplicate.mutateAsync(ids).then(() => undefined) : undefined}
    />
  );
}
