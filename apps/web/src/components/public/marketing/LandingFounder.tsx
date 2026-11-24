/** Founder/field note — marked placeholders until real copy/photo land. */
export function LandingFounder() {
  return (
    <section id="field-note" className="landing-founder public-scene scroll-mt-24 px-4 py-12 sm:py-14">
      <div className="public-container mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center">
        <div
          className="landing-founder-photo"
          role="img"
          aria-label="מקום לתמונת המייסד — עדיין לא הועלתה"
        >
          <span>[תמונת מייסד — להשלמה]</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">נבנה על ידי אנשי שטח</h2>
          <blockquote className="landing-founder-quote mt-5">
            <p>[משפט ראשון מהמייסד — להשלמה]</p>
            <p>[משפט שני מהמייסד — להשלמה]</p>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
