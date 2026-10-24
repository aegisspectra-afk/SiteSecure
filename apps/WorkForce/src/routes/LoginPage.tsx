import { Button, Input } from "@site-secure/ui";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { he } from "../i18n/he";
import { afterWorkforceLoginPath, workforceGate } from "../lib/access";
import { workforceAuthErrorMessage } from "../lib/auth-errors";
import { forgotPasswordUrl, hasPublicSupabaseConfig, openConfiguredUrl, platformHomeUrl } from "../lib/env";
import { useSession } from "../lib/session";

function WorkforceMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#0f766e" />
      <path
        fill="#ecfdf5"
        d="M10 13h20v3H10zm0 6h9v12H10zm11 0h9v12h-9zM13 9h3v5h-3zm11 0h3v5h-3z"
      />
    </svg>
  );
}

function PlatformLink() {
  const url = platformHomeUrl();
  if (!url) return null;
  return (
    <Button type="button" variant="ghost" onClick={() => openConfiguredUrl(url)}>
      {he.backToPlatform}
    </Button>
  );
}

export function LoginPage() {
  const { signIn, signOut, loading, session, hasWorkspace, hasWorkforce } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const gate = workforceGate({
    loading,
    hasSession: Boolean(session),
    hasWorkspace,
    hasWorkforce,
  });

  if (gate === "home") {
    return <Navigate to={afterWorkforceLoginPath(gate)} />;
  }

  if (!hasPublicSupabaseConfig()) {
    return (
      <main className="wf-login-root" data-testid="workforce-login">
        <div className="wf-login-card">
          <WorkforceMark />
          <h1 className="wf-login-title">{he.loginTitle}</h1>
          <p className="wf-login-copy">{he.noConfig}</p>
        </div>
      </main>
    );
  }

  if (gate === "loading") {
    return (
      <main className="wf-login-root" data-testid="workforce-login">
        <p className="wf-login-copy">{he.loading}</p>
      </main>
    );
  }

  if (gate === "blocked" || gate === "no-workspace") {
    return (
      <main className="wf-login-root" data-testid="workforce-login-blocked">
        <div className="wf-login-card">
          <WorkforceMark />
          <p className="wf-login-kicker">{he.loginKicker}</p>
          <h1 className="wf-login-title">
            {gate === "no-workspace" ? he.sessionError : he.entitlementBlockedTitle}
          </h1>
          <p className="wf-login-copy">
            {gate === "no-workspace" ? he.sessionError : he.entitlementBlockedBody}
          </p>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" onClick={() => void signOut()}>
              {he.signOut}
            </Button>
            <PlatformLink />
          </div>
        </div>
      </main>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await signIn(email.trim(), password);
    setPending(false);
    if (!result.ok) {
      setMessage(workforceAuthErrorMessage(result.message));
      return;
    }
    if (result.entitled) {
      await navigate({ to: "/" });
    }
  }

  return (
    <main className="wf-login-root" data-testid="workforce-login">
      <div className="wf-login-card">
        <WorkforceMark />
        <p className="wf-login-kicker">{he.loginKicker}</p>
        <h1 className="wf-login-title">{he.loginLead}</h1>
        <form
          className="flex flex-col gap-3"
          data-testid="workforce-login-form"
          onSubmit={(event) => void onSubmit(event)}
        >
          <Input
            id="wf-email"
            label={he.email}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            id="wf-password"
            label={he.password}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {message ? (
            <p className="text-sm text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending}>
            {he.signIn}
          </Button>
        </form>
        {forgotPasswordUrl() ? (
          <a className="wf-login-note wf-login-forgot" href={forgotPasswordUrl()}>
            {he.forgotPassword}
          </a>
        ) : null}
        <PlatformLink />
      </div>
    </main>
  );
}
