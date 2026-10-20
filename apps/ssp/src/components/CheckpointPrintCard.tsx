import { qrSvgMarkup } from "../lib/qrSvg";
import type { PrintableCheckpoint } from "../lib/printCheckpoints";
import { he } from "../i18n/he";

export function CheckpointPrintCard({ checkpoint }: { checkpoint: PrintableCheckpoint }) {
  const svg = qrSvgMarkup(checkpoint.code, { sizePx: 168 });
  return (
    <article className="ssp-print-card flex flex-col items-center gap-3 rounded-lg border border-border bg-white p-5 text-center text-black">
      <h2 className="text-lg font-semibold leading-tight">{checkpoint.name}</h2>
      {checkpoint.location_label ? (
        <p className="text-sm text-neutral-600">{checkpoint.location_label}</p>
      ) : null}
      <div
        className="ssp-print-qr bg-white"
        data-testid="ssp-print-qr"
        data-code={checkpoint.code}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{he.printCardId}</p>
      <code className="break-all font-mono text-sm tracking-wide" data-testid="ssp-print-code">
        {checkpoint.code}
      </code>
      <p className="text-[11px] text-neutral-500">{he.printAuthNote}</p>
    </article>
  );
}
