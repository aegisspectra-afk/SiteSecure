import { cn } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { usePublicCopy, usePublicLocale } from "./PublicLocaleProvider";

/** Marketing product frame — real UI snapshot, not a mocked scene. */
export function ProductShot({
  src,
  alt,
  label,
  variant = "desktop",
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  label?: string;
  variant?: "desktop" | "mobile" | "hero";
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("public-shot", `is-${variant}`, className)}>
      {label ? (
        <figcaption className="public-shot-label">
          <span className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{label}</span>
        </figcaption>
      ) : null}
      <div className="public-shot-frame">
        <img
          src={src}
          alt={alt}
          className="public-shot-img"
          width={variant === "mobile" ? 390 : 1440}
          height={variant === "mobile" ? 844 : 900}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
        />
      </div>
    </figure>
  );
}

export function OpsFlowStrip() {
  const t = usePublicCopy();
  return (
    <nav aria-label={t.flowTitle} className="public-flow-strip" dir="ltr">
      <ol className="public-flow-list">
        {t.flowSteps.map((step, i) => (
          <li key={step} className="public-flow-item">
            <span className="public-mono text-[11px] tracking-[0.14em] text-fg sm:text-xs">{step}</span>
            {i < t.flowSteps.length - 1 ? (
              <span className="public-flow-arrow public-mono text-fg-muted" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FrictionStrip() {
  const t = usePublicCopy();
  return (
    <div className="public-friction grid gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="public-friction-before">
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{t.frictionBeforeLabel}</p>
        <ul className="mt-4 flex flex-col gap-2">
          {t.frictionBefore.map((item) => (
            <li key={item} className="public-mono text-sm tracking-[0.08em] text-fg-muted sm:text-[15px]">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="public-friction-after">
        <p className="public-mono text-[11px] tracking-[0.18em] text-action">{t.brand}</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {t.frictionAfter.map((item) => (
            <li key={item} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <span className="text-sm text-fg sm:text-[15px]">{item}</span>
              <span className="size-1.5 shrink-0 rounded-full bg-action" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProofList({ items }: { items: readonly string[] }) {
  return (
    <ul className="public-proof mt-6 max-w-md">
      {items.map((item) => (
        <li key={item} className="public-proof-item">
          <span className="public-proof-mark" aria-hidden />
          <span className="text-[15px] leading-6 text-fg">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SecurityArch() {
  const t = usePublicCopy();
  const { dir } = usePublicLocale();
  return (
    <div dir={dir} className="public-security-grid">
      <ul className="public-security-list">
        {t.securityPillars.map((pillar) => (
          <li key={pillar.title} className="public-security-row">
            <p className="text-[15px] font-medium tracking-[-0.01em] text-fg">{pillar.title}</p>
            <p className="text-sm leading-6 text-fg-muted">{pillar.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link to="/legal/$slug" params={{ slug: "security" }} className="public-cta-secondary">
          {t.securityCta}
        </Link>
      </div>
    </div>
  );
}
