import { Button, Select } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  calculatePublicQuickStorage,
  type PublicQuickStorageInput,
} from "@site-secure/cctv-sizing";
import { trackMarketingEvent } from "../../../lib/marketing-analytics";
import { usePublicSeo } from "../../../lib/public-seo";
import { formatChannelsHe, formatDiskWithUnit, formatTbWithUnit } from "../../../lib/cctv-storage-display";
import { PUBLIC_CCTV_DRAFT_KEY, savePublicCctvDraft } from "../../../lib/public-cctv-draft";
import { MarketingShell } from "./enterprise/MarketingShell";

export { PUBLIC_CCTV_DRAFT_KEY };

const RES_OPTIONS = [2, 4, 5, 8] as const;

export function PublicCctvStorageTool() {
  const [input, setInput] = useState<PublicQuickStorageInput>({
    cameraCount: 8,
    resolutionMp: 4,
    retentionDays: 30,
    recordingMode: "continuous",
    codec: "h265",
  });

  usePublicSeo({
    title: "מחשבון אחסון CCTV — חינם | SITE SECURE",
    description: "הערכת נפח הקלטה, דיסק מומלץ וערוצי NVR — בלי מחירים, לפני הרשמה.",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PUBLIC_CCTV_DRAFT_KEY);
      if (!raw) return;
      const legacy = JSON.parse(raw) as {
        camera_count?: number;
        resolution_mp?: number;
        retention_days?: number;
        recording_mode?: PublicQuickStorageInput["recordingMode"];
        codec?: string;
        recording_hours_per_day?: number;
        motion_duty_cycle?: number;
      };
      setInput((prev) => ({
        ...prev,
        cameraCount: legacy.camera_count ?? prev.cameraCount,
        resolutionMp: legacy.resolution_mp ?? prev.resolutionMp,
        retentionDays: legacy.retention_days ?? prev.retentionDays,
        recordingMode: legacy.recording_mode ?? prev.recordingMode,
        codec: (legacy.codec as PublicQuickStorageInput["codec"]) ?? prev.codec,
        recordingHoursPerDay: legacy.recording_hours_per_day,
        motionDutyCycle: legacy.motion_duty_cycle,
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const result = useMemo(() => calculatePublicQuickStorage(input), [input]);
  const ok = result.storage.status === "ok";
  const requiredTb = result.storage.requiredTb ?? 0;
  const diskFill = Math.min(100, Math.round((requiredTb / Math.max(requiredTb * 1.15, 1)) * 85));

  const persist = () => {
    savePublicCctvDraft({
      camera_count: input.cameraCount,
      resolution_mp: input.resolutionMp,
      retention_days: input.retentionDays,
      recording_mode: input.recordingMode ?? "continuous",
      codec: input.codec ?? "h265",
      recording_hours_per_day: input.recordingHoursPerDay,
      motion_duty_cycle: input.motionDutyCycle,
    });
    trackMarketingEvent("calculator_complete", {
      cameras: input.cameraCount,
      retention_days: input.retentionDays,
    });
  };

  return (
    <MarketingShell darkNav={false}>
      <div className="mkt-container mx-auto max-w-2xl px-0 py-12">
        <h1 className="mkt-h1 text-[var(--mkt-ink)]">מחשבון אחסון CCTV</h1>
        <p className="mt-2 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">
          כלי הנדסי חינמי — חישוב חי באותו מנוע כמו באשף ההצעה. בלי מחירים.
        </p>

        <div className="mt-8 grid gap-5">
          <label className="mkt-calc-slider">
            <span>
              מצלמות <strong>{input.cameraCount}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={64}
              value={input.cameraCount}
              aria-label="מספר מצלמות"
              onChange={(ev) => setInput({ ...input, cameraCount: Number(ev.target.value) })}
            />
          </label>

          <label className="mkt-calc-slider">
            <span>
              ימי הקלטה <strong>{input.retentionDays}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={180}
              value={input.retentionDays}
              aria-label="ימי הקלטה"
              onChange={(ev) => setInput({ ...input, retentionDays: Number(ev.target.value) })}
            />
          </label>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">רזולוציה (מגה־פיקסל)</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="רזולוציה">
              {RES_OPTIONS.map((mp) => (
                <button
                  key={mp}
                  type="button"
                  className={`mkt-btn ${input.resolutionMp === mp ? "mkt-btn-primary" : "mkt-btn-secondary"}`}
                  aria-pressed={input.resolutionMp === mp}
                  onClick={() => setInput({ ...input, resolutionMp: mp })}
                >
                  {mp}MP
                </button>
              ))}
            </div>
          </fieldset>

          <Select
            id="rec-mode"
            label="אופן הקלטה"
            value={input.recordingMode ?? "continuous"}
            onChange={(ev) =>
              setInput({
                ...input,
                recordingMode: ev.target.value as PublicQuickStorageInput["recordingMode"],
              })
            }
          >
            <option value="continuous">רציפה (24/7)</option>
            <option value="scheduled">לפי לוח שעות</option>
            <option value="motion">תנועה</option>
          </Select>

          {input.recordingMode === "scheduled" ? (
            <label className="mkt-calc-slider">
              <span>
                שעות ביום <strong>{input.recordingHoursPerDay ?? 12}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={24}
                step={0.5}
                value={input.recordingHoursPerDay ?? 12}
                aria-label="שעות הקלטה ביום"
                onChange={(ev) => setInput({ ...input, recordingHoursPerDay: Number(ev.target.value) })}
              />
            </label>
          ) : null}

          {input.recordingMode === "motion" ? (
            <label className="mkt-calc-slider">
              <span>
                אחוז תנועה <strong>{Math.round((input.motionDutyCycle ?? 0.3) * 100)}%</strong>
              </span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={input.motionDutyCycle ?? 0.3}
                aria-label="אחוז זמן תנועה"
                onChange={(ev) => setInput({ ...input, motionDutyCycle: Number(ev.target.value) })}
              />
            </label>
          ) : null}

          <div className="mkt-disk-viz" aria-live="polite">
            {ok ? (
              <>
                <p className="m-0 text-sm">
                  נפח נדרש: <strong>{formatTbWithUnit(requiredTb)}</strong>
                </p>
                <p className="mt-2 m-0 text-sm">
                  ערוצי NVR מומלצים: <strong>{formatChannelsHe(result.recorder.channels)}</strong>
                </p>
                <p className="mt-2 m-0 text-sm">
                  דיסק מומלץ:{" "}
                  <strong>{formatDiskWithUnit(result.hdd.driveCount, result.hdd.recommendedTbPerDrive)}</strong>
                </p>
                <div className="mkt-disk-bar mt-3" aria-hidden>
                  <span style={{ width: `${diskFill}%` }} />
                </div>
                <p className="mt-2 m-0 text-xs text-[var(--mkt-muted)]">ויזואליזציית קיבולת יחסית · בלי מחירים</p>
              </>
            ) : (
              <p className="m-0 text-sm text-destructive">לא ניתן לחשב עם הפרמטרים הנוכחיים.</p>
            )}
          </div>

          <Button
            type="button"
            className="min-h-12"
            onClick={persist}
            disabled={!ok}
          >
            שמירת טיוטה לחישוב
          </Button>
        </div>

        <Link
          to="/register"
          className="mkt-btn mkt-btn-primary mt-6"
          onClick={() => {
            persist();
            trackMarketingEvent("signup_start", { from: "cctv_calculator" });
          }}
        >
          הפכו את התוצאה להצעת מחיר באמצעות SITE SECURE
        </Link>
      </div>
    </MarketingShell>
  );
}
