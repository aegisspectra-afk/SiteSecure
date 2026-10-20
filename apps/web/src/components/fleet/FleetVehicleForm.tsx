import type { FleetDepartmentOut, FleetVehicleOut } from "@site-secure/api-client";
import { Button, Select } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { Input } from "../modules/ModuleKit";
import { he } from "../../i18n/he";

export type FleetVehicleFormValues = {
  department_id: string;
  license_plate: string;
  vehicle_type: string;
  manufacturer: string;
  model: string;
  year: string;
  current_mileage: string;
  service_interval_km: string;
  next_service_mileage: string;
  status: string;
  notes: string;
  test_expiry_date: string;
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_expiry_date: string;
};

const emptyValues = (departmentId?: string): FleetVehicleFormValues => ({
  department_id: departmentId ?? "",
  license_plate: "",
  vehicle_type: "car",
  manufacturer: "",
  model: "",
  year: "",
  current_mileage: "0",
  service_interval_km: "",
  next_service_mileage: "",
  status: "active",
  notes: "",
  test_expiry_date: "",
  insurance_provider: "",
  insurance_policy_number: "",
  insurance_expiry_date: "",
});

function fromVehicle(vehicle: FleetVehicleOut): FleetVehicleFormValues {
  return {
    department_id: vehicle.department_id,
    license_plate: vehicle.license_plate,
    vehicle_type: vehicle.vehicle_type || "car",
    manufacturer: vehicle.manufacturer ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year != null ? String(vehicle.year) : "",
    current_mileage: String(vehicle.current_mileage ?? 0),
    service_interval_km: vehicle.service_interval_km != null ? String(vehicle.service_interval_km) : "",
    next_service_mileage:
      vehicle.next_service_mileage != null ? String(vehicle.next_service_mileage) : "",
    status: vehicle.status || "active",
    notes: vehicle.notes ?? "",
    test_expiry_date: vehicle.test_expiry_date ?? "",
    insurance_provider: vehicle.insurance_provider ?? "",
    insurance_policy_number: vehicle.insurance_policy_number ?? "",
    insurance_expiry_date: vehicle.insurance_expiry_date ?? "",
  };
}

export function toVehiclePayload(values: FleetVehicleFormValues) {
  const num = (v: string) => {
    const n = Number(v);
    return v.trim() && Number.isFinite(n) ? n : null;
  };
  return {
    department_id: values.department_id,
    license_plate: values.license_plate.trim(),
    vehicle_type: values.vehicle_type || "car",
    manufacturer: values.manufacturer.trim() || null,
    model: values.model.trim() || null,
    year: num(values.year),
    current_mileage: num(values.current_mileage) ?? 0,
    service_interval_km: num(values.service_interval_km),
    next_service_mileage: num(values.next_service_mileage),
    status: values.status || "active",
    notes: values.notes.trim() || null,
    test_expiry_date: values.test_expiry_date || null,
    insurance_provider: values.insurance_provider.trim() || null,
    insurance_policy_number: values.insurance_policy_number.trim() || null,
    insurance_expiry_date: values.insurance_expiry_date || null,
  };
}

export function FleetVehicleForm({
  departments,
  initial,
  defaultDepartmentId,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  departments: FleetDepartmentOut[];
  initial?: FleetVehicleOut | null;
  defaultDepartmentId?: string;
  pending?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (values: FleetVehicleFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FleetVehicleFormValues>(() =>
    initial ? fromVehicle(initial) : emptyValues(defaultDepartmentId),
  );

  function set<K extends keyof FleetVehicleFormValues>(key: K, value: FleetVehicleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="ss-module-create"
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        if (!values.license_plate.trim() || !values.department_id) return;
        onSubmit(values);
      }}
    >
      {error ? <p className="ss-module-empty-text" role="alert">{error}</p> : null}
      <Select
        id="fleet-vehicle-dept"
        label={he.fleetDepartment}
        value={values.department_id}
        onChange={(ev) => set("department_id", ev.target.value)}
        required
      >
        <option value="">{he.fleetPickDepartment}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name_he}
          </option>
        ))}
      </Select>
      <Input
        id="fleet-vehicle-plate"
        label={he.fleetLicensePlate}
        value={values.license_plate}
        onChange={(ev) => set("license_plate", ev.target.value)}
        required
      />
      <Select
        id="fleet-vehicle-type"
        label={he.fleetVehicleType}
        value={values.vehicle_type}
        onChange={(ev) => set("vehicle_type", ev.target.value)}
      >
        <option value="car">{he.fleetVehicleTypes.car}</option>
        <option value="van">{he.fleetVehicleTypes.van}</option>
        <option value="truck">{he.fleetVehicleTypes.truck}</option>
        <option value="motorcycle">{he.fleetVehicleTypes.motorcycle}</option>
        <option value="other">{he.fleetVehicleTypes.other}</option>
      </Select>
      <div className="fleet-form-grid">
        <Input
          id="fleet-vehicle-mfr"
          label={he.fleetManufacturer}
          value={values.manufacturer}
          onChange={(ev) => set("manufacturer", ev.target.value)}
        />
        <Input
          id="fleet-vehicle-model"
          label={he.fleetModel}
          value={values.model}
          onChange={(ev) => set("model", ev.target.value)}
        />
        <Input
          id="fleet-vehicle-year"
          label={he.fleetYear}
          type="number"
          value={values.year}
          onChange={(ev) => set("year", ev.target.value)}
        />
        <Input
          id="fleet-vehicle-mileage"
          label={he.fleetCurrentMileage}
          type="number"
          value={values.current_mileage}
          onChange={(ev) => set("current_mileage", ev.target.value)}
        />
      </div>
      <div className="fleet-form-grid">
        <Input
          id="fleet-vehicle-interval"
          label={he.fleetServiceInterval}
          type="number"
          value={values.service_interval_km}
          onChange={(ev) => set("service_interval_km", ev.target.value)}
        />
        <Input
          id="fleet-vehicle-next"
          label={he.fleetNextServiceMileage}
          type="number"
          value={values.next_service_mileage}
          onChange={(ev) => set("next_service_mileage", ev.target.value)}
        />
      </div>
      <Select
        id="fleet-vehicle-status"
        label={he.fleetStatus}
        value={values.status}
        onChange={(ev) => set("status", ev.target.value)}
      >
        {Object.entries(he.fleetVehicleStatuses).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      <div className="fleet-form-grid">
        <Input
          id="fleet-vehicle-test"
          label={he.fleetTestExpiry}
          type="date"
          value={values.test_expiry_date}
          onChange={(ev) => set("test_expiry_date", ev.target.value)}
        />
        <Input
          id="fleet-vehicle-ins-exp"
          label={he.fleetInsuranceExpiry}
          type="date"
          value={values.insurance_expiry_date}
          onChange={(ev) => set("insurance_expiry_date", ev.target.value)}
        />
      </div>
      <Input
        id="fleet-vehicle-ins-provider"
        label={he.fleetInsuranceProvider}
        value={values.insurance_provider}
        onChange={(ev) => set("insurance_provider", ev.target.value)}
      />
      <Input
        id="fleet-vehicle-ins-policy"
        label={he.fleetInsurancePolicy}
        value={values.insurance_policy_number}
        onChange={(ev) => set("insurance_policy_number", ev.target.value)}
      />
      <Input
        id="fleet-vehicle-notes"
        label={he.notes}
        value={values.notes}
        onChange={(ev) => set("notes", ev.target.value)}
      />
      <div className="ss-module-toolbar">
        <Button type="submit" disabled={pending}>
          {pending ? he.saving : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {he.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
