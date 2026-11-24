import { useEffect } from "react";

/** Subtle reveal for below-fold sections; no-ops when prefers-reduced-motion. */
export function useLandingReveal(rootSelector = ".landing-reveal", watchKey = "") {
  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(rootSelector));
        if (!nodes.length) return;

        if (reduced) {
          nodes.forEach((el) => el.classList.add("is-in"));
          return;
        }

        io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                io?.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
        );

        nodes.forEach((el) => {
          if (el.classList.contains("is-in")) return;
          // Already in view on first paint (e.g. short viewports) — reveal without waiting.
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
            el.classList.add("is-in");
          } else {
            io?.observe(el);
          }
        });
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      io?.disconnect();
    };
  }, [rootSelector, watchKey]);
}
