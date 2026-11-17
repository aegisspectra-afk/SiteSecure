import type { ApiClient } from "@site-secure/api-client";

/** Upload one file to a job (photo or document) and return the new document id. */
export async function uploadJobFile(api: ApiClient, workspaceId: string, jobId: string, file: File): Promise<string> {
  const isPhoto = (file.type || "").startsWith("image/");
  const intent = await api.createDocumentUpload(workspaceId, {
    entity_type: "job",
    entity_id: jobId,
    kind: isPhoto ? "photo" : "document",
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
