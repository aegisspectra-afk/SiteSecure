import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HandoverDocument } from "../../../components/public/HandoverDocument";
import { he } from "../../../i18n/he";
import { downloadAndOpenPdf } from "../../../lib/download-blob";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/public/handover/$token")({
  component: PublicHandoverPage,
});

function PublicHandoverPage() {
  const { token } = Route.useParams();
  const { api } = useSession();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["public-handover", token],
    queryFn: () => api.getPublicHandover(token),
    staleTime: 30_000,
  });

  async function onPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { blob, filename } = await api.downloadPublicHandoverPdf(token);
      downloadAndOpenPdf(blob, filename);
    } catch {
      setPdfError(he.quotePdfFailed);
    } finally {
      setPdfBusy(false);
    }
  }

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) {
    return (
      <div className="public-root min-h-dvh p-6" dir="rtl">
        <ErrorState title={he.quotePublicError} />
      </div>
    );
  }

  const doc = query.data;
  return (
    <div className="public-root min-h-dvh bg-bg p-4 sm:p-6" dir="rtl">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={pdfBusy} onClick={() => void onPdf()}>
            {he.handoverDownloadPdf}
          </Button>
        </div>
        {pdfError ? <p className="text-sm text-danger">{pdfError}</p> : null}
        <HandoverDocument
          data={{
            company: doc.company,
            customer_name: doc.customer?.display_name,
            site_name: doc.site?.name,
            site_address: doc.site?.address,
            technician_name: doc.technician_name,
            completed_at: doc.completed_at,
            warranty_label: doc.warranty_label,
            equipment: (doc.equipment || []).map((row) => ({
              name: row.name || "ציוד",
              qty: row.qty,
            })),
          }}
        />
      </div>
    </div>
  );
}
