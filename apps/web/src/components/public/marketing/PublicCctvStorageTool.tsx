import { Button, Input, Select } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { calculatePublicCctvStorage, type PublicStorageInput, type PublicStorageResult } from "../../../lib/public-marketing-api";
import { usePublicSeo } from "../../../lib/public-seo";
import { formatTb } from "../../../lib/cctv-storage-display";
import { PublicHeader } from "../PublicChrome";

export const PUBLIC_CCTV_DRAFT_KEY = "ss.public-cctv-sizing-draft";

export function PublicCctvStorageTool() {
  const [input, setInput] = useState<PublicStorageInput>({
    camera_count: 8,
    resolution_mp: 4,
    retention_days: 30,
    recording_mode: "continuous",
    codec: "h265",
  });
  const [result, setResult] = useState<PublicStorageResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  usePublicSeo({
    title: "מחשבון אחסון CCTV — חינם | SITE SECURE",
    description: "הערכת נפח הקלטה, דיסק מומלץ וערוצי NVR — בלי מחירים, לפני הרשמה.",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PUBLIC_CCTV_DRAFT_KEY);
      if (raw) setInput(JSON.parse(raw) as PublicStorageInput);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="public-root public-shell min-h-dvh text-fg" dir="rtl" lang="he">
      <PublicHeader marketingNav />
      <main className="public-container mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-fg">מחשבון אחסון CCTV</h1>
        <p className="mt-2 text-sm leading-7 text-fg-muted">
          כלי הנדסי חינמי — בלי מחירים. אותו מנוע כמו באשף ההצעה במערכת.
        </p>

        <form
          className="mt-8 grid gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            setBusy(true);
            setErr(null);
            void calculatePublicCctvStorage(input)
              .then((data) => {
                setResult(data);
                sessionStorage.setItem(PUBLIC_CCTV_DRAFT_KEY, JSON.stringify(input));
              })
              .catch((e: Error) => setErr(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <Input
            id="cam-count"
            type="number"
            min={1}
            max={64}
            label="מספר מצלמות"
            value={String(input.camera_count)}
            onChange={(ev) => setInput({ ...input, camera_count: Number(ev.target.value) })}
          />
          <Input
            id="res-mp"
            type="number"
            step="0.1"
            min={1}
            max={32}
            label="רזולוציה (מגה-פיקסל)"
            value={String(input.resolution_mp)}
            onChange={(ev) => setInput({ ...input, resolution_mp: Number(ev.target.value) })}
          />
          <Input
            id="retention"
            type="number"
            min={1}
            max={365}
            label="ימי הקלטה"
            value={String(input.retention_days)}
            onChange={(ev) => setInput({ ...input, retention_days: Number(ev.target.value) })}
          />
          <Select
            id="rec-mode"
            label="אופן הקלטה"
            value={input.recording_mode}
            onChange={(ev) =>
              setInput({ ...input, recording_mode: ev.target.value as PublicStorageInput["recording_mode"] })
            }
          >
            <option value="continuous">רציפה (24/7)</option>
            <option value="scheduled">לפי לוח שעות</option>
            <option value="motion">תנועה</option>
          </Select>
          {input.recording_mode === "scheduled" ? (
            <Input
              id="hours-day"
              type="number"
              min={0.1}
              max={24}
              step="0.5"
              label="שעות הקלטה ביום"
              value={String(input.recording_hours_per_day ?? 12)}
              onChange={(ev) => setInput({ ...input, recording_hours_per_day: Number(ev.target.value) })}
            />
          ) : null}
          {input.recording_mode === "motion" ? (
            <Input
              id="motion-duty"
              type="number"
              min={0.05}
              max={1}
              step="0.05"
              label="אחוז זמן תנועה (0–1)"
              value={String(input.motion_duty_cycle ?? 0.3)}
              onChange={(ev) => setInput({ ...input, motion_duty_cycle: Number(ev.target.value) })}
            />
          ) : null}
          <Button type="submit" disabled={busy} className="min-h-12">
            חשב
          </Button>
        </form>

        {err ? <p className="mt-4 text-sm text-destructive">{err}</p> : null}

        {result?.storage?.status === "ok" ? (
          <div className="mt-8 ops-card space-y-2 p-5 text-sm">
            <p>
              <span className="text-fg-muted">נפח נדרש: </span>
              <strong>{formatTb(result.storage.required_tb ?? 0)}</strong>
            </p>
            <p>
              <span className="text-fg-muted">ערוצי NVR מומלצים: </span>
              <strong>{result.recorder.channels ?? "—"}</strong>
            </p>
            <p>
              <span className="text-fg-muted">דיסק מומלץ: </span>
              <strong>
                {result.hdd.drive_count
                  ? `${result.hdd.drive_count}× ${formatTb(result.hdd.recommended_tb_per_drive ?? 0)}`
                  : "—"}
              </strong>
            </p>
            <p className="text-xs text-fg-muted">מחירים ודגמים — רק אחרי הרשמה ובאשף ההצעה.</p>
            <Link
              to="/register"
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
              onClick={() => sessionStorage.setItem(PUBLIC_CCTV_DRAFT_KEY, JSON.stringify(input))}
            >
              הפוך להצעת מחיר — הרשמה
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}