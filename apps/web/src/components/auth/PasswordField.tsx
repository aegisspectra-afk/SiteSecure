import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { he } from "../../i18n/he";
import { AuthField } from "./AuthField";
import type { InputProps } from "@site-secure/ui";

export function PasswordField({
  accessory,
  onKeyDown,
  onKeyUp,
  onClick,
  onBlur,
  ...props
}: Omit<InputProps, "revealable" | "type"> & { accessory?: ReactNode }) {
  const [capsLock, setCapsLock] = useState(false);

  function readCaps(event: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <div className="auth-password-wrap">
      <AuthField
        revealable
        showPasswordLabel={he.showPassword}
        hidePasswordLabel={he.hidePassword}
        {...props}
        labelAccessory={accessory}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          readCaps(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event: KeyboardEvent<HTMLInputElement>) => {
          readCaps(event);
          onKeyUp?.(event);
        }}
        onClick={(event: MouseEvent<HTMLInputElement>) => {
          readCaps(event);
          onClick?.(event);
        }}
        onBlur={(event) => {
          setCapsLock(false);
          onBlur?.(event);
        }}
      />
      {capsLock ? (
        <p className="auth-caps-warning" role="status">
          {he.capsLockOn}
        </p>
      ) : null}
    </div>
  );
}
