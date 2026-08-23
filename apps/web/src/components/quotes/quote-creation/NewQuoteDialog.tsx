import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { he } from "../../../i18n/he";
import { quoteCreateSearch, resolveQuoteContext } from "../../../lib/workflow-context";
import { NextActionDialog } from "../../workflow/NextActionDialog";
import { CustomerCreateFlow } from "./CustomerCreateFlow";
import { CustomerSelector, SiteSelector } from "./CustomerSelector";
import { QuoteFlowSheet } from "./QuoteFlowSheet";
import { QuoteStartOptions } from "./QuoteStartOptions";

type Step = "menu" | "existing" | "create" | "pickSite";

export function NewQuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("menu");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [sites, setSites] = useState<
    { id: string; name?: string; address?: Record<string, unknown>; status?: string }[]
  >([]);
  const [nextAction, setNextAction] = useState<{ customerId: string; siteId?: string } | null>(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("menu");
      setSelectedCustomerId("");
      setSelectedCustomerName("");
      setSites([]);
      setNextAction(null);
      setNavigating(false);
    }
  }, [open]);

  function closeAll() {
    setNextAction(null);
    onClose();
  }

  function goToQuote(customerId?: string, siteId?: string) {
    setNavigating(true);
    closeAll();
    void navigate({
      to: "/app/quotes/new",
      search: quoteCreateSearch({ customerId, siteId }),
    });
  }

  function pickCustomer(customer: {
    id: string;
    name: string;
    sites: { id: string; name?: string; address?: Record<string, unknown>; status?: string }[];
  }) {
    const resolved = resolveQuoteContext({ customerId: customer.id, sites: customer.sites });
    if (resolved.needsSiteSelection) {
      setSelectedCustomerId(customer.id);
      setSelectedCustomerName(customer.name);
      setSites(customer.sites);
      setStep("pickSite");
      return;
    }
    goToQuote(resolved.customerId, resolved.siteId);
  }

  const title =
    step === "existing"
      ? he.workflowSelectCustomer
      : step === "create"
        ? he.workflowNewCustomer
        : step === "pickSite"
          ? he.workflowPickSiteQuestion
          : he.workflowCreateQuoteTitle;

  const subtitle =
    step === "menu"
      ? he.workflowHowToStart
      : step === "existing"
        ? undefined
        : step === "pickSite"
          ? he.workflowPickSiteFor(selectedCustomerName || he.navCustomers)
          : he.workflowNewCustomerLead;

  return (
    <>
      <QuoteFlowSheet open={open && !nextAction} onClose={closeAll} title={title} subtitle={subtitle}>
        {step === "menu" ? (
          <QuoteStartOptions
            onExisting={() => setStep("existing")}
            onCreate={() => setStep("create")}
            onSkip={() => goToQuote()}
          />
        ) : null}

        {step === "existing" ? (
          <CustomerSelector
            onPick={pickCustomer}
            onBack={() => setStep("menu")}
            onCreateNew={() => setStep("create")}
          />
        ) : null}

        {step === "create" ? (
          <CustomerCreateFlow
            onCreated={(customer) => {
              setNextAction({ customerId: customer.id });
              setStep("menu");
            }}
            onBack={() => setStep("menu")}
          />
        ) : null}

        {step === "pickSite" ? (
          <SiteSelector
            customerName={selectedCustomerName}
            sites={sites}
            onPick={(siteId) => goToQuote(selectedCustomerId, siteId)}
            onBack={() => setStep("existing")}
          />
        ) : null}

        {navigating ? (
          <p className="sr-only" aria-live="polite">
            {he.loading}
          </p>
        ) : null}
      </QuoteFlowSheet>

      {nextAction ? (
        <NextActionDialog
          open
          onClose={closeAll}
          title={he.workflowNextCustomerTitle}
          body={he.workflowNextCustomerBody}
          customerId={nextAction.customerId}
          siteId={nextAction.siteId}
        />
      ) : null}
    </>
  );
}

/** Kept for existing imports/tests. */
export const CreateQuoteDialog = NewQuoteDialog;
