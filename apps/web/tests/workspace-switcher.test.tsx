import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "../src/components/WorkspaceSwitcher";
import { he } from "../src/i18n/he";

type Membership = {
  workspace_id: string;
  workspace_name: string;
  role_key: string;
  plan_key: string;
  features: string[];
  permissions: string[];
};

const state: { memberships: Membership[] } = { memberships: [] };
const switchWorkspace = vi.fn();

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: { memberships: state.memberships },
    switchWorkspace,
  }),
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    state.memberships = [];
    switchWorkspace.mockReset();
  });

  it("hides when the user has a single workspace", () => {
    state.memberships = [
      {
        workspace_id: "ws-1",
        workspace_name: "Only Co",
        role_key: "owner",
        plan_key: "solo",
        features: [],
        permissions: [],
      },
    ];
    const { container } = render(<WorkspaceSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows when the user has multiple workspaces", () => {
    state.memberships = [
      {
        workspace_id: "ws-1",
        workspace_name: "Alpha",
        role_key: "owner",
        plan_key: "solo",
        features: [],
        permissions: [],
      },
      {
        workspace_id: "ws-2",
        workspace_name: "Beta",
        role_key: "technician",
        plan_key: "business",
        features: [],
        permissions: [],
      },
    ];
    render(<WorkspaceSwitcher />);
    expect(screen.getByLabelText(he.workspaceSwitcherLabel)).toBeInTheDocument();
  });
});
