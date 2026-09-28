import { ApiClientError, type DocumentOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { he } from "../../i18n/he";
import { planQuotaMessage } from "../../lib/plan-quota";
import { formatAssetDate } from "../../lib/site-assets";
import { useSession } from "../../lib/session";

export function AssetDocumentsSection({
  assetId,
  canUpload,
}: {
  assetId: string;
  canUpload: boolean;
}) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "success" | "error">("idle");

  const docsQuery = useQuery({
    queryKey: ["equipment-docs", workspaceId, assetId],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listDocuments(workspaceId!, { entity_type: "equipment", entity_id: assetId, limit: 100 }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setPhase("uploading");
      const kind = file.type.startsWith("image/") ? "photo" : "document";
      const intent = await api.createDocumentUpload(workspaceId!, {
        entity_type: "equipment",
        entity_id: assetId,
        kind,
        mime_type: file.type || undefined,
        original_filename: file.name,
        byte_size: file.size,
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(he.sitesUploadFailed);
      await api.completeDocumentUpload(workspaceId!, intent.document_id, {
        byte_size: file.size,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      setPhase("success");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["equipment-docs", workspaceId, assetId] });
      void queryClient.invalidateQueries({ queryKey: ["equipment-lifecycle", workspaceId, assetId] });
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      window.setTimeout(() => setPhase((p) => (p === "success" ? "idle" : p)), 2500);
    },
    onError: (err) => {
      setPhase("error");
      setError(planQuotaMessage(err) ?? (err instanceof Error ? err.message : he.assetDocumentsError));
    },
  });

  async function openDoc(id: string) {
    if (!workspaceId) return;
    setOpeningId(id);
    try {
      const { url } = await api.getDocumentUrl(workspaceId, id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : he.sitesDocOpenFailed);
    } finally {
      setOpeningId(null);
    }
  }

  const items: DocumentOut[] = docsQuery.data?.items ?? [];

  return (
    <div className="space-y-3" data-testid="asset-documents">
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {canUpload ? (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              loading={upload.isPending}
              onClick={() => cameraRef.current?.click()}
              data-testid="asset-doc-photo"
            >
              {he.siteCapturePhoto}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              loading={upload.isPending}
              onClick={() => fileRef.current?.click()}
              data-testid="asset-doc-upload"
            >
              {he.siteUploadFile}
            </Button>
          </div>
          <p className="text-xs text-fg-muted" role="status">
            {phase === "uploading"
              ? he.sitesUploading
              : phase === "success"
                ? he.sitesUploadSuccess
                : phase === "error"
                  ? he.sitesUploadFailed
                  : he.assetDocumentsHint}
          </p>
        </>
      ) : null}

      {items.length ? (
        <ul className="divide-y divide-border border-y border-border" data-testid="asset-documents-list">
          {items.map((doc) => (
            <li key={doc.id} className="flex min-h-11 items-center gap-2 py-3 text-sm">
              {doc.kind === "photo" ? (
                <Camera className="size-4 shrink-0 text-fg-muted" aria-hidden />
              ) : (
                <FileText className="size-4 shrink-0 text-fg-muted" aria-hidden />
              )}
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-start font-medium text-fg hover:underline"
                dir="ltr"
                disabled={openingId === doc.id}
                onClick={() => void openDoc(doc.id)}
              >
                {doc.original_filename || doc.id}
              </button>
              <span className="shrink-0 text-xs text-fg-muted">
                {[doc.kind, formatAssetDate(doc.created_at)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted" data-testid="asset-documents-empty">
          {he.assetDocumentsEmpty}
        </p>
      )}
    </div>
  );
}
