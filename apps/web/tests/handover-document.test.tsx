import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HandoverDocument } from "../src/components/public/HandoverDocument";
import { publicPlatformMarketingHref } from "../src/components/public/PublicPlatformFooter";

describe("HandoverDocument branding", () => {
  it("renders installer brand, accent, equipment and SITE SECURE footer with utm", () => {
    render(
      <HandoverDocument
        data={{
          company: {
            brand_name: "אלפא אבטחה",
            logo_url: "https://example.com/logo.png",
            brand_primary: "#0b6e4f",
            phone: "03-1234567",
          },
          customer_name: "לקוח בדיקה",
          site_name: "אתר ראשי",
          technician_name: "יוסי",
          completed_at: "17.11.2026",
          warranty_label: "12 חודשים",
          equipment: [{ name: "מצלמת כיפה", qty: 4 }],
        }}
      />,
    );

    expect(screen.getByText("אלפא אבטחה")).toBeTruthy();
    expect(screen.getByText("תעודת מסירה")).toBeTruthy();
    expect(screen.getByText("מצלמת כיפה × 4")).toBeTruthy();
    const credit = screen.getByRole("link", { name: /נוצר ב-SITE SECURE/ });
    expect(credit.getAttribute("href")).toBe(publicPlatformMarketingHref("handover"));
    expect(credit.getAttribute("href")).toContain("utm_source=handover");
    expect(document.querySelector(".handover-doc")?.getAttribute("style")).toContain("#0b6e4f");
  });
});
