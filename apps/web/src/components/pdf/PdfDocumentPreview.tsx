import { getDocument, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { computeFitScale } from "../../lib/pdf-preview";
import { ensurePdfjsWorker } from "../../lib/pdfjs";

type PdfDocumentPreviewProps = {
  /** Raw PDF bytes from the server preview endpoint. */
  data: Uint8Array | null;
  /** Manual zoom when fitWidth is false. */
  scale: number;
  fitWidth: boolean;
  /** Backend fetch still in flight while previous bytes remain visible. */
  updating?: boolean;
  /** Fetch/network error from parent (bytes never arrived). */
  fetchError?: string | null;
  title?: string;
  preparingLabel: string;
  errorTitle: string;
  errorHint: string;
  retryLabel: string;
  onRetry?: () => void;
  /** Reports effective scale (manual or fit) for toolbar percent display. */
  onEffectiveScaleChange?: (scale: number) => void;
};

/**
 * Generic PDF visualizer: PDF.js → canvas A4 pages.
 * No iframe / object / embed — keeps the native browser PDF chrome out of Studio.
 */
export function PdfDocumentPreview({
  data,
  scale,
  fitWidth,
  updating = false,
  fetchError = null,
  title = "PDF",
  preparingLabel,
  errorTitle,
  errorHint,
  retryLabel,
  onRetry,
  onEffectiveScaleChange,
}: PdfDocumentPreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [basePageWidth, setBasePageWidth] = useState(595.28);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!data || data.byteLength === 0) {
      if (docRef.current) {
        void docRef.current.destroy();
        docRef.current = null;
      }
      setDoc(null);
      setPageCount(0);
      setLoadState(data ? "error" : "idle");
      return;
    }

    let cancelled = false;
    // Keep existing pages while a replacement PDF loads (no white flash).
    setLoadState((prev) => (prev === "ready" ? "ready" : "loading"));
    setRenderError(false);
    ensurePdfjsWorker();
    const loadingTask = getDocument({ data: data.slice() });

    void (async () => {
      try {
        const proxy = await loadingTask.promise;
        if (cancelled) {
          await proxy.destroy();
          return;
        }
        const first = await proxy.getPage(1);
        const base = first.getViewport({ scale: 1 }).width;
        const prev = docRef.current;
        docRef.current = proxy;
        setBasePageWidth(base);
        setDoc(proxy);
        setPageCount(proxy.numPages);
        setLoadState("ready");
        if (prev && prev !== proxy) void prev.destroy();
      } catch {
        if (!cancelled) {
          if (!docRef.current) {
            setDoc(null);
            setPageCount(0);
            setLoadState("error");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [data]);

  useEffect(() => {
    return () => {
      if (docRef.current) {
        void docRef.current.destroy();
        docRef.current = null;
      }
    };
  }, []);

  const effectiveScale = fitWidth
    ? computeFitScale(basePageWidth, containerWidth)
    : scale;

  useEffect(() => {
    onEffectiveScaleChange?.(effectiveScale);
  }, [effectiveScale, onEffectiveScaleChange]);

  const handlePageError = useCallback(() => setRenderError(true), []);

  const showFetchError = Boolean(fetchError) && !data;
  const showRenderError = loadState === "error" || renderError;
  const showPreparing = Boolean(data) && loadState === "loading" && !doc;
  const showEmptyLoading = !data && !fetchError && loadState !== "error";

  return (
    <div className="pdf-preview-root">
      {updating ? (
        <p className="pdf-preview-updating" aria-live="polite">
          {preparingLabel}
        </p>
      ) : null}

      <div ref={stageRef} className="pdf-preview-stage" data-testid="pdf-preview-stage">
        {showFetchError || showRenderError ? (
          <div className="pdf-preview-error" role="alert">
            <p className="pdf-preview-error-title">{fetchError || errorTitle}</p>
            <p className="pdf-preview-error-hint">{errorHint}</p>
            {onRetry ? (
              <button type="button" className="settings-text-btn" onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
          </div>
        ) : showEmptyLoading || showPreparing ? (
          <div className="pdf-preview-skeleton" aria-busy="true" aria-live="polite">
            <div className="pdf-preview-skeleton-page" />
            <p className="pdf-preview-skeleton-label">{preparingLabel}</p>
          </div>
        ) : doc && pageCount > 0 ? (
          <div className="pdf-preview-pages" data-testid="pdf-preview-pages">
            {Array.from({ length: pageCount }, (_, i) => (
              <PdfCanvasPage
                key={`${doc.fingerprints?.[0] ?? "doc"}-${i + 1}-${effectiveScale.toFixed(4)}`}
                doc={doc}
                pageNumber={i + 1}
                scale={effectiveScale}
                title={`${title} — ${i + 1}`}
                onError={handlePageError}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PdfCanvasPage({
  doc,
  pageNumber,
  scale,
  title,
  onError,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  title: string;
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onError();
          return;
        }
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        if (wrapRef.current) {
          wrapRef.current.style.width = `${viewport.width}px`;
        }
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform,
        });
        await renderTask.promise;
      } catch (err) {
        if (cancelled) return;
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        if (name === "RenderingCancelledException") return;
        onError();
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [doc, pageNumber, scale, onError]);

  return (
    <div ref={wrapRef} className="pdf-preview-page" data-testid="pdf-preview-page">
      <canvas ref={canvasRef} className="pdf-preview-canvas" role="img" aria-label={title} />
    </div>
  );
}
