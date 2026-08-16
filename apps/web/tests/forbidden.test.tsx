import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequirePermission } from "../src/components/settings/RequirePermission";
import { he } from "../src/i18n/he";

const membership = {
  role_key: "technician",
  features: ["core", "crm", "settings"],
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: { memberships: [membership] },
  }),
}));

describe("RequirePermission", () => {
  it("returns 403 for a known Users URL when the role cannot users.view", () => {
    render(
      <RequirePermission permission="users.view">
        <p>directory</p>
      </RequirePermission>,
    );
    expect(screen.getByText(he.forbiddenTitle)).toBeInTheDocument();
    expect(screen.getByText(he.forbiddenBody)).toBeInTheDocument();
    expect(screen.queryByText("directory")).not.toBeInTheDocument();
  });
});
