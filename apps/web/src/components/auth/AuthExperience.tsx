import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AuthExperienceValue = {
  passwordScan: number;
  setPasswordScan: (length: number) => void;
};

const AuthExperienceContext = createContext<AuthExperienceValue>({
  passwordScan: 0,
  setPasswordScan: () => {},
});

export function AuthExperienceProvider({ children }: { children: ReactNode }) {
  const [passwordScan, setPasswordScan] = useState(0);
  const value = useMemo(() => ({ passwordScan, setPasswordScan }), [passwordScan]);
  return <AuthExperienceContext.Provider value={value}>{children}</AuthExperienceContext.Provider>;
}

export function useAuthExperience() {
  return useContext(AuthExperienceContext);
}
