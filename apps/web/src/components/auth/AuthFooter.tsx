import type { ReactNode } from "react";

export function AuthFooter({ prompt, action }: { prompt?: string; action: ReactNode }) {
  return (
    <p className="text-center text-sm text-fg-muted">
      {prompt ? `${prompt} ` : null}
      {action}
    </p>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <p className="auth-alert border-s-2 border-s-danger ps-3 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
