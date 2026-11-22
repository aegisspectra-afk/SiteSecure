import { Button, Input } from "@site-secure/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { createPortalApiClient } from "../../lib/portal-api";
import { setPortalToken } from "../../lib/portal-session";

export const Route = createFileRoute("/portal/login")({
  component: PortalLoginPage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const api = createPortalApiClient();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.requestPortalOtpCode(phone.trim());
      if ("debug_code" in res && res.debug_code) {
        setDebugCode(String(res.debug_code));
      }
      setStep("code");
    } catch {
      setError(he.portalOtpRequestFailed);
    } finally {
      setPending(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.verifyPortalOtp(phone.trim(), code.trim());
      setPortalToken(res.token);
      await navigate({ to: "/portal" });
    } catch {
      setError(he.portalOtpVerifyFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <main dir="rtl" lang="he" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <motionHead>
        <p className="text-xs tracking-[0.14em] text-fg-muted">SITE SECURE</p>
        <h1 className="text-2xl font-semibold text-fg">{he.portalOtpTitle}</h1>
        <p className="text-sm text-fg-muted">{he.portalOtpLead}</p>
      </motionHead>
      {step === "phone" ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submitPhone(e)}>
          <Input
            id="portal-phone"
            label={he.portalOtpPhone}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            required
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {he.portalOtpSendCode}
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submitCode(e)}>
          <p className="text-sm text-fg-muted">{he.portalOtpSentHint}</p>
          {debugCode ? (
            <p className="rounded border border-dashed border-border bg-bg-muted p-2 text-sm" dir="ltr">
              {he.portalOtpDebugCode(debugCode)}
            </p>
          ) : null}
          <Input
            id="portal-code"
            label={he.portalOtpCode}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            value={code}
            onChange={(ev) => setCode(ev.target.value)}
            required
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {he.portalOtpVerify}
          </Button>
          <button type="button" className="text-sm text-action underline" onClick={() => setStep("phone")}>
            {he.portalOtpChangePhone}
          </button>
        </form>
      )}
    </main>
  );
}

function motionHead({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}