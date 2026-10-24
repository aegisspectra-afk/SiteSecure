import { describe, expect, it } from "vitest";
import { parseAuthHandoffHash, stripAuthHandoffHash } from "./auth-handoff";

describe("WorkForce auth handoff", () => {
  it("accepts a SITE SECURE hash session and strips it from the URL", () => {
    expect(parseAuthHandoffHash("#access_token=tok&refresh_token=ref&token_type=bearer")).toEqual({
      access_token: "tok",
      refresh_token: "ref",
    });
    expect(stripAuthHandoffHash("http://localhost:5175/#access_token=tok&refresh_token=ref")).toBe("/");
    expect(parseAuthHandoffHash("#access_token=tok")).toBeNull();
  });
});
