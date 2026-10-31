import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";

describe("PROFILE-SETTINGS-3 appearance merge", () => {
  it("keeps device-local theme copy and prefs heading", () => {
    expect(he.settingsProfilePrefsHeading).toBe("העדפות אישיות");
    expect(he.themeLabel).toBe("ערכת נושא");
    expect(he.themeLight).toBe("בהיר");
    expect(he.themeDark).toBe("כהה");
    expect(he.themeSystem).toBe("מערכת");
    expect(he.settingsProfileThemeDeviceHint).toContain("במכשיר זה");
  });
});
