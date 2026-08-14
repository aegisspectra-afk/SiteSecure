import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { AuthField } from "./AuthField";
import type { InputProps } from "@site-secure/ui";

export function PasswordField({
  accessory,
  ...props
}: Omit<InputProps, "revealable" | "type"> & { accessory?: ReactNode }) {
  return (
    <AuthField
      revealable
      showPasswordLabel={he.showPassword}
      hidePasswordLabel={he.hidePassword}
      {...props}
      labelAccessory={accessory}
    />
  );
}
