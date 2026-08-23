import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewLeadSheet } from "../src/components/leads/NewLeadSheet";
import {
  buildLeadRequirements,
  canSaveNewLead,
  customerIdAfterFieldChange,
} from "../src/lib/new-lead";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("new lead helpers", () => {
  it("requires customer_id for existing mode and name for temporary", () => {
    expect(canSaveNewLead({ customerMode: "existing", customerId: "", contactName: "x", newCustomerName: "" })).toBe(false);
    expect(canSaveNewLead({ customerMode: "existing", customerId: "c1", contactName: "", newCustomerName: "" })).toBe(true);
    expect(canSaveNewLead({ customerMode: "none", customerId: "", contactName: "", newCustomerName: "" })).toBe(false);
    expect(canSaveNewLead({ customerMode: "none", customerId: "", contactName: "שנידי", newCustomerName: "" })).toBe(true);
    expect(canSaveNewLead({ customerMode: "new", customerId: "", contactName: "", newCustomerName: "לקוח" })).toBe(true);
  });

  it("keeps customer_id when other fields change", () => {
    expect(customerIdAfterFieldChange("c1", "priority")).toBe("c1");
    expect(customerIdAfterFieldChange("c1", "service")).toBe("c1");
  });

  it("builds service-specific requirements", () => {
    expect(
      buildLeadRequirements(
        "cctv",
        {
          cameraCount: "9",
          location: "indoor",
          infrastructure: "new",
          recording: true,
          remoteViewing: true,
        },
        {
          systemType: "",
          zoneCount: "",
          detectors: "",
          magnets: false,
          siren: false,
          app: false,
        },
      ),
    ).toEqual({
      camera_count: 9,
      location: "פנים",
      infrastructure: "חדשה",
      recording: true,
      remote_viewing: true,
    });

    expect(
      buildLeadRequirements(
        "alarm",
        {
          cameraCount: "9",
          location: "indoor",
          infrastructure: "new",
          recording: true,
          remoteViewing: true,
        },
        {
          systemType: "אלחוטי",
          zoneCount: "4",
          detectors: "תנועה",
          magnets: true,
          siren: true,
          app: true,
        },
      ),
    ).toMatchObject({
      system_type: "אלחוטי",
      zone_count: 4,
      detectors: "תנועה",
      magnets: true,
    });

    expect(
      buildLeadRequirements(
        "access_control",
        {
          cameraCount: "9",
          location: "indoor",
          infrastructure: "new",
          recording: true,
          remoteViewing: true,
        },
        {
          systemType: "x",
          zoneCount: "1",
          detectors: "",
          magnets: false,
          siren: false,
          app: false,
        },
      ),
    ).toBeUndefined();
  });
});

describe("NewLeadSheet existing customer selection", () => {
  it("searches, selects, and keeps customer while changing opportunity fields", async () => {
    const customers = [
      {
        id: "c1",
        workspace_id: "w",
        display_name: "שנידי הלר",
        phone: "0585378423",
        email: "shimdurac@gmail.com",
        status: "active",
        type: "private",
      },
    ];

    const api = {
      listCustomers: vi.fn(async () => ({ items: customers })),
      getCustomer: vi.fn(async () => customers[0]),
      listCustomerContacts: vi.fn(async () => [
        { id: "ct1", customer_id: "c1", full_name: "שנידי הלר", phone: "0585378423", is_primary: true },
        { id: "ct2", customer_id: "c1", full_name: "ולריה טרטיאקוב", phone: "0547593911", is_primary: false },
      ]),
      listSites: vi.fn(async () => ({
        items: [
          {
            id: "s1",
            workspace_id: "w",
            customer_id: "c1",
            code: "1",
            name: "דירת 4 חדרים",
            address: { street: "אריה בן אליעזר", house_number: "1", city: "פתח תקווה", floor: "4" },
            installation_status: "planned",
          },
        ],
      })),
      createLead: vi.fn(async (workspaceId: string, body: Record<string, unknown>) => ({
        id: "l1",
        workspace_id: workspaceId,
        title: "מערכת מצלמות",
        status: body.status,
        source: body.source,
        priority: body.priority,
        customer_id: body.customer_id,
        site_id: body.site_id,
        next_action: body.next_action,
        created_at: "2026-08-23T20:00:00Z",
        updated_at: "2026-08-23T20:00:00Z",
      })),
      createCustomer: vi.fn(),
      createSite: vi.fn(),
    };

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <NewLeadSheet
          open
          onClose={() => undefined}
          workspaceId="w"
          api={api as never}
          canCreateCustomer
          canCreateSite
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText("לקוח קיים"));

    const search = await screen.findByTestId("lead-customer-search");
    fireEvent.change(search, { target: { value: "שנידי" } });

    await waitFor(() => expect(api.listCustomers).toHaveBeenCalled());
    const result = await screen.findByTestId("lead-customer-result-c1");
    fireEvent.click(result);

    expect(await screen.findByTestId("lead-selected-customer")).toBeTruthy();
    expect(screen.getByText("שנידי הלר")).toBeTruthy();
    expect(screen.getByText("0585378423")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("עדיפות"), { target: { value: "urgent" } });
    fireEvent.change(screen.getByLabelText("סוג שירות"), { target: { value: "alarm" } });
    expect(screen.getByTestId("lead-selected-customer")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("אתר קיים"));
    const siteBtn = await screen.findByText("דירת 4 חדרים");
    fireEvent.click(siteBtn);
    expect(await screen.findByTestId("lead-selected-site")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("פעולה הבאה"), {
      target: { value: "תיאום ביקור מחר אחר הצהריים" },
    });

    fireEvent.click(screen.getByRole("button", { name: "שמירת ליד" }));

    await waitFor(() =>
      expect(api.createLead).toHaveBeenCalledWith(
        "w",
        expect.objectContaining({
          customer_id: "c1",
          site_id: "s1",
          priority: "urgent",
          service_type: "alarm",
          next_action: "תיאום ביקור מחר אחר הצהריים",
          contact_name: "שנידי הלר",
        }),
      ),
    );
  });

  it("allows temporary lead without customer_id", async () => {
    const api = {
      listCustomers: vi.fn(async () => ({ items: [] })),
      getCustomer: vi.fn(),
      listCustomerContacts: vi.fn(),
      listSites: vi.fn(),
      createLead: vi.fn(async () => ({
        id: "l2",
        workspace_id: "w",
        title: "ליד",
        status: "visit_scheduling",
        source: "whatsapp",
        created_at: "2026-08-23T20:00:00Z",
        updated_at: "2026-08-23T20:00:00Z",
      })),
      createCustomer: vi.fn(),
      createSite: vi.fn(),
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <NewLeadSheet
          open
          onClose={() => undefined}
          workspaceId="w"
          api={api as never}
          canCreateCustomer
          canCreateSite
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText("ללא לקוח (זמני)"));
    fireEvent.change(screen.getByLabelText("שם מלא"), { target: { value: "ליד זמני" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת ליד" }));

    await waitFor(() =>
      expect(api.createLead).toHaveBeenCalledWith(
        "w",
        expect.objectContaining({
          contact_name: "ליד זמני",
        }),
      ),
    );
    const body = (api.createLead as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      | { customer_id?: string }
      | undefined;
    expect(body?.customer_id).toBeUndefined();
  });
});
