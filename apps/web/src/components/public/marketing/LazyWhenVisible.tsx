import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mount children only when near viewport — keeps below-fold JS off the critical path. */
export function LazyWhenVisible({
  children,
  minHeight = "20rem",
  rootMargin = "180px 0px",
  className = "",
}: {
  children: ReactNode;
  minHeight?: string;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, show]);

  return (
    <div
      ref={ref}
      className={`landing-reveal${show ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={show ? undefined : { minHeight }}
    >
      {show ? children : null}
    </div>
  );
}
