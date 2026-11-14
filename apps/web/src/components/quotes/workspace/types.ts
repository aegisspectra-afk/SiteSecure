export type QuoteWorkspaceStep = "details" | "items" | "pricing" | "review";

export const QUOTE_WORKSPACE_STEPS: QuoteWorkspaceStep[] = ["details", "items", "pricing", "review"];

export function quoteWorkspaceStepIndex(step: QuoteWorkspaceStep): number {
  return QUOTE_WORKSPACE_STEPS.indexOf(step);
}

export function adjacentQuoteWorkspaceStep(
  step: QuoteWorkspaceStep,
  direction: -1 | 1,
): QuoteWorkspaceStep | null {
  const next = quoteWorkspaceStepIndex(step) + direction;
  if (next < 0 || next >= QUOTE_WORKSPACE_STEPS.length) return null;
  return QUOTE_WORKSPACE_STEPS[next] ?? null;
}

export function initialQuoteWorkspaceStep(
  itemCount: number,
  context?: { customerId?: string | null; siteId?: string | null },
): QuoteWorkspaceStep {
  // Customer and site already known (e.g. from the URL): step 1 has nothing left to ask.
  if (itemCount > 0 || (context?.customerId && context?.siteId)) return "items";
  return "details";
}
