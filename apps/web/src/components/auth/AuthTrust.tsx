import { Lock } from "lucide-react";
import { he } from "../../i18n/he";

export function AuthTrust() {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <Lock className="size-3.5 shrink-0 text-action" aria-hidden />
        <span>{he.authTrustLead}</span>
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" dir="ltr">
        {[he.authTrustAuth, he.authTrustRbac, he.authTrustAudit].map((item) => (
          <li key={item} className="public-mono text-[10px] tracking-[0.12em] text-fg-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
