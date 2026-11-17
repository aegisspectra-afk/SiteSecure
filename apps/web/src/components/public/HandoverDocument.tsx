import type { CSSProperties } from "react";
import { PublicPlatformFooter } from "./PublicPlatformFooter";
import { he } from "../../i18n/he";

export type HandoverCompanyBrand = {
  brand_name?: string | null;
  name?: string | null;
  logo_url?: string | null;
  brand_primary?: string | null;
  phone?: string | null;
};

export type HandoverDocumentData = {
  company: HandoverCompanyBrand;
  customer_name?: string | null;
  site_name?: string | null;
  site_address?: string | null;
  technician_name?: string | null;
  completed_at?: string | null;
  equipment?: Array<{ name: string; qty?: number | null }>;
  warranty_label?: string | null;
};

/** Presentational public handover certificate — installer branding + SITE SECURE footer. */
export function HandoverDocument({ data }: { data: HandoverDocumentData }) {
  const brand = data.company.brand_name || data.company.name || he.brand;
  const accent = data.company.brand_primary?.trim() || undefined;

  return (
    <article
      className="handover-doc"
      data-testid="handover-document"
      style={accent ? ({ ["--handover-accent" as string]: accent } as CSSProperties) : undefined}
      dir="rtl"
    >
      <header className="handover-doc-header">
        {data.company.logo_url ? (
          <img className="handover-doc-logo" src={data.company.logo_url} alt="" />
        ) : null}
        <div className="handover-doc-brand-block min-w-0">
          <p className="handover-doc-brand">{brand}</p>
          <p className="handover-doc-kicker">{he.handoverCertificateTitle}</p>
          {data.company.phone ? <p className="handover-doc-phone ltr-meta">{data.company.phone}</p> : null}
        </div>
      </header>

      <dl className="handover-doc-meta">
        {data.customer_name ? (
          <div>
            <dt>{he.handoverCustomer}</dt>
            <dd>{data.customer_name}</dd>
          </div>
        ) : null}
        {data.site_name || data.site_address ? (
          <div>
            <dt>{he.handoverSite}</dt>
            <dd>
              {[data.site_name, data.site_address].filter(Boolean).join(" · ")}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{he.handoverTechnician}</dt>
          <dd>{data.technician_name?.trim() || he.handoverTechnicianUnknown}</dd>
        </div>
        {data.completed_at ? (
          <div>
            <dt>{he.handoverCompletedAt}</dt>
            <dd>{data.completed_at}</dd>
          </div>
        ) : null}
        {data.warranty_label ? (
          <div>
            <dt>{he.handoverWarranty}</dt>
            <dd>{data.warranty_label}</dd>
          </div>
        ) : null}
      </dl>

      {data.equipment && data.equipment.length > 0 ? (
        <section className="handover-doc-equipment" aria-labelledby="handover-equipment-heading">
          <h2 id="handover-equipment-heading" className="handover-doc-section-title">
            {he.handoverEquipmentTitle}
          </h2>
          <ul>
            {data.equipment.map((row, index) => (
              <li key={`${row.name}-${index}`}>
                {row.name}
                {row.qty != null && row.qty !== 1 ? ` × ${row.qty}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PublicPlatformFooter utmSource="handover" />
    </article>
  );
}
