import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  calculatePublicCctvStorage,
  type PublicStorageInput,
  type PublicStorageResult,
} from "../../../lib/public-marketing-api";
import { formatTb } from "../../../lib/cctv-storage-display";
import { savePublicCctvDraft } from "../../../lib/public-cctv-draft";

const RES_OPTIONS = [2, 4, 5, 8] as const;

/** Compact live CCTV sizing — same public API as /tools/cctv-storage. */
export function LandingCctvHeroCalc() {
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

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setErr(null);
      void calculatePublicCctvStorage(input)
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          savePublicCctvDraft(input);
        })
        .catch((e: Error) => {
          if (!cancelled) setErr(e.message);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input]);

  const ok = result?.storage?.status === "ok";

  return (
    <div className="landing-cctv-calc" dir="rtl">
      <p className="landing-cctv-calc-kicker">מחשבון אחסון CCTV · חי</p>

      <label className="landing-cctv-calc-field">
        <span className="landing-cctv-calc-label">
          מצלמות <strong>{input.camera_count}</strong>
        </span>
        <input
          type="range"
          min={1}
          max={64}
          value={input.camera_count}
          aria-label="מספר מצלמות"
          onChange={(ev) => setInput({ ...input, camera_count: Number(ev.target.value) })}
        />
      </label>

      <label className="landing-cctv-calc-field">
        <span className="landing-cctv-calc-label">
          ימי הקלטה <strong>{input.retention_days}</strong>
        </span>
        <input
          type="range"
          min={1}
          max={90}
          value={input.retention_days}
          aria-label="ימי הקלטה"
          onChange={(ev) => setInput({ ...input, retention_days: Number(ev.target.value) })}
        />
      </label>

      <fieldset className="landing-cctv-calc-res">
        <legend className="landing-cctv-calc-label">רזולוציה (מגה־פיקסל)</legend>
        <div className="landing-cctv-calc-res-row" role="group" aria-label="רזולוציה">
          {RES_OPTIONS.map((mp) => (
            <button
              key={mp}
              type="button"
              className={`landing-cctv-calc-chip${input.resolution_mp === mp ? " is-active" : ""}`}
              aria-pressed={input.resolution_mp === mp}
              onClick={() => setInput({ ...input, resolution_mp: mp })}
            >
              {mp}MP
            </button>
          ))}
        </div>
      </fieldset>

      <div className="landing-cctv-calc-out" aria-live="polite">
        {err ? <p className="landing-cctv-calc-err">{err}</p> : null}
        {ok ? (
          <ul className="landing-cctv-calc-metrics">
            <li>
              <span>נפח</span>
              <strong>{formatTb(result.storage.required_tb ?? 0)}</strong>
            </li>
            <li>
              <span>דיסק מומלץ</span>
              <strong>
                {result.hdd.drive_count
                  ? `${result.hdd.drive_count}× ${formatTb(result.hdd.recommended_tb_per_drive ?? 0)}`
                  : "—"}
              </strong>
            </li>
            <li>
              <span>ערוצי NVR</span>
              <strong>{result.recorder.channels ?? "—"}</strong>
            </li>
          </ul>
        ) : (
          <p className="landing-cctv-calc-pending">{busy ? "מחשב…" : "הזיזו סליידר לחישוב"}</p>
        )}
      </div>

      <Link
        to="/register"
        className="landing-cctv-calc-cta"
        onClick={() => savePublicCctvDraft(input)}
      >
        הפוך להצעת מחיר
      </Link>
    </div>
  );
}
