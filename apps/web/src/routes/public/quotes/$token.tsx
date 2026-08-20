import { Button, ErrorState, Input, LoadingBlock, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LottieAnimation } from "../../../components/lottie";
import { QuoteCustomerView } from "../../../components/quotes/QuoteCustomerView";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/public/quotes/$token")({
  component: PublicQuotePage,
});

function PublicQuotePage() {
  const { token } = Route.useParams();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => api.getPublicQuote(token),
    staleTime: 30_000,
  });
  const approve = useMutation({
    mutationFn: () => api.approvePublicQuote(token, { name: name.trim() || undefined }),
    onSuccess: (row) => queryClient.setQueryData(["public-quote", token], row),
  });
  const reject = useMutation({
    mutationFn: () => api.rejectPublicQuote(token, { reason: reason.trim() || undefined }),
    onSuccess: (row) => queryClient.setQueryData(["public-quote", token], row),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) {
    return (
      <div className="public-root min-h-dvh p-6">
        <ErrorState title={he.quotePublicError} />
      </div>
    );
  }

  const quote = query.data;

  return (
    <div className="public-root min-h-dvh px-4 py-10" dir="rtl">
      <QuoteCustomerView
        quote={quote}
        actions={
          <>
            {quote.superseded ? <p className="text-sm text-danger">{he.quotePublicSuperseded}</p> : null}
            {quote.status === "approved" ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <LottieAnimation name="success" size={64} />
                <p className="text-sm font-medium">{he.quotePublicThanks}</p>
              </div>
            ) : null}
            {quote.status === "rejected" ? <p className="text-sm font-medium">{he.quotePublicRejected}</p> : null}
            {quote.status === "expired" ? <p className="text-sm font-medium">{he.quotePublicExpired}</p> : null}
            {quote.can_approve ? (
              <section className="ops-card flex flex-col gap-4 p-5">
                <Input id="signer" label={he.quotePublicSigner} value={name} onChange={(ev) => setName(ev.target.value)} />
                <Button loading={approve.isPending} onClick={() => approve.mutate()}>
                  {he.quotePublicApprove}
                </Button>
                <Textarea id="reason" label={he.quotePublicReason} value={reason} onChange={(ev) => setReason(ev.target.value)} />
                <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate()}>
                  {he.quotePublicReject}
                </Button>
              </section>
            ) : null}
          </>
        }
      />
    </div>
  );
}
