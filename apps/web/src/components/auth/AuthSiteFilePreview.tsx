import { Card, Status, cn } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function AuthSiteFilePreview({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card
      aria-label={he.authPreviewAria}
      className={cn(compact ? "p-4" : "p-5", "shadow-popover", className)}
    >
      <p className="ltr-meta text-xs font-semibold tracking-[0.16em] text-fg-muted">{he.authPreviewProduct}</p>
      <p className={cn("mt-3 font-semibold text-fg", compact ? "text-sm" : "text-base")}>{he.authPreviewSiteName}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="sr-only">{he.authPreviewCameras}</dt>
          <dd className="text-sm font-medium text-fg">{he.authPreviewCameras}</dd>
        </div>
        <div>
          <dt className="sr-only">{he.authPreviewNvr}</dt>
          <dd className="text-sm font-medium text-fg">{he.authPreviewNvr}</dd>
        </div>
      </dl>
      {compact ? null : (
        <dl className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs text-fg-muted">{he.authPreviewWarranty}</dt>
            <dd>
              <Status label={he.authPreviewWarrantyActive} tone="success" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs text-fg-muted">{he.authPreviewLastVisit}</dt>
            <dd className="ltr-meta text-sm text-fg">{he.authPreviewLastVisitDate}</dd>
          </div>
        </dl>
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs text-fg-muted">{he.authPreviewMedia}</p>
    </Card>
  );
}
