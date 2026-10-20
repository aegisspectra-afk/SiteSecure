import { cn } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { CalendarClock, QrCode, Shield, Truck, type LucideIcon } from "lucide-react";
import type { PublicCapabilityStatus, PublicProductId } from "../../i18n/public";
import { usePublicCopy, usePublicLocale } from "./PublicLocaleProvider";

const PRODUCT_ICONS: Record<PublicProductId, LucideIcon> = {
  site_secure: Shield,
  ssp: QrCode,
  fleet: Truck,
  scheduling: CalendarClock,
};

const PRODUCT_SHOTS: Partial<Record<PublicProductId, string>> = {
  site_secure: "/landing-v2/01-quote-builder-desktop.jpg",
};

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

export function HeroStage() {
  const t = usePublicCopy();
  return (
    <div className="public-hero-stage">
      <ProductShot
        src="/landing-v2/01-quote-builder-desktop.jpg"
        alt={t.heroShotAlt}
        label={t.heroShotLabel}
        variant="hero"
        priority
      />
      <div className="public-hero-stage-secondary">
        <ProductShot
          src="/landing-v2/03-site-file-desktop.jpg"
          alt={t.heroStageAlt}
          label={t.heroStageLabel}
          variant="desktop"
        />
      </div>
    </div>
  );
}

export function OpsFlowStrip() {
  const t = usePublicCopy();
  const { dir } = usePublicLocale();
  const arrow = dir === "rtl" ? "←" : "→";
  return (
    <nav aria-label={t.flowTitle} className="public-flow-strip" dir={dir}>
      <ol className="public-flow-list">
        {t.flowSteps.map((step, i) => (
          <li key={step} className="public-flow-item">
            <span className="public-flow-step">{step}</span>
            {i < t.flowSteps.length - 1 ? (
              <span className="public-flow-arrow public-mono text-fg-muted" aria-hidden>
                {arrow}
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
        <p className="public-mono text-[11px] tracking-[0.18em] text-action">{t.frictionAfterLabel}</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {t.frictionAfter.map((item) => (
            <li key={item} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
              <span className="text-sm text-fg sm:text-[15px]">{item}</span>
              <span className="size-1.5 shrink-0 rounded-full bg-action" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm leading-6 text-fg-muted lg:col-span-2">{t.frictionNote}</p>
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

function statusClass(status: string): string {
  if (status === "in_development") return "is-dev";
  if (status === "planned") return "is-planned";
  return "is-live";
}

function capabilityLabel(status: PublicCapabilityStatus, t: ReturnType<typeof usePublicCopy>): string {
  if (status === "in_development") return t.statusInDevelopment;
  if (status === "planned") return t.statusPlanned;
  return t.statusAvailable;
}

export function ProductGrid() {
  const t = usePublicCopy();
  return (
    <ul className="public-product-grid">
      {t.productCards.map((card) => {
        const Icon = PRODUCT_ICONS[card.id];
        const shot = PRODUCT_SHOTS[card.id];
        return (
          <li key={card.id} id={`product-${card.id}`} className="public-product-card" data-product={card.id}>
            <div className="public-product-card-top">
              <span className="public-product-icon" aria-hidden>
                <Icon className="size-5" />
              </span>
              <span className={cn("public-product-status", statusClass(card.status))}>{card.statusLabel}</span>
            </div>
            <p className="public-product-name">{card.name}</p>
            <p className="public-product-role">{card.role}</p>
            <p className="public-product-desc">{card.description}</p>
            <ul className="public-product-benefits">
              {card.benefits.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {shot ? (
              <div className="public-product-shot">
                <img src={shot} alt={t.quoteShotAlt} width={1440} height={900} loading="lazy" decoding="async" />
              </div>
            ) : null}
            {card.href && card.cta ? (
              <a href={card.href} className="public-product-link">
                {card.cta}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ComplementStrip() {
  const t = usePublicCopy();
  return (
    <div className="public-complement">
      <h3 className="public-complement-title">{t.flowComplementTitle}</h3>
      <p className="public-complement-sub">{t.flowComplementSub}</p>
      <ul className="public-complement-grid">
        {t.flowComplement.map((item) => (
          <li key={item.name} className="public-complement-card">
            <p className="public-mono text-[11px] tracking-[0.16em] text-fg-muted">{item.name}</p>
            <p className="mt-2 text-[15px] leading-6 text-fg">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SolutionGroups() {
  const t = usePublicCopy();
  return (
    <div>
      <p className="public-mono mb-5 text-[11px] tracking-[0.16em] text-fg-muted">{t.capabilityLegend}</p>
      <ul className="public-solution-grid">
        {t.solutionGroups.map((group) => (
          <li key={group.id} id={group.id} className="public-solution-card scroll-mt-24">
            <h3 className="public-solution-title">{group.title}</h3>
            <ul className="public-solution-items">
              {group.items.map((item) => (
                <li key={item.text} className={cn("public-solution-item", statusClass(item.status))}>
                  <span>{item.text}</span>
                  <span className={cn("public-capability-status", statusClass(item.status))}>
                    {capabilityLabel(item.status, t)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
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
