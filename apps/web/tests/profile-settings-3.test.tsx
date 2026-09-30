import { describe, expect, it, vi } from "vitest";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  redirect: (opts: { to: string; replace?: boolean }) => {
    const err = new Error("REDIRECT") as Error & { redirect: typeof opts };
    err.redirect = opts;
    return err;
  },
}));

import { Route as AppearanceRoute } from "../src/routes/app/settings/appearance";

describe("PROFILE-SETTINGS-3 appearance merge", () => {
  it("keeps device-local theme copy and prefs heading", () => {
    expect(he.settingsProfilePrefsHeading).toBe("העדפות אישיות");
    expect(he.themeLabel).toBe("ערכת נושא");
    expect(he.themeLight).toBe("בהיר");
    expect(he.themeDark).toBe("כהה");
    expect(he.themeSystem).toBe("מערכת");
    expect(he.settingsProfileThemeDeviceHint).toContain("במכשיר זה");
  });

  it("redirects /app/settings/appearance to profile", () => {
    const route = AppearanceRoute as unknown as {
      beforeLoad?: () => void;
    };
    expect(typeof route.beforeLoad).toBe("function");
    try {
      route.beforeLoad?.();
      throw new Error("expected redirect");
    } catch (err) {
      const redirect = (err as { redirect?: { to: string; replace?: boolean } }).redirect;
      expect(redirect?.to).toBe("/app/settings/profile");
      expect(redirect?.replace).toBe(true);
    }
  });
});
