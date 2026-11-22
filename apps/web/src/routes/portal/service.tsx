import { Button, Input, Select } from "@site-secure/ui";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { PortalShell } from "../../components/portal/PortalShell";
import { he } from "../../i18n/he";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/service")({
  component: PortalServicePage,
});

async function uploadServiceCallPhoto(
  api: ReturnType<typeof usePortalContext>["api"],
  accessId: string,
  callId: string,
  file: File,
) {
  const intent = await api.createPortalServiceCallPhotoUpload(accessId, callId, {
    mime_type: file.type || "image/jpeg",
    original_filename: file.name,
    byte_size: file.size,
  });
  const put = await fetch(intent.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "image/jpeg" },
  });
  if (!put.ok) throw new Error("upload failed");
  await api.completePortalServiceCallPhotoUpload(accessId, callId, intent.document_id, {
    byte_size: file.size,
    mime_type: file.type || undefined,
  });
}

function PortalServicePage() {
  const ctx = usePortalContext();
  const [siteId, setSiteId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home || !ctx.accessId) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;

  const equipmentForSite = home.equipment.filter((e) => e.site_id === siteId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ctx.accessId) return;
    setPending(true);
    setError(null);
    try {
      const call = await ctx.api.createPortalServiceCall(ctx.accessId, {
        site_id: siteId,
        title: title.trim(),
        description: description.trim() || undefined,
        equipment_id: equipmentId || undefined,
      });
      const file = photoRef.current?.files?.[0];
      if (file && call.id) {
        await uploadServiceCallPhoto(ctx.api, ctx.accessId, call.id, file);
      }
      setSent(true);
    } catch {
      setError(he.portalOtpVerifyFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <PortalShell title={he.portalServiceFormTitle} brand={home.installer_brand} onSignOut={ctx.signOut}>
      {sent ? (
        <p className="text-sm text-fg">{he.portalServiceSent}</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <Select
            id="portal-service-site"
            label={he.portalSectionSites}
            value={siteId}
            onChange={(ev) => {
              setSiteId(ev.target.value);
              setEquipmentId("");
            }}
          >
            <option value="">—</option>
            {home.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
          {equipmentForSite.length > 0 ? (
            <Select
              id="portal-service-equipment"
              label={he.portalSectionEquipment}
              value={equipmentId}
              onChange={(ev) => setEquipmentId(ev.target.value)}
            >
              <option value="">—</option>
              {equipmentForSite.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Input id="portal-service-title" label={he.portalServiceFormTitle} value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="text-sm text-fg">
            {he.customer360Notes}
            <textarea
              className="mt-1 block min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="text-sm text-fg">
            {he.portalServicePhoto}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 block w-full text-base"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={pending || !siteId || !title.trim()}>
            {he.portalServiceSubmit}
          </Button>
        </form>
      )}
    </PortalShell>
  );
}