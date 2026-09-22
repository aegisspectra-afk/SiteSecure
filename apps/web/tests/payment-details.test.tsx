import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PaymentDetailsCard,
  PaymentDetailsEmpty,
} from "../src/components/settings/PaymentDetailsCard";
import { he } from "../src/i18n/he";
import { hasPaymentDetails, maskBankAccount } from "../src/lib/payment-details";

describe("maskBankAccount", () => {
  it("masks long accounts to last four", () => {
    expect(maskBankAccount("12-345-678901")).toBe("•••• 8901");
    expect(maskBankAccount("123456789")).toBe("•••• 6789");
  });

  it("keeps short accounts fully after bullets", () => {
    expect(maskBankAccount("42")).toBe("•••• 42");
    expect(maskBankAccount("4567")).toBe("•••• 4567");
  });

  it("handles empty", () => {
    expect(maskBankAccount("")).toBe("—");
    expect(maskBankAccount("   ")).toBe("—");
  });
});

describe("hasPaymentDetails", () => {
  it("is true when any core bank field is set", () => {
    expect(
      hasPaymentDetails({
        bankName: "לאומי",
        bankBranch: "",
        bankAccount: "",
        bankAccountHolder: "",
        paymentInstructions: "",
        showBankOnDocuments: false,
      }),
    ).toBe(true);
    expect(
      hasPaymentDetails({
        bankName: "",
        bankBranch: "",
        bankAccount: "",
        bankAccountHolder: "",
        paymentInstructions: "העברה בלבד",
        showBankOnDocuments: true,
      }),
    ).toBe(false);
  });
});

describe("PaymentDetailsCard", () => {
  const base = {
    bankName: "בנק הפועלים",
    bankBranch: "612",
    bankAccount: "12-345-678901",
    bankAccountHolder: "Site Secure Ltd",
    paymentInstructions: "נא להעביר תוך 14 יום",
    showBankOnDocuments: true,
  };

  it("renders view fields with masked account and document status", () => {
    const onEdit = vi.fn();
    render(<PaymentDetailsCard details={base} onEdit={onEdit} />);

    expect(screen.getByText(he.brand)).toBeTruthy();
    expect(screen.getByRole("heading", { name: he.companyPaymentSection })).toBeTruthy();
    expect(screen.getByText("בנק הפועלים")).toBeTruthy();
    expect(screen.getByText("612")).toBeTruthy();
    expect(screen.getByText("•••• 8901")).toBeTruthy();
    expect(screen.queryByText("12-345-678901")).toBeNull();
    expect(screen.getByText("Site Secure Ltd")).toBeTruthy();
    expect(screen.getByText(he.companyBankShownOnDocs)).toBeTruthy();
    expect(screen.getByText(he.companyPaymentInstructionsShort)).toBeTruthy();
    expect(screen.getByText("נא להעביר תוך 14 יום")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: he.companyPaymentEdit }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("shows hidden-on-documents status and omits empty instructions", () => {
    render(
      <PaymentDetailsCard
        details={{ ...base, showBankOnDocuments: false, paymentInstructions: "" }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(he.companyBankHiddenOnDocs)).toBeTruthy();
    expect(screen.queryByText(he.companyPaymentInstructionsShort)).toBeNull();
    expect(screen.queryByText(he.companyPaymentInstructionsEmpty)).toBeNull();
  });

  it("does not invent missing bank name or holder", () => {
    render(
      <PaymentDetailsCard
        details={{
          bankName: "",
          bankBranch: "1",
          bankAccount: "9999",
          bankAccountHolder: "",
          paymentInstructions: "",
          showBankOnDocuments: false,
        }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(he.companyBankNameUnset)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});

describe("PaymentDetailsEmpty", () => {
  it("offers add action", () => {
    const onEdit = vi.fn();
    render(<PaymentDetailsEmpty onEdit={onEdit} />);
    expect(screen.getByText(he.companyPaymentEmptyTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: he.companyPaymentAdd }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
