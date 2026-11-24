import { calculatePublicQuickStorage } from "@site-secure/cctv-sizing";
import { formatChannelsHe, formatDiskWithUnit, formatTbWithUnit } from "../../../lib/cctv-storage-display";
import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

/** Demo scenario for bento tiles — 8 cams · 4MP · 14 days, values from the shared engine. */
export const BENTO_CCTV_SCENARIO = {
  cameraCount: 8,
  resolutionMp: 4,
  retentionDays: 14,
  recordingMode: "continuous" as const,
  codec: "h265",
};

const BENTO_SITE_NAME = "לובי מערב";
/** Matches typical service-reminder window shown in-product. */
export const BENTO_WARRANTY_DAYS_LEFT = 14;

/** Bento of miniaturized UI tiles — numbers come from the CCTV engine / product rules. */
export function LandingFeaturesBento() {
  return (
    <section id="features" className="landing-bento public-scene public-scene-surface scroll-mt-24 px-4 py-12 sm:py-14">
      <div className="public-container mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.featuresTitle}</h2>
        <div className="landing-bento-grid mt-8">
          <article className="landing-bento-tile is-wide">
            <h3>{ssMarketing.features[0]}</h3>
            <MiniCctvResult />
          </article>
          <article className="landing-bento-tile">
            <h3>{ssMarketing.features[1]}</h3>
            <MiniAlternatives />
          </article>
          <article className="landing-bento-tile">
            <h3>{ssMarketing.features[2]}</h3>
            <MiniChecklist />
          </article>
          <article className="landing-bento-tile">
            <h3>{ssMarketing.features[3]}</h3>
            <MiniHandover />
          </article>
          <article className="landing-bento-tile is-wide">
            <h3>{ssMarketing.features[4]}</h3>
            <MiniWarrantyAlert />
          </article>
        </div>
      </div>
    </section>
  );
}

function MiniCctvResult() {
  const result = calculatePublicQuickStorage(BENTO_CCTV_SCENARIO);
  const tb = result.storage.requiredTb ?? 0;
  return (
    <div className="landing-mini landing-mini-cctv" aria-hidden>
      <p className="landing-mini-cctv-scenario">
        {BENTO_CCTV_SCENARIO.cameraCount} מצלמות · {BENTO_CCTV_SCENARIO.resolutionMp}MP ·{" "}
        {BENTO_CCTV_SCENARIO.retentionDays} יום
      </p>
      <div>
        <span>נפח</span>
        <strong>{formatTbWithUnit(tb)}</strong>
      </div>
      <div>
        <span>דיסק</span>
        <strong>{formatDiskWithUnit(result.hdd.driveCount, result.hdd.recommendedTbPerDrive)}</strong>
      </div>
      <div>
        <span>NVR</span>
        <strong>{formatChannelsHe(result.recorder.channels)}</strong>
      </div>
    </div>
  );
}

function MiniAlternatives() {
  return (
    <ul className="landing-mini landing-mini-alts" aria-hidden>
      <li>בסיסי</li>
      <li className="is-pick">מומלץ</li>
      <li>מתקדם</li>
    </ul>
  );
}

function MiniChecklist() {
  return (
    <ul className="landing-mini landing-mini-check" aria-hidden>
      <li className="is-done">הגעת לאתר</li>
      <li className="is-done">התקנת מצלמות</li>
      <li>חתימת לקוח</li>
    </ul>
  );
}

function MiniHandover() {
  return (
    <div className="landing-mini landing-mini-hand" aria-hidden>
      <p className="landing-mini-hand-brand">המותג שלכם</p>
      <p className="landing-mini-hand-title">תעודת מסירה</p>
      <p className="landing-mini-hand-meta">חתימה · ציוד · תאריך</p>
    </div>
  );
}

function MiniWarrantyAlert() {
  return (
    <div className="landing-mini landing-mini-warranty" aria-hidden>
      <p className="landing-mini-warranty-tag">תזכורת שירות</p>
      <p>
        האחריות ל&lsquo;{BENTO_SITE_NAME}&rsquo; מסתיימת בעוד {BENTO_WARRANTY_DAYS_LEFT} יום
      </p>
    </div>
  );
}
