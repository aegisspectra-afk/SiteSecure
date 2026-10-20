import type { FleetDepartmentOut } from "@site-secure/api-client";
import { createContext, useContext, type ReactNode } from "react";

export type FleetDepartmentContextValue = {
  workspaceId: string;
  departmentId: string | undefined;
  setDepartmentId: (id: string | undefined) => void;
  departments: FleetDepartmentOut[];
  departmentsLoading: boolean;
  departmentsError: boolean;
};

const FleetDepartmentContext = createContext<FleetDepartmentContextValue | null>(null);

export function FleetDepartmentProvider({
  value,
  children,
}: {
  value: FleetDepartmentContextValue;
  children: ReactNode;
}) {
  return <FleetDepartmentContext.Provider value={value}>{children}</FleetDepartmentContext.Provider>;
}

export function useFleetDepartment(): FleetDepartmentContextValue {
  const ctx = useContext(FleetDepartmentContext);
  if (!ctx) {
    throw new Error("useFleetDepartment must be used within FleetDepartmentProvider");
  }
  return ctx;
}
