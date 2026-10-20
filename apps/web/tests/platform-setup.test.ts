import { afterEach, describe, expect, it } from "vitest";
import {
  isPlatformSetupDone,
  markPlatformSetupDone,
  needsPlatformSetup,
} from "../src/lib/platform-setup";

describe("platform-setup gate", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("never forces public owners into product setup", () => {
    expect(needsPlatformSetup({ workspaceId: "ws-1", roleKey: "owner" })).toBe(false);
    expect(needsPlatformSetup({ workspaceId: "ws-1", roleKey: "technician" })).toBe(false);
  });

  it("still records optional demo markers without gating", () => {
    markPlatformSetupDone("ws-1");
    expect(isPlatformSetupDone("ws-1")).toBe(true);
    expect(needsPlatformSetup({ workspaceId: "ws-1", roleKey: "owner" })).toBe(false);
  });
});
