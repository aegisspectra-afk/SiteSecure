import { BookText, KeyRound, Lock } from "lucide-react";
import { useState } from "react";
import { he } from "../../i18n/he";

const ITEMS = [
  { id: "lock", icon: Lock, label: he.authTrustAccess, tip: he.authTrustAccessTip },
  { id: "key", icon: KeyRound, label: he.authTrustRbacShort, tip: he.authTrustRbacTip },
  { id: "audit", icon: BookText, label: he.authTrustAuditShort, tip: he.authTrustAuditTip },
] as const;

export function AuthTrust() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="auth-trust" aria-label={he.authTrustQuiet}>
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const open = openId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              className={open ? "auth-trust-item is-open" : "auth-trust-item"}
              aria-describedby={`auth-trust-tip-${item.id}`}
              onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
              onBlur={() => setOpenId((current) => (current === item.id ? null : current))}
            >
              <Icon className="auth-trust-icon" aria-hidden strokeWidth={1.75} />
              <span>{item.label}</span>
              <span id={`auth-trust-tip-${item.id}`} role="tooltip" className="auth-trust-tip">
                {item.tip}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
