import { useNavigate } from "@tanstack/react-router";
import { FileText, User } from "lucide-react";
import { he } from "../../i18n/he";
import { quoteCreateSearch } from "../../lib/workflow-context";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";

export function NextActionDialog({
  open,
  onClose,
  title,
  body,
  customerId,
  siteId,
  customerHref,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  customerId: string;
  siteId?: string;
  customerHref?: string;
}) {
  const navigate = useNavigate();

  function createQuote() {
    onClose();
    void navigate({
      to: "/app/quotes/new",
      search: quoteCreateSearch({ customerId, siteId }),
    });
  }

  function viewCustomer() {
    onClose();
    void navigate({
      to: customerHref ?? "/app/customers/$customerId",
      params: { customerId },
    });
  }

  return (
    <QuoteFlowSheet open={open} onClose={onClose} title={title} subtitle={body}>
      <div className="flex flex-col gap-2.5">
        <button type="button" className="quote-flow-action is-recommended" data-autofocus onClick={createQuote}>
          <span className="quote-flow-action-icon" aria-hidden>
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-start">
            <span className="block text-sm font-semibold text-fg">{he.workflowCreateQuote}</span>
            <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowCreateQuoteHint}</span>
          </span>
        </button>
        <button type="button" className="quote-flow-action is-muted" onClick={viewCustomer}>
          <span className="quote-flow-action-icon is-muted" aria-hidden>
            <User className="size-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 text-start">
            <span className="block text-sm font-semibold text-fg">{he.workflowViewCustomer}</span>
            <span className="mt-0.5 block text-xs text-fg-muted">{he.workflowViewCustomerHint}</span>
          </span>
        </button>
      </div>
    </QuoteFlowSheet>
  );
}
