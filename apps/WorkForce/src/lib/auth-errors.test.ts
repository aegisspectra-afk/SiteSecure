import { describe, expect, it } from "vitest";
import { he } from "../i18n/he";
import { workforceAuthErrorMessage } from "./auth-errors";

describe("workforce auth errors", () => {
  it("maps credential and session failures without leaking raw English", () => {
    expect(workforceAuthErrorMessage("Invalid login credentials")).toBe(he.loginFailed);
    expect(workforceAuthErrorMessage("Email not confirmed")).toBe(he.emailNotConfirmed);
    expect(workforceAuthErrorMessage("SESSION_FAILED")).toBe(he.sessionFailed);
    expect(workforceAuthErrorMessage("NO_CONFIG")).toBe(he.noConfig);
    expect(workforceAuthErrorMessage("AuthApiError: boom")).toBe(he.loginGenericError);
  });

  it("keeps Hebrew API messages", () => {
    expect(workforceAuthErrorMessage(he.sessionError)).toBe(he.sessionError);
  });
});
