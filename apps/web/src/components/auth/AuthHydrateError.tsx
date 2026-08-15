import { Button, ErrorState } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function AuthHydrateError({
  error,
  onRetry,
  onSignOut,
}: {
  error: string | null;
  onRetry: () => void;
  onSignOut?: () => void;
}) {
  return (
    <ErrorState
      className="px-0 py-4"
      title={he.emailVerified}
      description={error || he.emailVerifiedNeedApi}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onClick={onRetry}>
            {he.retry}
          </Button>
          {onSignOut ? (
            <Button variant="ghost" onClick={onSignOut}>
              {he.signOut}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
