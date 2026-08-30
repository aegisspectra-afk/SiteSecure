import { ApiClientError, type ApiClient, type CustomerOut, type LeadOut, type SiteOut } from "@site-secure/api-client";
import { Button, Input, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Search, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addressFromForm,
  formatAddressLine,
  formatAddressLines,
  hasAddress,
  parseAddress,
  type StructuredAddress,
} from "../../lib/address";
import { customerStatusLabel, customerStatusTone } from "../../lib/customer-profile";
import {
  LEAD_PRIORITIES,
  LEAD_SERVICE_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  defaultLeadTitle,
  type LeadPriority,
  type LeadServiceType,
  type LeadSource,
  type LeadStatus,
} from "../../lib/leads";
import {
  buildLeadRequirements,
  canSaveNewLead,
  type AlarmRequirementDraft,
  type CctvRequirementDraft,
  type NewLeadCustomerMode,
  type NewLeadSiteMode,
} from "../../lib/new-lead";
import { he } from "../../i18n/he";
import { planQuotaMessage } from "../../lib/plan-quota";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";

const EMPTY_ADDRESS: StructuredAddress = {};

export function NewLeadSheet({
  open,
  onClose,
  workspaceId,
  api,
  canCreateCustomer,
  canCreateSite,
  initialCustomerId,
  initialSiteId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  api: ApiClient;
  canCreateCustomer: boolean;
  canCreateSite: boolean;
  initialCustomerId?: string;
  initialSiteId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerMode, setCustomerMode] = useState<NewLeadCustomerMode>(initialCustomerId ? "existing" : "none");
  const [siteMode, setSiteMode] = useState<NewLeadSiteMode>(initialSiteId ? "existing" : "unknown");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [siteId, setSiteId] = useState(initialSiteId ?? "");
  const [contactId, setContactId] = useState("");

  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);
  const [propertyNotes, setPropertyNotes] = useState("");
  const [addressText, setAddressText] = useState("");

  const [serviceType, setServiceType] = useState<LeadServiceType>("cctv");
  const [source, setSource] = useState<LeadSource>("whatsapp");
  const [status, setStatus] = useState<LeadStatus>("visit_scheduling");
  const [priority, setPriority] = useState<LeadPriority>("high");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [cctv, setCctv] = useState<CctvRequirementDraft>({
    cameraCount: "",
    location: "",
    infrastructure: "",
    recording: true,
    remoteViewing: true,
  });
  const [alarm, setAlarm] = useState<AlarmRequirementDraft>({
    systemType: "",
    zoneCount: "",
    detectors: "",
    magnets: true,
    siren: true,
    app: true,
  });

  useEffect(() => {
    if (!open) return;
    setCustomerMode(initialCustomerId ? "existing" : "none");
    setSiteMode(initialSiteId ? "existing" : "unknown");
    setCustomerId(initialCustomerId ?? "");
    setSiteId(initialSiteId ?? "");
    setContactId("");
    setFormError(null);
  }, [open, initialCustomerId, initialSiteId]);

  const selectedCustomerQuery = useQuery({
    queryKey: ["customer", workspaceId, customerId],
    enabled: open && Boolean(customerId),
    queryFn: () => api.getCustomer(workspaceId, customerId),
  });
  const selectedCustomer = selectedCustomerQuery.data ?? null;

  const contactsQuery = useQuery({
    queryKey: ["customer-contacts", workspaceId, customerId],
    enabled: open && Boolean(customerId),
    queryFn: () => api.listCustomerContacts(workspaceId, customerId),
  });
  const contacts = contactsQuery.data ?? [];

  useEffect(() => {
    if (!customerId || !contacts.length || contactId) return;
    const primary = contacts.find((row) => row.is_primary) ?? contacts[0];
    if (primary) setContactId(primary.id);
  }, [customerId, contacts, contactId]);

  const sitesQuery = useQuery({
    queryKey: ["customer-sites", workspaceId, customerId],
    enabled: open && Boolean(customerId),
    queryFn: () => api.listSites(workspaceId, { customer_id: customerId, limit: 100 }),
  });
  const customerSites = sitesQuery.data?.items ?? [];

  const selectedSite = useMemo(
    () => customerSites.find((site) => site.id === siteId) ?? null,
    [customerSites, siteId],
  );

  useEffect(() => {
    if (!customerId || siteMode !== "existing") return;
    if (customerSites.length === 1 && !siteId) setSiteId(customerSites[0]!.id);
  }, [customerId, siteId, siteMode, customerSites]);

  function switchCustomerMode(mode: NewLeadCustomerMode) {
    setCustomerMode(mode);
    setFormError(null);
    if (mode !== "existing") {
      setCustomerId("");
      setContactId("");
      setSiteId("");
      if (siteMode === "existing") setSiteMode("unknown");
    }
    if (mode !== "new") setNewCustomerName("");
    if (mode !== "none") {
      /* keep temporary contact fields only for none */
    }
  }

  function selectCustomer(row: CustomerOut) {
    setCustomerId(row.id);
    queryClient.setQueryData(["customer", workspaceId, row.id], row);
    setContactId("");
    setSiteId("");
    setFormError(null);
  }

  function clearCustomerSelection() {
    setCustomerId("");
    setContactId("");
    setSiteId("");
  }

  const create = useMutation({
    mutationFn: async () => {
      let linkedCustomerId: string | undefined;
      let linkedSiteId: string | undefined;

      if (customerMode === "existing") {
        if (!customerId) throw new ApiClientError(400, "VALIDATION_ERROR", he.leadsLinkCustomerNeeded);
        linkedCustomerId = customerId;
      } else if (customerMode === "new") {
        if (!canCreateCustomer) throw new ApiClientError(403, "FORBIDDEN", he.forbiddenTitle);
        const created = await api.createCustomer(workspaceId, {
          display_name: (newCustomerName.trim() || contactName.trim()),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
        linkedCustomerId = created.id;
      } else {
        linkedCustomerId = undefined;
      }

      const selectedContact = contacts.find((row) => row.id === contactId) ?? null;
      const leadContactName =
        customerMode === "existing"
          ? selectedContact?.full_name?.trim() || undefined
          : contactName.trim() || undefined;
      const leadPhone =
        customerMode === "existing"
          ? selectedContact?.phone?.trim() || undefined
          : phone.trim() || undefined;
      const leadEmail =
        customerMode === "existing"
          ? selectedContact?.email?.trim() || undefined
          : email.trim() || undefined;

      if (siteMode === "new" && linkedCustomerId) {
        if (!canCreateSite) throw new ApiClientError(403, "FORBIDDEN", he.forbiddenTitle);
        const createdSite = await api.createSite(workspaceId, {
          customer_id: linkedCustomerId,
          name: siteName.trim() || propertyNotes.trim() || formatAddressLine(siteAddress) || he.sitesTitle,
          address: addressFromForm(siteAddress),
        });
        linkedSiteId = createdSite.id;
      } else if (siteMode === "existing" && siteId) {
        linkedSiteId = siteId;
      }

      const siteLine =
        formatAddressLine(addressFromForm(siteAddress)) ||
        formatAddressLine(selectedSite?.address) ||
        addressText.trim();

      const title = defaultLeadTitle(serviceType, siteLine || undefined);
      return api.createLead(workspaceId, {
        title,
        status,
        source,
        priority,
        service_type: serviceType,
        contact_name: leadContactName,
        phone: leadPhone,
        email: leadEmail,
        address_text: siteLine || undefined,
        property_notes: propertyNotes.trim() || undefined,
        next_action: nextAction.trim() || undefined,
        next_action_at: nextActionAt ? `${nextActionAt}T00:00:00.000Z` : undefined,
        notes: notes.trim() || undefined,
        customer_id: linkedCustomerId,
        site_id: linkedSiteId,
        requirements: buildLeadRequirements(serviceType, cctv, alarm),
      });
    },
    onSuccess: async (created: LeadOut) => {
      await queryClient.invalidateQueries({ queryKey: ["leads", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["directory-leads", workspaceId] });
      onClose();
      void navigate({ to: "/app/leads/$leadId", params: { leadId: created.id } });
    },
    onError: (err) => setFormError(planQuotaMessage(err) ?? (err instanceof ApiClientError ? err.message : he.leadsError)),
  });

  const canSave = canSaveNewLead({
    customerMode,
    customerId,
    contactName,
    newCustomerName,
  });

  return (
    <QuoteFlowSheet
      open={open}
      onClose={() => {
        if (create.isPending) return;
        onClose();
      }}
      title={he.leadsCreate}
      subtitle={he.leadsNewSubtitle}
      variant="sheet"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={create.isPending} onClick={onClose}>
            {he.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canSave || create.isPending}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? he.leadsSaving : he.leadsSave}
          </Button>
        </div>
      }
    >
      <div className="lead-intake">
        <section className="lead-intake-section" aria-labelledby="lead-sec-customer">
          <h3 id="lead-sec-customer" className="lead-intake-section-title">
            {he.leadsSectionCustomer}
          </h3>
          <ModeRadios
            name="lead-customer-mode"
            value={customerMode}
            onChange={switchCustomerMode}
            options={[
              { value: "existing", label: he.leadsCustomerExisting },
              ...(canCreateCustomer ? [{ value: "new" as const, label: he.leadsCustomerNew }] : []),
              { value: "none", label: he.leadsCustomerNone },
            ]}
          />

          {customerMode === "existing" ? (
            <LeadCustomerPicker
              workspaceId={workspaceId}
              api={api}
              customerId={customerId}
              selected={selectedCustomer}
              loading={Boolean(customerId) && selectedCustomerQuery.isLoading}
              onSelect={selectCustomer}
              onClear={clearCustomerSelection}
              onCreateNew={
                canCreateCustomer
                  ? () => {
                      switchCustomerMode("new");
                    }
                  : undefined
              }
            />
          ) : null}

          {customerMode === "existing" && customerId && contacts.length > 1 ? (
            <fieldset className="lead-intake-fieldset">
              <legend className="lead-intake-legend">{he.leadsPickContact}</legend>
              <div className="lead-intake-choice-stack">
                {contacts.map((contact) => (
                  <label key={contact.id} className={`lead-intake-choice${contactId === contact.id ? " is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="lead-contact"
                      checked={contactId === contact.id}
                      onChange={() => setContactId(contact.id)}
                    />
                    <span>
                      <span className="lead-intake-choice-title">{contact.full_name}</span>
                      {contact.phone ? (
                        <span className="lead-intake-choice-meta" dir="ltr">
                          {contact.phone}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {customerMode === "new" ? (
            <div className="grid gap-3">
              <Input
                id="lead-new-customer-name"
                label={he.fullName}
                value={newCustomerName}
                onChange={(ev) => setNewCustomerName(ev.target.value)}
                data-autofocus
              />
              <Input id="lead-new-phone" label={he.phone} value={phone} onChange={(ev) => setPhone(ev.target.value)} inputMode="tel" />
              <Input id="lead-new-email" label={he.email} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
            </div>
          ) : null}

          {customerMode === "none" ? (
            <div className="grid gap-3">
              <Input
                id="lead-contact-name"
                label={he.fullName}
                value={contactName}
                onChange={(ev) => setContactName(ev.target.value)}
                data-autofocus
                required
              />
              <Input id="lead-phone" label={he.phone} value={phone} onChange={(ev) => setPhone(ev.target.value)} inputMode="tel" />
              <Input id="lead-email" label={he.email} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
            </div>
          ) : null}
        </section>

        <section className="lead-intake-section" aria-labelledby="lead-sec-opportunity">
          <h3 id="lead-sec-opportunity" className="lead-intake-section-title">
            {he.leadsSectionOpportunity}
          </h3>
          <Select
            id="lead-service"
            label={he.leadsServiceType}
            value={serviceType}
            onChange={(ev) => setServiceType(ev.target.value as LeadServiceType)}
          >
            {LEAD_SERVICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {he.leadServiceTypes[value]}
              </option>
            ))}
          </Select>
          <Select id="lead-source" label={he.leadsSource} value={source} onChange={(ev) => setSource(ev.target.value as LeadSource)}>
            {LEAD_SOURCES.map((value) => (
              <option key={value} value={value}>
                {he.leadSources[value]}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select id="lead-priority" label={he.leadsPriority} value={priority} onChange={(ev) => setPriority(ev.target.value as LeadPriority)}>
              {LEAD_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {he.leadPriorities[value]}
                </option>
              ))}
            </Select>
            <Select id="lead-status" label={he.status} value={status} onChange={(ev) => setStatus(ev.target.value as LeadStatus)}>
              {LEAD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {he.leadStatuses[value]}
                </option>
              ))}
            </Select>
          </div>
          <Input id="lead-next-action" label={he.leadsNextAction} value={nextAction} onChange={(ev) => setNextAction(ev.target.value)} />
          <Input
            id="lead-next-action-date"
            label={he.leadsNextActionDate}
            type="date"
            value={nextActionAt}
            onChange={(ev) => setNextActionAt(ev.target.value)}
          />
        </section>

        <section className="lead-intake-section" aria-labelledby="lead-sec-site">
          <h3 id="lead-sec-site" className="lead-intake-section-title">
            {he.leadsSectionSite}
          </h3>
          {!customerId && customerMode !== "new" ? (
            <p className="text-sm text-fg-muted">{he.leadsSiteNeedsCustomer}</p>
          ) : (
            <>
              <ModeRadios
                name="lead-site-mode"
                value={siteMode}
                onChange={(mode) => {
                  setSiteMode(mode);
                  if (mode !== "existing") setSiteId("");
                }}
                options={[
                  { value: "existing", label: he.leadsSiteExisting, disabled: !customerId },
                  ...(canCreateSite ? [{ value: "new" as const, label: he.leadsSiteNew }] : []),
                  { value: "unknown", label: he.leadsSiteUnknown },
                ]}
              />

              {siteMode === "existing" && customerId ? (
                <LeadSitePicker
                  sites={customerSites}
                  loading={sitesQuery.isLoading}
                  siteId={siteId}
                  onSelect={setSiteId}
                  onClear={() => setSiteId("")}
                />
              ) : null}

              {siteMode === "new" ? (
                <div className="grid gap-3">
                  <Input id="lead-site-name" label={he.name} value={siteName} onChange={(ev) => setSiteName(ev.target.value)} />
                  {selectedCustomer && hasAddress(selectedCustomer.billing_address) ? (
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSiteAddress(parseAddress(selectedCustomer.billing_address))}
                      >
                        {he.leadsUseCustomerAddress}
                      </Button>
                    </div>
                  ) : null}
                  <div className="customer-360-address-fields">
                    <div className="customer-360-address-grid">
                      <Input
                        id="lead-site-street"
                        label={he.customer360Street}
                        value={siteAddress.street ?? ""}
                        onChange={(ev) => setSiteAddress({ ...siteAddress, street: ev.target.value })}
                      />
                      <Input
                        id="lead-site-house"
                        label={he.customer360HouseNumber}
                        value={siteAddress.house_number ?? ""}
                        onChange={(ev) => setSiteAddress({ ...siteAddress, house_number: ev.target.value })}
                      />
                    </div>
                    <div className="customer-360-address-grid">
                      <Input
                        id="lead-site-city"
                        label={he.customer360City}
                        value={siteAddress.city ?? ""}
                        onChange={(ev) => setSiteAddress({ ...siteAddress, city: ev.target.value })}
                      />
                      <Input
                        id="lead-site-floor"
                        label={he.customer360Floor}
                        value={siteAddress.floor ?? ""}
                        onChange={(ev) => setSiteAddress({ ...siteAddress, floor: ev.target.value })}
                      />
                    </div>
                  </div>
                  <Input
                    id="lead-property"
                    label={he.leadsProperty}
                    value={propertyNotes}
                    onChange={(ev) => setPropertyNotes(ev.target.value)}
                  />
                </div>
              ) : null}

              {siteMode === "unknown" && customerMode === "none" ? (
                <Input
                  id="lead-address-temp"
                  label={he.leadsAddress}
                  value={addressText}
                  onChange={(ev) => setAddressText(ev.target.value)}
                />
              ) : null}
            </>
          )}
        </section>

        {(serviceType === "cctv" || serviceType === "alarm") ? (
          <section className="lead-intake-section" aria-labelledby="lead-sec-req">
            <h3 id="lead-sec-req" className="lead-intake-section-title">
              {he.leadsSectionRequirements}
            </h3>
            {serviceType === "cctv" ? (
              <div className="grid gap-3">
                <Input
                  id="lead-camera-count"
                  label={he.leadsReqCamerasLabel}
                  value={cctv.cameraCount}
                  onChange={(ev) => setCctv({ ...cctv, cameraCount: ev.target.value.replace(/\D/g, "") })}
                  inputMode="numeric"
                />
                <ChoiceGroup
                  legend={he.leadsReqLocation}
                  name="lead-location"
                  value={cctv.location}
                  onChange={(value) => setCctv({ ...cctv, location: value as CctvRequirementDraft["location"] })}
                  options={[
                    { value: "indoor", label: he.leadsReqLocationIndoor },
                    { value: "outdoor", label: he.leadsReqLocationOutdoor },
                    { value: "both", label: he.leadsReqLocationBoth },
                  ]}
                />
                <ChoiceGroup
                  legend={he.leadsReqInfrastructure}
                  name="lead-infra"
                  value={cctv.infrastructure}
                  onChange={(value) =>
                    setCctv({ ...cctv, infrastructure: value as CctvRequirementDraft["infrastructure"] })
                  }
                  options={[
                    { value: "existing", label: he.leadsReqInfraExisting },
                    { value: "partial", label: he.leadsReqInfraPartial },
                    { value: "new", label: he.leadsReqInfraNew },
                  ]}
                />
                <ChoiceGroup
                  legend={he.leadsReqRecording}
                  name="lead-recording"
                  value={cctv.recording ? "yes" : "no"}
                  onChange={(value) => setCctv({ ...cctv, recording: value === "yes" })}
                  options={[
                    { value: "yes", label: he.leadsReqYes },
                    { value: "no", label: he.leadsReqNo },
                  ]}
                />
                <ChoiceGroup
                  legend={he.leadsReqRemote}
                  name="lead-remote"
                  value={cctv.remoteViewing ? "yes" : "no"}
                  onChange={(value) => setCctv({ ...cctv, remoteViewing: value === "yes" })}
                  options={[
                    { value: "yes", label: he.leadsReqYes },
                    { value: "no", label: he.leadsReqNo },
                  ]}
                />
              </div>
            ) : (
              <div className="grid gap-3">
                <Input
                  id="lead-alarm-system"
                  label={he.leadsReqAlarmSystem}
                  value={alarm.systemType}
                  onChange={(ev) => setAlarm({ ...alarm, systemType: ev.target.value })}
                />
                <Input
                  id="lead-alarm-zones"
                  label={he.leadsReqZones}
                  value={alarm.zoneCount}
                  onChange={(ev) => setAlarm({ ...alarm, zoneCount: ev.target.value.replace(/\D/g, "") })}
                  inputMode="numeric"
                />
                <Input
                  id="lead-alarm-detectors"
                  label={he.leadsReqDetectors}
                  value={alarm.detectors}
                  onChange={(ev) => setAlarm({ ...alarm, detectors: ev.target.value })}
                />
                <ChoiceGroup
                  legend={he.leadsReqMagnets}
                  name="lead-magnets"
                  value={alarm.magnets ? "yes" : "no"}
                  onChange={(value) => setAlarm({ ...alarm, magnets: value === "yes" })}
                  options={[
                    { value: "yes", label: he.leadsReqYes },
                    { value: "no", label: he.leadsReqNo },
                  ]}
                />
                <ChoiceGroup
                  legend={he.leadsReqSiren}
                  name="lead-siren"
                  value={alarm.siren ? "yes" : "no"}
                  onChange={(value) => setAlarm({ ...alarm, siren: value === "yes" })}
                  options={[
                    { value: "yes", label: he.leadsReqYes },
                    { value: "no", label: he.leadsReqNo },
                  ]}
                />
                <ChoiceGroup
                  legend={he.leadsReqApp}
                  name="lead-app"
                  value={alarm.app ? "yes" : "no"}
                  onChange={(value) => setAlarm({ ...alarm, app: value === "yes" })}
                  options={[
                    { value: "yes", label: he.leadsReqYes },
                    { value: "no", label: he.leadsReqNo },
                  ]}
                />
              </div>
            )}
          </section>
        ) : null}

        <section className="lead-intake-section" aria-labelledby="lead-sec-notes">
          <h3 id="lead-sec-notes" className="lead-intake-section-title">
            {he.leadsSectionFollowUp}
          </h3>
          <Input id="lead-notes" label={he.notes} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        </section>

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>
    </QuoteFlowSheet>
  );
}

function ModeRadios<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="lead-intake-modes" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label key={opt.value} className={`lead-intake-mode${value === opt.value ? " is-selected" : ""}`}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={opt.disabled}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function ChoiceGroup({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset className="lead-intake-fieldset">
      <legend className="lead-intake-legend">{legend}</legend>
      <div className="lead-intake-modes is-compact">
        {options.map((opt) => (
          <label key={opt.value} className={`lead-intake-mode${value === opt.value ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LeadCustomerPicker({
  workspaceId,
  api,
  customerId,
  selected,
  loading,
  onSelect,
  onClear,
  onCreateNew,
}: {
  workspaceId: string;
  api: ApiClient;
  customerId: string;
  selected: CustomerOut | null;
  loading: boolean;
  onSelect: (row: CustomerOut) => void;
  onClear: () => void;
  onCreateNew?: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [q]);

  const customersQuery = useQuery({
    queryKey: ["lead-customer-picker", workspaceId, debounced],
    enabled: !customerId,
    queryFn: () => api.listCustomers(workspaceId, { q: debounced || undefined, limit: 20 }),
  });

  if (customerId) {
    if (loading && !selected) {
      return (
        <div className="lead-intake-selected" aria-busy>
          <div className="quote-flow-skeleton-line w-1/2" />
          <div className="quote-flow-skeleton-line w-1/3 mt-2" />
        </div>
      );
    }
    if (!selected) return null;
    return (
      <div className="lead-intake-selected" data-testid="lead-selected-customer">
        <div className="lead-intake-selected-head">
          <span className="lead-intake-selected-check" aria-hidden>
            ✓
          </span>
          <div className="min-w-0">
            <p className="lead-intake-selected-label">{he.leadsCustomerSelected}</p>
            <p className="lead-intake-selected-name">{selected.display_name}</p>
            {selected.phone ? (
              <p className="lead-intake-selected-meta" dir="ltr">
                {selected.phone}
              </p>
            ) : null}
            {selected.email ? (
              <p className="lead-intake-selected-meta" dir="ltr">
                {selected.email}
              </p>
            ) : null}
            <div className="mt-2">
              <Status label={customerStatusLabel(selected.status)} tone={customerStatusTone(selected.status)} />
            </div>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onClear}>
          {he.leadsChangeCustomer}
        </Button>
      </div>
    );
  }

  const items = customersQuery.data?.items ?? [];

  return (
    <div className="grid gap-3">
      <label className="sr-only" htmlFor="lead-customer-search">
        {he.leadsSearchCustomer}
      </label>
      <div className="lead-intake-search-wrap">
        <Search className="lead-intake-search-icon size-4" aria-hidden />
        <input
          id="lead-customer-search"
          data-testid="lead-customer-search"
          data-autofocus
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder={he.leadsSearchCustomerPlaceholder}
          autoComplete="off"
          className="quote-flow-search lead-intake-search"
        />
      </div>

      <ul className="quote-flow-list" role="listbox" aria-label={he.customersTitle}>
        {customersQuery.isFetching
          ? [0, 1, 2].map((i) => (
              <li key={i} className="quote-flow-skeleton" aria-hidden>
                <span className="quote-flow-skeleton-icon" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="quote-flow-skeleton-line w-2/3" />
                  <span className="quote-flow-skeleton-line w-1/2" />
                </span>
              </li>
            ))
          : null}

        {!customersQuery.isFetching
          ? items.map((row) => (
              <li key={row.id} role="option">
                <button
                  type="button"
                  className="quote-flow-action"
                  data-testid={`lead-customer-result-${row.id}`}
                  onClick={() => onSelect(row)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onSelect(row);
                    }
                  }}
                >
                  <span className="quote-flow-action-icon" aria-hidden>
                    <User className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-semibold text-fg">{row.display_name}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {row.phone ? <span className="ltr-meta">{row.phone}</span> : null}
                      {row.phone && row.status ? " · " : null}
                      {customerStatusLabel(row.status)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          : null}

        {debounced && !customersQuery.isFetching && items.length === 0 ? (
          <li className="quote-flow-empty">
            <p className="text-sm font-medium text-fg">{he.leadsNoCustomersFound}</p>
            <p className="mt-1 text-xs text-fg-muted">{he.leadsNoCustomersFoundBody}</p>
            {onCreateNew ? (
              <button type="button" className="quote-flow-empty-cta mt-4" onClick={onCreateNew}>
                {he.leadsCreateCustomerInline}
              </button>
            ) : null}
          </li>
        ) : null}

        {!debounced && !customersQuery.isFetching && items.length === 0 ? (
          <li className="px-1 py-6 text-center text-sm text-fg-muted">{he.leadsSearchCustomerHint}</li>
        ) : null}
      </ul>
    </div>
  );
}

function LeadSitePicker({
  sites,
  loading,
  siteId,
  onSelect,
  onClear,
}: {
  sites: SiteOut[];
  loading: boolean;
  siteId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = sites.filter((site) => {
    if (!needle) return true;
    const blob = `${site.name} ${formatAddressLine(site.address)}`.toLowerCase();
    return blob.includes(needle);
  });
  const selected = sites.find((site) => site.id === siteId) ?? null;

  if (selected) {
    const lines = formatAddressLines(selected.address);
    return (
      <div className="lead-intake-selected" data-testid="lead-selected-site">
        <div className="lead-intake-selected-head">
          <span className="lead-intake-selected-check" aria-hidden>
            ✓
          </span>
          <div className="min-w-0">
            <p className="lead-intake-selected-label">{he.leadsSiteSelected}</p>
            <p className="lead-intake-selected-name">{selected.name}</p>
            {lines.map((line) => (
              <p key={line} className="lead-intake-selected-meta">
                {line}
              </p>
            ))}
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onClear}>
          {he.leadsChangeSite}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="lead-intake-search-wrap">
        <Search className="lead-intake-search-icon size-4" aria-hidden />
        <input
          id="lead-site-search"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder={he.leadsSearchSitePlaceholder}
          autoComplete="off"
          className="quote-flow-search lead-intake-search"
        />
      </div>
      <ul className="quote-flow-list">
        {loading
          ? [0, 1].map((i) => (
              <li key={i} className="quote-flow-skeleton" aria-hidden>
                <span className="quote-flow-skeleton-icon" />
                <span className="quote-flow-skeleton-line w-2/3" />
              </li>
            ))
          : null}
        {!loading
          ? filtered.map((site) => (
              <li key={site.id}>
                <button type="button" className="quote-flow-action" onClick={() => onSelect(site.id)}>
                  <span className="quote-flow-action-icon" aria-hidden>
                    <Building2 className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-semibold text-fg">{site.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {formatAddressLine(site.address) || "—"}
                    </span>
                  </span>
                </button>
              </li>
            ))
          : null}
        {!loading && filtered.length === 0 ? (
          <li className="quote-flow-empty">
            <p className="text-sm font-medium text-fg">{he.leadsNoSitesFound}</p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

