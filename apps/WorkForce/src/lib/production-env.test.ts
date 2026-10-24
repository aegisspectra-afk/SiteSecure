import { describe, expect, it } from "vitest";
import { assertWorkforceProductionEnv, looksLikeServerSecret } from "./production-env";

const valid = {
  VITE_API_URL: "https://api.example.com",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
  VITE_PLATFORM_HOME_URL: "https://app.example.com/platform",
};

describe("WorkForce production env", () => {
  it("accepts public HTTPS origins", () => {
    expect(assertWorkforceProductionEnv(valid)).toEqual({
      apiUrl: "https://api.example.com",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnon: "sb_publishable_test",
      platformHome: "https://app.example.com/platform",
    });
  });

  it("fails when the API URL is missing or loopback", () => {
    expect(() => assertWorkforceProductionEnv({ ...valid, VITE_API_URL: undefined })).toThrow(
      /VITE_API_URL/,
    );
    expect(() => assertWorkforceProductionEnv({ ...valid, VITE_API_URL: "http://localhost:8000" })).toThrow(
      /localhost/,
    );
    expect(() => assertWorkforceProductionEnv({ ...valid, VITE_API_URL: "http://127.0.0.1:8000" })).toThrow(
      /localhost/,
    );
  });

  it("fails when Supabase or Platform Home are missing or loopback", () => {
    expect(() => assertWorkforceProductionEnv({ ...valid, VITE_SUPABASE_URL: "" })).toThrow(
      /VITE_SUPABASE_URL/,
    );
    expect(() => assertWorkforceProductionEnv({ ...valid, VITE_SUPABASE_ANON_KEY: "" })).toThrow(
      /VITE_SUPABASE_ANON_KEY/,
    );
    expect(() =>
      assertWorkforceProductionEnv({ ...valid, VITE_PLATFORM_HOME_URL: "http://localhost:5173/platform" }),
    ).toThrow(/VITE_PLATFORM_HOME_URL/);
  });

  it("rejects a service-role value in the public anon slot", () => {
    expect(looksLikeServerSecret("sb_secret_test")).toBe(true);
    expect(() =>
      assertWorkforceProductionEnv({ ...valid, VITE_SUPABASE_ANON_KEY: "sb_secret_test" }),
    ).toThrow(/service_role/);
  });
});
