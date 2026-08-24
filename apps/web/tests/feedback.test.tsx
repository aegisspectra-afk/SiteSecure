import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackCenter } from "../src/components/FeedbackCenter";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  useRouterState: (opts: { select: (s: { location: { pathname: string; searchStr: string } }) => string }) =>
    opts.select({ location: { pathname: "/app", searchStr: "" } }),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: {
      listFeedback: vi.fn(async () => []),
      createFeedback: vi.fn(),
    },
    session: {
      memberships: [{ workspace_id: "ws-1", role_key: "technician", plan_key: "solo", features: [], is_beta: false }],
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

describe("FeedbackCenter", () => {
  it("exposes a real feedback button for any workspace member", () => {
    render(
      <Wrapper>
        <FeedbackCenter />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: he.feedbackOpen })).toBeInTheDocument();
  });
});
