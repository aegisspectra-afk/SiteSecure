/** Ensure binary is treated as a real PDF (Chrome/Windows open reliably). */
export function asPdfBlob(data: Blob | ArrayBuffer): Blob {
  if (data instanceof Blob) {
    if (data.type === "application/pdf") return data;
    return new Blob([data], { type: "application/pdf" });
  }
  return new Blob([data], { type: "application/pdf" });
}

/** Trigger a browser download for a PDF Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const pdf = asPdfBlob(blob);
  const safeName = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Do not revoke immediately — Chrome may still be streaming the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/**
 * Open PDF in a new tab via blob: URL (works in Chrome).
 * Avoids file:// ERR_FAILED that happens when opening Downloads with Chrome as PDF handler.
 */
export function openPdfBlob(blob: Blob) {
  const pdf = asPdfBlob(blob);
  const url = URL.createObjectURL(pdf);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Popup blocked — fall back to download.
    downloadBlob(pdf, "SITE-SECURE-QUOTE.pdf");
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
}

/** Download + open preview tab so the user sees the document immediately. */
export function downloadAndOpenPdf(blob: Blob, filename: string) {
  downloadBlob(blob, filename);
  openPdfBlob(blob);
}
