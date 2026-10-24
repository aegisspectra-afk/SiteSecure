import { describe, expect, it } from "vitest";
import { appendAuthHandoffHash, parseAuthHandoffHash } from "../src/lib/auth-handoff";

describe("auth handoff hash", () => {
  it("puts tokens only in the hash, never the query string", () => {
    const url = appendAuthHandoffHash("http://localhost:5175/", {
      access_token: "aaa",
      refresh_token: "bbb",
      expires_at: 1700000000,
    });
    expect(url.startsWith("http://localhost:5175/#")).toBe(true);
    expect(url).not.toContain("?access_token");
    expect(parseAuthHandoffHash(url.slice(url.indexOf("#")))).toEqual({
      access_token: "aaa",
      refresh_token: "bbb",
      expires_at: 1700000000,
    });
  });

  it("leaves the URL unchanged without a full session", () => {
    expect(appendAuthHandoffHash("http://localhost:5175/", { access_token: "aaa" })).toBe(
      "http://localhost:5175/",
    );
    expect(parseAuthHandoffHash("#access_token=aaa")).toBeNull();
  });
});
