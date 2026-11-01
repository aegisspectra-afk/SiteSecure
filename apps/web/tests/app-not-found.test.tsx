import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppNotFound } from "../src/components/AppNotFound";
import { he } from "../src/i18n/he";
import { planLabel } from "../src/lib/app-nav";

describe("Hebrew chrome leftovers", () => {
  it("renders a Hebrew not-found page instead of English Not Found", () => {
    render(<AppNotFound />);
    expect(screen.getByRole("heading", { name: he.pageNotFoundTitle })).toBeInTheDocument();
    expect(screen.getByText(he.pageNotFoundBody)).toBeInTheDocument();
    expect(screen.queryByText("Not Found")).not.toBeInTheDocument();
  });

  it("labels the solo plan and workspace status in Hebrew", () => {
    expect(he.planSolo).toBe("חינם");
    expect(planLabel("solo")).toBe("חינם");
    expect(he.workspaceMetaActive).toBe("פעיל");
    expect(`${planLabel("solo")} · ${he.workspaceMetaActive}`).toBe("חינם · פעיל");
  });
});
