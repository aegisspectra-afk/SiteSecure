import { useId, useMemo, useState } from "react";
import { calculatePublicQuickStorage, HERO_CCTV_DEFAULTS } from "@site-secure/cctv-sizing";
import { formatChannelsHe, formatDiskWithUnit, formatTbWithUnit } from "../../../lib/cctv-storage-display";
import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

/** Before/after: messy WhatsApp-style chat vs SITE SECURE quote screen. Same problem copy. */
export function LandingBeforeAfter() {
  const id = useId();
  const [pos, setPos] = useState(52);

  return (
    <section id="problem" className="public-scene landing-section landing-reveal scroll-mt-24 px-4">
      <div className="public-container mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{ssMarketing.problemTitle}</h2>
        <ul className="mt-6 flex flex-col gap-3 text-base leading-8 text-fg-muted sm:text-[17px]">
          {ssMarketing.problemLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="landing-ba mt-10" style={{ ["--ba-pos" as string]: `${pos}%` }}>
          <div className="landing-ba-frame" aria-labelledby={`${id}-label`}>
            <p id={`${id}-label`} className="sr-only">
              השוואה: וואטסאפ מבולגן מול SITE SECURE — גררו את הסליידר
            </p>
            <div className="landing-ba-panel is-before" aria-hidden={pos <= 2}>
              <WhatsAppMessyMock />
            </div>
            <div className="landing-ba-panel is-after" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <SiteSecureQuoteMock />
            </div>
            <div className="landing-ba-handle" style={{ insetInlineStart: `${pos}%` }} aria-hidden>
              <span />
            </div>
            <input
              type="range"
              className="landing-ba-range"
              min={4}
              max={96}
              value={pos}
              aria-label="השוואת לפני ואחרי"
              onChange={(ev) => setPos(Number(ev.target.value))}
            />
          </div>
          <div className="landing-ba-captions" aria-hidden>
            <span>וואטסאפ + אקסל</span>
            <span>SITE SECURE</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppMessyMock() {
  return (
    <div className="landing-wa" dir="rtl">
      <header className="landing-wa-head">קבוצת ועד · סיור מצלמות</header>
      <div className="landing-wa-thread">
        <div className="landing-wa-bubble is-in">
          מישהו זוכר כמה מצלמות סיכמנו על החניה?
          <time>09:12</time>
        </div>
        <div className="landing-wa-bubble is-out">
          יש לי באקסל… רגע, זה גרסה ישנה
          <time>09:14</time>
        </div>
        <div className="landing-wa-bubble is-in">
          📷 תמונה מהסיור (3)
          <time>09:18</time>
        </div>
        <div className="landing-wa-bubble is-out">
          שלחתי PDF אבל זה לא מעודכן אחרי השינוי ב־NVR
          <time>10:02</time>
        </div>
        <div className="landing-wa-bubble is-in">
          והעבודה אתמול — מי סוגר חיוב?
          <time>18:41</time>
        </div>
      </div>
    </div>
  );
}

function SiteSecureQuoteMock() {
  const sized = useMemo(() => calculatePublicQuickStorage(HERO_CCTV_DEFAULTS), []);
  const volume = formatTbWithUnit(sized.storage.requiredTb ?? 0);
  const disk = formatDiskWithUnit(sized.hdd.driveCount, sized.hdd.recommendedTbPerDrive);
  const channels = formatChannelsHe(sized.recorder.channels);

  return (
    <div className="landing-ss" dir="rtl">
      <header className="landing-ss-head">
        <span>הצעה Q-0142</span>
        <span className="landing-ss-badge">טיוטה</span>
      </header>
      <div className="landing-ss-body">
        <p className="landing-ss-title">מערכת CCTV — חניה + לובי</p>
        <ul>
          <li>
            {HERO_CCTV_DEFAULTS.cameraCount} מצלמות IP · {HERO_CCTV_DEFAULTS.resolutionMp}MP · {volume}
          </li>
          <li>
            NVR {channels} · דיסק {disk}
          </li>
          <li>חלופות לוועד: בסיסי / מומלץ / מתקדם</li>
        </ul>
        <div className="landing-ss-shots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="landing-ss-foot">תמונות מהסיור מצורפות · מעקב שליחה בוואטסאפ</p>
      </div>
    </div>
  );
}
