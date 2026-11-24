import { ssMarketing } from "../../../i18n/site-secure-marketing-he";

/**
 * Founder / field note — hidden until config has both a photo URL and two quote lines.
 * No placeholders are shown to visitors.
 */
export function LandingFounder() {
  const cfg = ssMarketing.founder;
  const ready =
    Boolean(cfg?.photoUrl?.trim()) &&
    Boolean(cfg?.line1?.trim()) &&
    Boolean(cfg?.line2?.trim());
  if (!ready) return null;

  return (
    <section id="field-note" className="landing-founder public-scene scroll-mt-24 px-4 py-12 sm:py-14">
      <div className="public-container mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center">
        <img
          className="landing-founder-photo"
          src={cfg.photoUrl}
          alt={cfg.photoAlt || "המייסד"}
          width={224}
          height={224}
          loading="lazy"
          decoding="async"
        />
        <div>
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{cfg.title}</h2>
          <blockquote className="landing-founder-quote mt-5">
            <p>{cfg.line1}</p>
            <p>{cfg.line2}</p>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
