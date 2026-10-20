import { Button, Input, Textarea } from "@site-secure/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";

export const Route = createFileRoute("/demo/ssp")({
  component: DemoSspWalkthrough,
});

type Phase = "build" | "assign" | "fill" | "result";

type DemoField = { id: string; label: string; required: boolean };

/**
 * Visual-only SSP walkthrough. No API calls, no persistence.
 * Use when live SSP is blocked (feature off / migrations not applied).
 */
function DemoSspWalkthrough() {
  const [phase, setPhase] = useState<Phase>("build");
  const [title, setTitle] = useState("שאלון מועמד — הדגמה");
  const [fields, setFields] = useState<DemoField[]>([
    { id: "f1", label: "שם מלא", required: true },
    { id: "f2", label: "ניסיון קודם באבטחה", required: false },
  ]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assignLabel, setAssignLabel] = useState("עובד שטח — הדגמה");

  const linkPreview = useMemo(() => "/demo/ssp#fill", []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-4 md:p-8" dir="rtl">
      <div className="rounded-[var(--radius-control)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <p className="font-semibold text-fg">{he.demoSspBadge}</p>
        <p className="mt-1 text-fg-muted">{he.demoSspLead}</p>
      </div>

      <header>
        <h1 className="text-xl font-semibold text-fg">{he.demoSspTitle}</h1>
        <p className="mt-1 text-sm text-fg-muted">{he.demoSspSubtitle}</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs" aria-label={he.demoSspStepsAria}>
        {(
          [
            ["build", he.demoSspStepBuild],
            ["assign", he.demoSspStepAssign],
            ["fill", he.demoSspStepFill],
            ["result", he.demoSspStepResult],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              phase === id
                ? "rounded-full bg-fg px-3 py-1.5 font-medium text-bg"
                : "rounded-full border border-border px-3 py-1.5 text-fg-muted"
            }
            onClick={() => setPhase(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {phase === "build" ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
          <Input
            id="demo-ssp-title"
            label={he.demoSspFormTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <ul className="divide-y divide-border rounded border border-border">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{f.label}</span>
                <span className="text-xs text-fg-muted">{f.required ? he.demoSspRequired : he.demoSspOptional}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setFields((prev) => [
                ...prev,
                { id: crypto.randomUUID(), label: `שדה ${prev.length + 1}`, required: false },
              ])
            }
          >
            {he.demoSspAddField}
          </Button>
          <Button type="button" variant="primary" onClick={() => setPhase("assign")}>
            {he.demoSspPublishAssign}
          </Button>
        </section>
      ) : null}

      {phase === "assign" ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
          <p className="text-sm font-medium text-fg">{title}</p>
          <Input
            id="demo-assign"
            label={he.demoSspAssignee}
            value={assignLabel}
            onChange={(e) => setAssignLabel(e.target.value)}
          />
          <p className="text-xs text-fg-muted">
            {he.demoSspLinkLabel}: <span className="ltr-meta font-mono">{linkPreview}</span>
          </p>
          <Button type="button" variant="primary" onClick={() => setPhase("fill")}>
            {he.demoSspOpenFill}
          </Button>
        </section>
      ) : null}

      {phase === "fill" ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
          <p className="text-sm text-fg-muted">{he.demoSspFillAs}: {assignLabel}</p>
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          {fields.map((f) =>
            f.label.length > 40 ? (
              <Textarea
                key={f.id}
                id={f.id}
                label={f.label}
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
              />
            ) : (
              <Input
                key={f.id}
                id={f.id}
                label={f.label}
                value={answers[f.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
              />
            ),
          )}
          <Button type="button" variant="primary" onClick={() => setPhase("result")}>
            {he.demoSspSubmit}
          </Button>
        </section>
      ) : null}

      {phase === "result" ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 p-4">
          <p className="font-semibold text-fg">{he.demoSspResultTitle}</p>
          <p className="text-xs text-fg-muted">{he.demoSspResultNote}</p>
          <dl className="space-y-2 text-sm">
            {fields.map((f) => (
              <div key={f.id}>
                <dt className="text-fg-muted">{f.label}</dt>
                <dd className="font-medium text-fg">{answers[f.id]?.trim() || "—"}</dd>
              </div>
            ))}
          </dl>
          <Button type="button" variant="secondary" onClick={() => setPhase("build")}>
            {he.demoSspRestart}
          </Button>
        </section>
      ) : null}

      <p className="text-center text-xs text-fg-muted">
        <Link to="/app" className="text-action hover:underline">
          {he.platformPathSkipToApp}
        </Link>
        {" · "}
        <Link to="/app/platform-path" className="text-action hover:underline">
          {he.platformPathTitle}
        </Link>
      </p>
    </div>
  );
}
