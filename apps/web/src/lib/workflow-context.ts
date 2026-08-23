export type QuoteContextSite = { id: string; name?: string };

export type ResolvedQuoteContext = {
  customerId: string;
  siteId?: string;
  needsSiteSelection: boolean;
};

export type ProjectCreateContext = {
  quoteId?: string;
  customerId?: string;
  siteId?: string;
};

export function quoteCreateHref(opts?: { customerId?: string; siteId?: string; leadId?: string }): string {
  const params = new URLSearchParams();
  if (opts?.customerId) params.set("customerId", opts.customerId);
  if (opts?.siteId) params.set("siteId", opts.siteId);
  if (opts?.leadId) params.set("leadId", opts.leadId);
  const q = params.toString();
  return q ? `/app/quotes/new?${q}` : "/app/quotes/new";
}

export function quoteCreateSearch(opts?: { customerId?: string; siteId?: string; leadId?: string }) {
  return {
    customerId: opts?.customerId,
    siteId: opts?.siteId,
    leadId: opts?.leadId,
  };
}

export function leadDetailHref(leadId: string): string {
  return `/app/leads/${leadId}`;
}

/** Resolve customer/site pairing for a new quote (0 / 1 / many sites). */
export function resolveQuoteContext({
  customerId,
  siteId,
  sites,
}: {
  customerId: string;
  siteId?: string;
  sites: QuoteContextSite[];
}): ResolvedQuoteContext {
  if (siteId) {
    return { customerId, siteId, needsSiteSelection: false };
  }
  if (sites.length === 0) {
    return { customerId, needsSiteSelection: false };
  }
  if (sites.length === 1) {
    return { customerId, siteId: sites[0].id, needsSiteSelection: false };
  }
  return { customerId, needsSiteSelection: true };
}

export function projectCreateHref(opts?: ProjectCreateContext): string {
  const params = new URLSearchParams();
  if (opts?.quoteId) params.set("quoteId", opts.quoteId);
  if (opts?.customerId) params.set("customerId", opts.customerId);
  if (opts?.siteId) params.set("siteId", opts.siteId);
  const q = params.toString();
  return q ? `/app/projects?${q}` : "/app/projects";
}

export function projectCreateSearch(opts?: ProjectCreateContext) {
  return {
    quoteId: opts?.quoteId,
    customerId: opts?.customerId,
    siteId: opts?.siteId,
  };
}

/** Prefer quoteId as the authoritative source when creating a project from approval. */
export function resolveProjectContext(opts: ProjectCreateContext): {
  quoteId?: string;
  customerId?: string;
  siteId?: string;
  fromQuote: boolean;
} {
  if (opts.quoteId) {
    return {
      quoteId: opts.quoteId,
      customerId: opts.customerId,
      siteId: opts.siteId,
      fromQuote: true,
    };
  }
  return {
    customerId: opts.customerId,
    siteId: opts.siteId,
    fromQuote: false,
  };
}
