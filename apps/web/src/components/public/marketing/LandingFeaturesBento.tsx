import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

/** Bento of miniaturized UI tiles — same feature list, visual only. */
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
  return (
    <div className="landing-mini landing-mini-cctv" aria-hidden>
      <div>
        <span>נפח</span>
        <strong>3.2 TB</strong>
      </div>
      <div>
        <span>NVR</span>
        <strong>8 ערוצים</strong>
      </div>
      <div>
        <span>דיסק</span>
        <strong>1× 4 TB</strong>
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
      <p>חוזה תחזוקה ל־«לובי מערב» מסתיים בעוד 21 יום</p>
    </div>
  );
}
