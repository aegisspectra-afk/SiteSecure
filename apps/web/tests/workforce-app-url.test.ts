import { describe, expect, it } from "vitest";
import {
  alignLoopbackOrigin,
  resolveWorkforceAppOrigin,
  workforceAppOrigin,
  workforceAppUrlFromWebPath,
  workforceAppUrlWithSession,
} from "../src/lib/workforce-app-url";

describe("workforce app URL bridge", () => {
  it("defaults to the local WorkForce origin only in development", () => {
    expect(resolveWorkforceAppOrigin(undefined, true)).toBe("http://localhost:5175");
    expect(workforceAppOrigin()).toBe("http://localhost:5175");
  });

  it("does not use localhost as a production WorkForce origin", () => {
    expect(resolveWorkforceAppOrigin(undefined, false)).toBe("");
    expect(resolveWorkforceAppOrigin("http://localhost:5175", false)).toBe("");
    expect(resolveWorkforceAppOrigin("http://127.0.0.1:5175", false)).toBe("");
    expect(resolveWorkforceAppOrigin("https://workforce.example.com", false)).toBe(
      "https://workforce.example.com",
    );
  });

  it("maps leftover Site Secure paths onto the WorkForce app", () => {
    expect(workforceAppUrlFromWebPath("/app/workforce")).toBe("http://localhost:5175/");
    expect(workforceAppUrlFromWebPath("/app/workforce/")).toBe("http://localhost:5175/");
    expect(workforceAppUrlFromWebPath("/app/workforce/employees")).toBe("http://localhost:5175/employees");
    expect(workforceAppUrlFromWebPath("/app/workforce/schedules", "?x=1")).toBe(
      "http://localhost:5175/schedules?x=1",
    );
  });

  it("aligns loopback hosts and carries the current session onto WorkForce", () => {
    expect(alignLoopbackOrigin("http://localhost:5175", "http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5175",
    );
    const launched = workforceAppUrlWithSession("/app/workforce", "", {
      access_token: "tok",
      refresh_token: "ref",
    });
    expect(launched.startsWith("http://localhost:5175/#")).toBe(true);
    expect(launched).toContain("access_token=tok");
    expect(launched).toContain("refresh_token=ref");
  });
});

