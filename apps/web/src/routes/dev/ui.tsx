import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  ProgressList,
  Radio,
  Status,
  SuccessState,
  Switch,
  Tabs,
} from "@site-secure/ui";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { LOTTIE_ANIMATIONS, LottieAnimation, type LottieName } from "../../components/lottie";
import { ThemePicker } from "../../components/ThemePicker";
import { WorkspaceSystemStatus } from "../../components/WorkspaceSystemStatus";
import { workspaceSystemChecks } from "../../lib/workspace-header";

export const Route = createFileRoute("/dev/ui")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/login" });
  },
  component: PrimitiveGallery,
});

function PrimitiveGallery() {
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState("a");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <PageHeader title="Primitives" description="Dev gallery — not a product screen" />
      <section className="ops-card flex max-w-sm flex-col gap-3 p-5">
        <h2 className="text-sm font-medium text-fg">Theme</h2>
        <ThemePicker id="dev-theme" />
      </section>
      <Card className="flex flex-wrap gap-3">
        <Button variant="primary">שלח הצעת מחיר</Button>
        <Button variant="secondary">שמור טיוטה</Button>
        <Button variant="ghost">ביטול</Button>
        <Button variant="danger">מחק סביבה</Button>
        <Button variant="primary" disabled>
          שלח הצעת מחיר
        </Button>
        <Button variant="primary" loading>
          שלח הצעת מחיר
        </Button>
      </Card>
      <Input id="demo" label="שם מלא" />
      <Input id="demo-password" label="סיסמה" revealable />
      <div className="flex gap-4">
        <Checkbox label="נדרש" defaultChecked />
        <Radio name="r" label="אפשרות" defaultChecked />
        <Switch label="התראות" checked={on} onCheckedChange={setOn} />
      </div>
      <Status label="ממתין לאישור הלקוח" tone="warning" />
      <div className="flex flex-wrap gap-4">
        <Status label="טיוטה" tone="neutral" />
        <Status label="נשלחה" tone="info" />
        <Status label="אושרה" tone="success" />
        <Status label="נדחתה" tone="danger" />
      </div>
      <Badge>טיוטה</Badge>
      <section className="ops-card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-medium text-fg">Elevation</h2>
        <p className="text-xs text-fg-muted">Same semantic tokens in light and dark. Values change; layers stay distinct.</p>
        <div className="rounded-[var(--radius-panel)] border border-border bg-bg-0 p-4">
          <p className="text-[11px] text-fg-subtle">bg-0 canvas</p>
          <div className="mt-3 rounded-[var(--radius-panel)] border border-border bg-bg-nav p-4">
            <p className="text-[11px] text-fg-subtle">bg-nav sidebar</p>
            <div className="mt-3 rounded-[var(--radius-panel)] border border-border bg-bg-1 p-4">
              <p className="text-[11px] text-fg-subtle">bg-1 surface</p>
              <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-bg p-3">
                <p className="text-[11px] text-fg-subtle">bg input</p>
              </div>
              <div className="mt-3 rounded-[var(--radius-panel)] border border-border bg-bg-2 p-3 shadow-popover">
                <p className="text-[11px] text-fg-subtle">bg-2 elevated</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "a", label: "בסיסי" },
          { id: "b", label: "מתקדם" },
        ]}
      />
      <ProgressList
        steps={[
          { id: "1", label: "חשבון", state: "done" },
          { id: "2", label: "סביבת עבודה", state: "current" },
          { id: "3", label: "לקוח ראשון", state: "upcoming" },
        ]}
      />
      <EmptyState title="אין עבודות להיום" />
      <ErrorState title="אין הרשאה לשלוח הצעת מחיר" />
      <SuccessState title="העבודה נסגרה" />
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-fg">Lottie registry</h2>
        <p className="text-sm text-fg-muted">Dev preview only. Production usage is listed in Docs/ux/LOTTIE-REGISTRY.md.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(LOTTIE_ANIMATIONS) as LottieName[]).map((name) => {
            const entry = LOTTIE_ANIMATIONS[name];
            return (
              <div key={name} className="ops-card flex flex-col items-center gap-2 p-4 text-center">
                <LottieAnimation name={name} size={72} loop={entry.defaultLoop} />
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-fg-muted">{entry.usage.purpose}</p>
                <p className="text-xs text-fg-muted">{entry.usage.where}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">System status — offline preview</h2>
        <p className="text-sm text-fg-muted">
          Dev only. Production mounts networkConnecting only while navigator.onLine is false. Open the control to inspect the panel Lottie.
        </p>
        <div className="ops-card flex justify-end p-4">
          <WorkspaceSystemStatus
            checks={workspaceSystemChecks({
              workspaceStatus: "active",
              hasSession: true,
              online: false,
              authenticated: true,
            })}
          />
        </div>
      </section>
    </div>
  );
}
