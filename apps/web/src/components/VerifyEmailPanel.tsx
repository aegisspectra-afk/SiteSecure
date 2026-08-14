import { Button } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { AuthAlert } from "./auth";

export function VerifyEmailPanel({
  email,
  loading,
  resent,
  error,
  onResend,
}: {
  email?: string;
  loading?: boolean;
  resent?: boolean;
  error?: string | null;
  onResend: () => Promise<void> | void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {email ? (
        <p className="text-sm leading-6 text-fg">
          {he.verifySent}{" "}
          <span className="ltr-meta font-medium" dir="ltr">
            {email}
          </span>
        </p>
      ) : (
        <p className="text-sm leading-6 text-fg-muted">{he.verifyMissingEmail}</p>
      )}
      <p className="text-sm leading-6 text-fg-muted">{he.verifyNext}</p>
      <p className="text-sm font-medium text-fg">{he.openEmail}</p>
      {error ? <AuthAlert>{error}</AuthAlert> : null}
      {resent ? <p className="text-sm text-fg-muted">{he.verifyResent}</p> : null}
      {email ? (
        <Button
          type="button"
          variant="secondary"
          loading={loading}
          className="h-12 w-full"
          onClick={() => void onResend()}
        >
          {he.verifyResend}
        </Button>
      ) : (
        <Link to="/register" className="font-medium text-action hover:underline">
          {he.registerPrimary}
        </Link>
      )}
    </div>
  );
}
