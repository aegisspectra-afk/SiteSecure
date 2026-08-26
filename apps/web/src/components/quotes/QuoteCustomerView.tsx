import type { PublicQuote } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { QuoteDocument } from "./document/QuoteDocument";

/** @deprecated Prefer QuoteDocument — kept as thin wrapper for existing imports/tests. */
export function QuoteCustomerView({
  quote,
  actions,
}: {
  quote: PublicQuote;
  actions?: ReactNode;
}) {
  return <QuoteDocument quote={quote} actions={actions} />;
}
