import { Button, Input } from "@site-secure/ui";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../i18n/he";
import { hasPublicSupabaseConfig, platformHomeUrl } from "../lib/env";
import { useSession } from "../lib/session";

export function LoginPage() {
  const { signIn, loading, session } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" />;
  }

  if (!hasPublicSupabaseConfig()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">{he.loginTitle}</h1>
        <p className="text-sm text-fg-muted">{he.noConfig}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4" data-testid="ssp-login">
      <h1 className="text-2xl font-semibold">{he.loginTitle}</h1>
      <p className="text-sm text-fg-muted">{he.loginLead}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPending(true);
          setMessage(null);
          void (async () => {
            const result = await signIn(email.trim(), password);
            setPending(false);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            await navigate({ to: "/" });
          })();
        }}
      >
        <Input
          id="ssp-email"
          label={he.email}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="ssp-password"
          label={he.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {message ? <p className="text-sm text-danger">{message}</p> : null}
        <Button type="submit" loading={pending} disabled={pending}>
          {he.signIn}
        </Button>
      </form>
      <Link to="/activate" className="text-sm text-fg-muted underline">
        {he.loginFieldLink}
      </Link>
      <Button type="button" variant="ghost" onClick={() => window.location.assign(platformHomeUrl())}>
        {he.backToPlatform}
      </Button>
    </main>
  );
}
