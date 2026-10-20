import { Button } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { Input } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import { formatKm } from "./fleet-labels";

export function FleetMileageForm({
  currentMileage,
  pending,
  error,
  compact,
  onSubmit,
}: {
  currentMileage: number;
  pending?: boolean;
  error?: string | null;
  compact?: boolean;
  onSubmit: (payload: { mileage: number; notes?: string }) => void;
}) {
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className={compact ? "fleet-mileage-quick" : "ss-module-create"}
      onSubmit={(ev: FormEvent) => {
        ev.preventDefault();
        const value = Number(mileage);
        if (!Number.isFinite(value)) return;
        onSubmit({ mileage: value, notes: notes.trim() || undefined });
      }}
    >
      <p className="ss-module-empty-text">
        {he.fleetCurrentMileage}: <strong>{formatKm(currentMileage)}</strong>
      </p>
      {error ? <p className="ss-module-empty-text" role="alert">{error}</p> : null}
      <Input
        id="fleet-mileage-new"
        label={he.fleetNewMileage}
        type="number"
        inputMode="numeric"
        value={mileage}
        onChange={(ev) => setMileage(ev.target.value)}
        required
      />
      {!compact ? (
        <Input
          id="fleet-mileage-notes"
          label={he.notes}
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
        />
      ) : null}
      <Button type="submit" disabled={pending} className={compact ? "fleet-mileage-quick-btn" : undefined}>
        {pending ? he.saving : he.fleetUpdateMileage}
      </Button>
    </form>
  );
}
