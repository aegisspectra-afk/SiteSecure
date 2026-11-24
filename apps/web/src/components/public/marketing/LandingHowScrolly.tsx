import { useEffect, useRef, useState } from "react";
import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

const steps = ssMarketing.howSteps;

/** Scrollytelling how-it-works: sticky device + progress; step 2 shows WhatsApp→quote→alternatives. */
export function LandingHowScrolly() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-how-step]"));
    if (!panels.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setActive(0);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.howStep);
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { root: null, threshold: [0.35, 0.55, 0.7], rootMargin: "-20% 0px -35% 0px" },
    );
    panels.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const step = steps[active] ?? steps[0];
  const progress = ((active + 1) / steps.length) * 100;

  return (
    <section id="how" ref={rootRef} className="landing-how public-scene scroll-mt-24 px-4 py-12 sm:py-14">
      <div className="public-container mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.howTitle}</h2>

        <div className="landing-how-layout mt-10">
          <ol className="landing-how-steps">
            {steps.map((s, i) => (
              <li key={s.title} data-how-step={i} className={`landing-how-step${i === active ? " is-active" : ""}`}>
                <p className="public-mono text-xs text-fg-muted">{`0${i + 1}`}</p>
                <h3 className="text-lg font-semibold text-fg sm:text-xl">{s.title}</h3>
                <p className="mt-2 text-base leading-7 text-fg-muted sm:text-[17px]">{s.body}</p>
                {i === 1 ? <StepTwoFlow /> : null}
              </li>
            ))}
          </ol>

          <aside className="landing-how-sticky" aria-live="polite">
            <div className="landing-how-progress" aria-hidden>
              <div className="landing-how-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className={`landing-how-device${active === 2 ? " is-phone" : ""}`}>
              {active === 1 ? (
                <StepTwoDevice />
              ) : (
                <figure className="landing-how-shot">
                  <img
                    src={step.shot.replace(/\.jpg$/i, ".webp")}
                    alt={step.shotAlt}
                    width={active === 2 ? 390 : 1440}
                    height={active === 2 ? 844 : 900}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{step.title}</figcaption>
                </figure>
              )}
            </div>
            <p className="landing-how-sticky-label">
              צעד {active + 1} מתוך {steps.length}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

function StepTwoFlow() {
  return (
    <ol className="landing-how-flow mt-4">
      <li>הודעת וואטסאפ עם קישור להצעה</li>
      <li>עמוד הצעה ללקוח</li>
      <li>בחירת חלופה (בסיסי / מומלץ / מתקדם)</li>
    </ol>
  );
}

function StepTwoDevice() {
  return (
    <div className="landing-how-step2" dir="rtl">
      <div className="landing-how-step2-wa">
        <p className="landing-how-step2-wa-label">וואטסאפ</p>
        <div className="landing-how-step2-bubble">
          שלום, ההצעה לסיור המצלמות מוכנה לצפייה:
          <a href="#how">site-secure.app/q/…</a>
        </div>
      </div>
      <div className="landing-how-step2-quote">
        <p className="landing-how-step2-q-title">הצעה ללקוח</p>
        <ul>
          <li className="is-alt">בסיסי</li>
          <li className="is-alt is-pick">מומלץ</li>
          <li className="is-alt">מתקדם</li>
        </ul>
      </div>
    </div>
  );
}
