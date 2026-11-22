import type { ApiClient } from "@site-secure/api-client";

/** B6: upload one site-tour photo onto a quote (max 10 enforced server-side). */
export async function uploadQuoteTourPhoto(
  api: ApiClient,
  workspaceId: string,
  quoteId: string,
  file: File,
): Promise<string> {
  if (!(file.type || "").startsWith("image/")) {
    throw new Error("ניתן לצרף רק תמונות");
  }
  const intent = await api.createDocumentUpload(workspaceId, {
    entity_type: "quote",
    entity_id: quoteId,
    kind: "photo",
    mime_type: file.type || undefined,
    original_filename: file.name,
    byte_size: Math.max(file.size, 1),
  });
  const put = await fetch(intent.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("ההעלאה נכשלה");
  await api.completeDocumentUpload(workspaceId, intent.document_id, {
    byte_size: file.size,
    mime_type: file.type || undefined,
  });
  return intent.document_id;
}
