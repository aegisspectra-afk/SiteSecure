import { useEffect } from "react";

/** Subtle reveal for below-fold sections; no-ops when prefers-reduced-motion. */
export function useLandingReveal(rootSelector = ".landing-reveal") {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(rootSelector));
    if (!nodes.length) return;

    if (reduced) {
      nodes.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    nodes.forEach((el) => {
      // Already in view on first paint (e.g. short viewports) — reveal without waiting.
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add("is-in");
      } else {
        io.observe(el);
      }
    });

    return () => io.disconnect();
  }, [rootSelector]);
}
