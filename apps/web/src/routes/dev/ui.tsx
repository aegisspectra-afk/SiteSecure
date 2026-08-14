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
      <Badge>טיוטה</Badge>
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
    </div>
  );
}
