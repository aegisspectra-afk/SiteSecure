import type { FleetDepartmentOut } from "@site-secure/api-client";
import { Select } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function FleetDepartmentSwitcher({
  departments,
  value,
  onChange,
  disabled,
}: {
  departments: FleetDepartmentOut[];
  value: string | undefined;
  onChange: (departmentId: string | undefined) => void;
  disabled?: boolean;
}) {
  if (departments.length <= 1) return null;

  return (
    <div className="fleet-dept-switcher">
      <Select
        id="fleet-department"
        label={he.fleetDepartment}
        value={value ?? ""}
        disabled={disabled}
        onChange={(ev) => onChange(ev.target.value || undefined)}
      >
        <option value="">{he.fleetDepartmentAll}</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name_he}
          </option>
        ))}
      </Select>
    </div>
  );
}
