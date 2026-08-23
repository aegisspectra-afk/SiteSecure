import { describe, expect, it } from "vitest";
import {
  addressFromForm,
  addressSearchBlob,
  formatAddressLine,
  formatAddressLines,
  hasAddress,
  mapsSearchUrl,
  parseAddress,
} from "../src/lib/address";
import { pickCustomerNextLead, buildCustomerActivity } from "../src/lib/customer-profile";
import { customerMatchesDirectoryQuery } from "../src/lib/customer-directory";

describe("structured address", () => {
  it("formats structured address without empty rows", () => {
    const raw = {
      street: "אריה בן אליעזר",
      house_number: "1",
      city: "פתח תקווה",
      floor: "4",
    };
    expect(formatAddressLines(raw)).toEqual(["אריה בן אליעזר 1", "פתח תקווה", "קומה 4"]);
    expect(formatAddressLine(raw)).toContain("אריה בן אליעזר 1");
    expect(hasAddress(raw)).toBe(true);
    expect(hasAddress({})).toBe(false);
    expect(hasAddress(null)).toBe(false);
  });

  it("keeps legacy line addresses readable", () => {
    expect(formatAddressLines({ line: "רחוב ישן 12" })).toEqual(["רחוב ישן 12"]);
    expect(parseAddress({ line: "  x  " }).line).toBe("x");
  });

  it("persists only non-empty fields", () => {
    expect(
      addressFromForm({
        street: " אריה ",
        house_number: "1",
        city: "פתח תקווה",
        floor: "4",
        apartment: "  ",
      }),
    ).toEqual({
      street: "אריה",
      house_number: "1",
      city: "פתח תקווה",
      floor: "4",
    });
    expect(addressFromForm({ street: "  " })).toBeUndefined();
  });

  it("builds maps search url", () => {
    const url = mapsSearchUrl({ street: "אריה בן אליעזר", house_number: "1", city: "פתח תקווה" });
    expect(url).toContain("maps/search");
    expect(url).toContain(encodeURIComponent("אריה בן אליעזר"));
  });
});

describe("customer 360 helpers", () => {
  it("picks next lead only when next_action exists", () => {
    expect(
      pickCustomerNextLead([
        {
          id: "1",
          workspace_id: "w",
          title: "A",
          status: "visit_scheduling",
          source: "manual",
          created_at: "2026-08-23T19:00:00Z",
          updated_at: "2026-08-23T19:00:00Z",
        },
        {
          id: "2",
          workspace_id: "w",
          title: "B",
          status: "visit_scheduling",
          source: "manual",
          next_action: "תיאום ביקור",
          created_at: "2026-08-23T19:00:00Z",
          updated_at: "2026-08-23T19:00:00Z",
        },
      ])?.id,
    ).toBe("2");
    expect(
      pickCustomerNextLead([
        {
          id: "1",
          workspace_id: "w",
          title: "A",
          status: "won",
          source: "manual",
          next_action: "x",
          created_at: "2026-08-23T19:00:00Z",
          updated_at: "2026-08-23T19:00:00Z",
        },
      ]),
    ).toBeNull();
  });

  it("builds activity including leads", () => {
    const events = buildCustomerActivity({
      customer: {
        id: "c1",
        workspace_id: "w",
        display_name: "שנידי הלר",
        type: "private",
        status: "active",
        created_at: "2026-08-23T19:21:00Z",
        updated_at: "2026-08-23T19:21:00Z",
      },
      sites: [],
      quotes: [],
      projects: [],
      serviceCalls: [],
      leads: [
        {
          id: "l1",
          workspace_id: "w",
          title: "מערכת מצלמות",
          status: "visit_scheduling",
          source: "manual",
          created_at: "2026-08-23T20:10:00Z",
          updated_at: "2026-08-23T20:10:00Z",
        },
      ],
    });
    expect(events.some((e) => e.label.includes("מערכת מצלמות"))).toBe(true);
    expect(events.some((e) => e.label.includes("שנידי"))).toBe(true);
  });
});

describe("directory address search", () => {
  it("matches customer or site address without N+1", () => {
    const row = {
      id: "c1",
      workspace_id: "w",
      display_name: "שנידי הלר",
      type: "private",
      status: "active",
      phone: "0585378423",
      billing_address: {},
      counts: { sites: 1, quotes: 0, projects: 0, service: 0, leads: 0, leadsNeedingAttention: 0 },
    };
    const sites = [
      {
        id: "s1",
        workspace_id: "w",
        customer_id: "c1",
        code: "S1",
        name: "דירה",
        address: { street: "אריה בן אליעזר", house_number: "1", city: "פתח תקווה", floor: "4" },
        installation_status: "planned",
      },
    ];
    expect(customerMatchesDirectoryQuery(row, "פתח תקווה", sites)).toBe(true);
    expect(customerMatchesDirectoryQuery(row, "טל אביב", sites)).toBe(false);
    expect(addressSearchBlob(sites[0]!.address)).toContain("אריה");
  });
});
