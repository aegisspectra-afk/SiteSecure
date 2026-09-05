import { GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let configured = false;

/** Configure PDF.js worker once (Vite resolves worker URL). */
export function ensurePdfjsWorker(): void {
  if (configured) return;
  GlobalWorkerOptions.workerSrc = workerSrc;
  configured = true;
}
