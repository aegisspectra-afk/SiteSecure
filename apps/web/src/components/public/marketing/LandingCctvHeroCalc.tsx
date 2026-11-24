import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  calculatePublicQuickStorage,
  HERO_CCTV_DEFAULTS,
  type PublicQuickStorageInput,
} from "@site-secure/cctv-sizing";
import { formatChannelsHe, formatDiskWithUnit, formatTbWithUnit } from "../../../lib/cctv-storage-display";
import { savePublicCctvDraft } from "../../../lib/public-cctv-draft";

const RES_OPTIONS = [2, 4, 5, 8] as const;

/** Live CCTV sizing in-browser — same shared engine as the server (no API, no prices). */
export function LandingCctvHeroCalc() {
  const [input, setInput] = useState<PublicQuickStorageInput>({ ...HERO_CCTV_DEFAULTS });

  const result = useMemo(() => calculatePublicQuickStorage(input), [input]);
  const ok = result.storage.status === "ok";

  const draftPayload = {
    camera_count: input.cameraCount,
    resolution_mp: input.resolutionMp,
    retention_days: input.retentionDays,
    recording_mode: input.recordingMode ?? "continuous",
    codec: input.codec ?? "h265",
  };

  return (
    <div className="landing-cctv-calc" dir="rtl">
      <p className="landing-cctv-calc-kicker">מחשבון אחסון CCTV · חי</p>

      <label className="landing-cctv-calc-field">
        <span className="landing-cctv-calc-label">
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

      <label className="landing-cctv-calc-field">
        <span className="landing-cctv-calc-label">
          ימי הקלטה <strong>{input.retentionDays}</strong>
        </span>
        <input
          type="range"
          min={1}
          max={90}
          value={input.retentionDays}
          aria-label="ימי הקלטה"
          onChange={(ev) => setInput({ ...input, retentionDays: Number(ev.target.value) })}
        />
      </label>

      <fieldset className="landing-cctv-calc-res">
        <legend className="landing-cctv-calc-label">רזולוציה (מגה־פיקסל)</legend>
        <div className="landing-cctv-calc-res-row" role="group" aria-label="רזולוציה">
          {RES_OPTIONS.map((mp) => (
            <button
              key={mp}
              type="button"
              className={`landing-cctv-calc-chip${input.resolutionMp === mp ? " is-active" : ""}`}
              aria-pressed={input.resolutionMp === mp}
              onClick={() => setInput({ ...input, resolutionMp: mp })}
            >
              {mp}MP
            </button>
          ))}
        </div>
      </fieldset>

      <div className="landing-cctv-calc-out" aria-live="polite">
        {ok ? (
          <ul className="landing-cctv-calc-metrics">
            <li>
              <span>נפח</span>
              <strong>{formatTbWithUnit(result.storage.requiredTb ?? 0)}</strong>
            </li>
            <li>
              <span>דיסק</span>
              <strong>{formatDiskWithUnit(result.hdd.driveCount, result.hdd.recommendedTbPerDrive)}</strong>
            </li>
            <li>
              <span>NVR</span>
              <strong>{formatChannelsHe(result.recorder.channels)}</strong>
            </li>
          </ul>
        ) : (
          <p className="landing-cctv-calc-pending">בדקו את ערכי הקלט</p>
        )}
      </div>

      <Link
        to="/register"
        className="landing-cctv-calc-cta"
        onClick={() => savePublicCctvDraft(draftPayload)}
      >
        הפוך להצעת מחיר
      </Link>
    </div>
  );
}
