import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@site-secure/ui";
import { he } from "../i18n/he";
import { APP_VERSION } from "../lib/app-version";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      href: typeof window !== "undefined" ? window.location.href : null,
      app_version: APP_VERSION,
      ts: new Date().toISOString(),
    };
    console.error("app_crash", payload);
    try {
      const key = "ss_pending_client_errors";
      const prev = JSON.parse(sessionStorage.getItem(key) || "[]") as unknown[];
      prev.push(payload);
      sessionStorage.setItem(key, JSON.stringify(prev.slice(-20)));
    } catch {
      /* ignore quota */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-start justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-fg">{he.appCrashTitle}</h1>
        <p className="text-sm text-fg-muted">{he.appCrashBody}</p>
        <Button
          onClick={() => {
            this.setState({ error: null });
            window.location.assign("/app");
          }}
        >
          {he.appCrashReload}
        </Button>
      </div>
    );
  }
}
