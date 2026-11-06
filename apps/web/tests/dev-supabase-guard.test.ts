import { describe, expect, it } from "vitest";
import { isLocalSupabaseUrl, requireLocalSupabaseInDev } from "../src/lib/dev-supabase-guard";

describe("dev Supabase guard", () => {
  it("accepts loopback and .local targets", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://supabase.local:8000")).toBe(true);
    expect(() => requireLocalSupabaseInDev("http://127.0.0.1:54321", undefined)).not.toThrow();
  });

  it("refuses a hosted project and empty values", () => {
    expect(() => requireLocalSupabaseInDev("https://abcdefghijklmnop.supabase.co", undefined)).toThrow(
      /Refusing non-local VITE_SUPABASE_URL host 'abcdefghijklmnop.supabase.co'/,
    );
    expect(() => requireLocalSupabaseInDev(undefined, undefined)).toThrow(/<empty>/);
    expect(() => requireLocalSupabaseInDev("not a url", "0")).toThrow();
  });

  it("allows a deliberate opt-in", () => {
    expect(() => requireLocalSupabaseInDev("https://abcdefghijklmnop.supabase.co", "1")).not.toThrow();
  });
});
