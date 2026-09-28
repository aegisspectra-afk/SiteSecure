import type { CustomerOut, EquipmentOut, JobOut, QuoteOut, ServiceCallOut, WarrantyOut } from "@site-secure/api-client";
import { ApiClientError } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../../lib/session";
import {
  CONTACT_OPTIONS,
  COVERAGE_OPTIONS,
  DURATION_PRESETS,
  EXCLUSION_OPTIONS,
  REQUIREMENT_OPTIONS,
  RESOLUTION_OPTIONS,
  SHIPPING_OPTIONS,
  START_BASES,
  TONE_OPTIONS,
  WARRANTY_DISCLAIMER,
  WARRANTY_KINDS,
  WARRANTY_SUBJECTS,
  addDuration,
  appendWarrantyVersion,
  composeWarrantySections,
  durationLabel,
  emptyWarrantyPolicy,
  readWarrantyPolicy,
  rewriteWarrantySection,
  warrantyDbType,
  warrantySuggestions,
  type DurationUnit,
  type RewriteMode,
  type WarrantyPolicy,
} from "../../lib/warranty-document";
import { WarrantyDocumentView } from "./WarrantyDocumentView";

const STEPS = ["לקוח", "נושא", "פרטים", "כיסוי", "חריגים", "מימוש", "טיפול", "מסמך"] as const;

function todayIso(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function changeSummary(previous: WarrantyPolicy | null, next: WarrantyPolicy): string {
  if (!previous) return "נוצרה אחריות";
  const added = next.exclusions.filter((id) => !previous.exclusions.includes(id));
  if (added.includes("water")) return "נוספה החרגה לנזקי מים";
  if (added.length > 0 || next.exclusions_custom.join() !== previous.exclusions_custom.join()) return "עודכנו החרגות";
  if (next.turnaround_days !== previous.turnaround_days && next.turnaround_days) {
    return `שונה זמן הטיפול ל־${next.turnaround_days} ימי עסקים`;
  }
  if (next.coverage.join() !== previous.coverage.join()) return "עודכן היקף הכיסוי";
  return "עודכנו תנאי האחריות";
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function WarrantyStudio({
  open,
  mode,
  source,
  presetCustomerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit" | "duplicate";
  source?: WarrantyOut | null;
  presetCustomerId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!open) return null;
  return (
    <WarrantyStudioBody
      key={`${mode}:${source?.id ?? "new"}:${presetCustomerId ?? ""}`}
      mode={mode}
      source={source}
      presetCustomerId={presetCustomerId}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function WarrantyStudioBody({
  mode,
  source,
  presetCustomerId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit" | "duplicate";
  source?: WarrantyOut | null;
  presetCustomerId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id ?? "";
  const businessName = membership?.workspace_name ?? "";
  const actor = session?.profile?.full_name || session?.email || "משתמש";
  const existing = source ? readWarrantyPolicy(source.policy) : null;
  const lockedCustomer = mode !== "create" || Boolean(presetCustomerId);
  const [step, setStep] = useState(() => {
    if (mode !== "create") return 7;
    if (presetCustomerId) return 1;
    return 0;
  });
  const [customerId, setCustomerId] = useState(source?.customer_id || presetCustomerId || "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [siteId, setSiteId] = useState(source?.site_id || "");
  const [equipmentId, setEquipmentId] = useState(source?.equipment_id || "");
  const [title, setTitle] = useState(source?.title || existing?.subject_label || "");
  const [startsOn, setStartsOn] = useState(source?.starts_on || todayIso());
  const [policy, setPolicy] = useState<WarrantyPolicy>(() => {
    const base = existing ? { ...existing } : emptyWarrantyPolicy();
    if (mode === "duplicate") {
      return { ...base, disclaimer_accepted: false, versions: [], sent_at: null };
    }
    return base;
  });
  const [customCoverage, setCustomCoverage] = useState("");
  const [customExclusion, setCustomExclusion] = useState("");
  const [compare, setCompare] = useState(true);
  const [rewriteId, setRewriteId] = useState("opening");
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("professional");
  const [rewriteNote, setRewriteNote] = useState("");
  const [accepted, setAccepted] = useState(mode === "edit" && Boolean(existing?.disclaimer_accepted));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["warranty-customers", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listCustomers(workspaceId, { limit: 100 }),
  });
  const sitesQuery = useQuery({
    queryKey: ["warranty-sites", workspaceId, customerId],
    enabled: Boolean(workspaceId && customerId),
    queryFn: () => api.listSites(workspaceId, { customer_id: customerId, limit: 50 }),
  });
  const quotesQuery = useQuery({
    queryKey: ["warranty-quotes", workspaceId, customerId],
    enabled: Boolean(workspaceId && customerId),
    queryFn: () => api.listQuotes(workspaceId, { customer_id: customerId, limit: 30 }),
  });
  const callsQuery = useQuery({
    queryKey: ["warranty-calls", workspaceId, customerId],
    enabled: Boolean(workspaceId && customerId),
    queryFn: () => api.listServiceCalls(workspaceId, { limit: 50 }),
  });
  const jobsQuery = useQuery({
    queryKey: ["warranty-jobs", workspaceId, customerId],
    enabled: Boolean(workspaceId && customerId),
    queryFn: () => api.listJobs(workspaceId, { limit: 50, include_context: true }),
  });
  const equipmentQuery = useQuery({
    queryKey: ["warranty-equipment", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId),
    queryFn: () => api.listEquipment(workspaceId, siteId),
  });

  const customers = customersQuery.data?.items ?? [];
  const customer = customers.find((item) => item.id === customerId) ?? null;
  const filteredCustomers = customers.filter((item) => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return true;
    return [item.display_name, item.phone, item.email].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const sites = sitesQuery.data?.items ?? [];
  const siteIds = new Set(sites.map((site) => site.id));
  const quotes = (quotesQuery.data?.items ?? []) as QuoteOut[];
  const calls = ((callsQuery.data?.items ?? []) as ServiceCallOut[]).filter((call) => call.customer_id === customerId);
  const jobs = ((jobsQuery.data?.items ?? []) as JobOut[]).filter(
    (job) => job.customer_id === customerId || Boolean(job.site_id && siteIds.has(job.site_id)),
  );
  const equipment = (equipmentQuery.data?.items ?? []) as EquipmentOut[];
  const endsOn = addDuration(startsOn, policy.duration_value, policy.duration_unit);
  const suggestions = useMemo(() => warrantySuggestions(policy), [policy]);
  const customerName = customer?.display_name || source?.customer_name || "";

  function patchPolicy(partial: Partial<WarrantyPolicy>) {
    setPolicy((current) => ({ ...current, ...partial }));
  }

  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCustomer(workspaceId, {
        display_name: newName.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      setCustomerId(created.id);
      setCreatingCustomer(false);
      setNewName("");
      await customersQuery.refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "לא ניתן ליצור לקוח");
    } finally {
      setSaving(false);
    }
  }

  function pickSubject(kind: string, label: string, ref: { kind: string; id: string } | null, nextSiteId?: string | null, nextEquipmentId?: string | null) {
    patchPolicy({ subject_kind: kind, subject_label: label, subject_ref: ref });
    if (!title.trim()) setTitle(label);
    if (nextSiteId) setSiteId(nextSiteId);
    if (nextEquipmentId) setEquipmentId(nextEquipmentId);
  }

  function generate() {
    const sections = composeWarrantySections({
      policy,
      customerName,
      businessName,
      startsOn,
      endsOn,
      number: source?.number,
    });
    patchPolicy({ sections });
    setRewriteId(sections[0]?.id ?? "opening");
  }

  function applyRewrite() {
    const modeToApply: RewriteMode = rewriteNote.trim() ? "custom" : rewriteMode;
    patchPolicy({
      sections: policy.sections.map((section) =>
        section.id === rewriteId ? rewriteWarrantySection(section, modeToApply, rewriteNote) : section,
      ),
    });
    setRewriteNote("");
  }

  async function save(publish: boolean) {
    if (!customerId) {
      setError("יש לבחור לקוח");
      setStep(0);
      return;
    }
    if (!title.trim()) {
      setError("יש לתת שם לאחריות");
      setStep(2);
      return;
    }
    let next = policy;
    if (publish && next.sections.length === 0) {
      next = {
        ...next,
        sections: composeWarrantySections({ policy: next, customerName, businessName, startsOn, endsOn }),
      };
    }
    if (publish && !accepted) {
      setError("לפני השמירה יש לאשר שקראתם את הנוסח");
      return;
    }
    next = {
      ...next,
      disclaimer_accepted: publish ? true : next.disclaimer_accepted,
    };
    const summary = changeSummary(mode === "edit" ? existing : null, next);
    next = appendWarrantyVersion(next, publish ? summary : "נשמרה טיוטה", actor);
    setSaving(true);
    setError(null);
    try {
      const shared = {
        equipment_id: equipmentId || null,
        title: title.trim(),
        type: warrantyDbType(next.warranty_kind),
        starts_on: startsOn,
        ends_on: endsOn,
        policy: next as unknown as Record<string, unknown>,
      };
      if (mode === "edit" && source) {
        await api.patchWarranty(workspaceId, source.id, shared);
      } else {
        await api.createWarranty(workspaceId, {
          ...shared,
          customer_id: customerId,
          site_id: siteId || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "לא ניתן לשמור את האחריות");
    } finally {
      setSaving(false);
    }
  }

  function moveResolution(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const order = [...policy.resolution];
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragId);
    patchPolicy({ resolution: order });
    setDragId(null);
  }

  const preview = (
    <WarrantyDocumentView
      businessName={businessName}
      customerName={customerName}
      subject={policy.subject_label || title}
      number={mode === "duplicate" ? "מספר יוקצה בשמירה" : source?.number || "מספר יוקצה בשמירה"}
      startsOn={startsOn}
      endsOn={endsOn}
      sections={policy.sections}
      compare={compare}
    />
  );

  return createPortal(
    <div className="warranty-studio" role="dialog" aria-modal="true" aria-labelledby="warranty-studio-title">
      <div className="warranty-studio-panel">
        <header className="warranty-studio-bar">
          <div>
            <p className="warranty-studio-kicker">{STEPS[step]}</p>
            <h2 id="warranty-studio-title">{mode === "edit" ? "עריכת אחריות" : mode === "duplicate" ? "שכפול אחריות" : "יצירת אחריות חדשה"}</h2>
          </div>
          <button type="button" className="warranty-studio-close" onClick={onClose} aria-label="סגירה">
            <X size={18} />
          </button>
        </header>
        <ol className="warranty-studio-steps">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button type="button" className={index === step ? "is-current" : index < step ? "is-done" : ""} onClick={() => setStep(index)}>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <div className="warranty-studio-body">
          {step === 0 ? (
            <div className="warranty-studio-step">
              <label className="warranty-field">
                <span>לקוח</span>
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="חיפוש לקוח..."
                  disabled={lockedCustomer && Boolean(customerId)}
                />
              </label>
              {lockedCustomer && customerId ? null : (
                <ul className="warranty-pick-list">
                  {filteredCustomers.slice(0, 8).map((item: CustomerOut) => (
                    <li key={item.id}>
                      <button type="button" className={item.id === customerId ? "is-selected" : ""} onClick={() => setCustomerId(item.id)}>
                        <strong>{item.display_name}</strong>
                        <span>{[item.phone, item.email].filter(Boolean).join(" · ") || "ללא פרטי קשר"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {customer ? (
                <div className="warranty-mini-card">
                  <strong>{customer.display_name}</strong>
                  <span>{customer.phone || "אין טלפון"}</span>
                  <span>{customer.email || "אין אימייל"}</span>
                  <span>מספר לקוח {customer.tax_id || customer.id.slice(0, 8)}</span>
                </div>
              ) : null}
              {lockedCustomer ? null : creatingCustomer ? (
                <form className="warranty-inline-form" onSubmit={(event) => void createCustomer(event)}>
                  <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="שם הלקוח" required />
                  <input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="טלפון" />
                  <input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="אימייל" />
                  <Button type="submit" disabled={saving}>שמירת לקוח והמשך</Button>
                </form>
              ) : (
                <button type="button" className="warranty-text-action" onClick={() => setCreatingCustomer(true)}>
                  + יצירת לקוח חדש
                </button>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="warranty-studio-step">
              <p className="warranty-question">על מה ניתנת האחריות?</p>
              <div className="warranty-choice-row">
                {WARRANTY_SUBJECTS.map((item) => (
                  <button key={item.id} type="button" className={policy.subject_kind === item.id ? "is-selected" : ""} onClick={() => patchPolicy({ subject_kind: item.id })}>
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="warranty-question">בחירה מתוך היסטוריית הלקוח</p>
              <ul className="warranty-pick-list">
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <button type="button" onClick={() => pickSubject("order", quote.title || `הזמנה ${quote.number}`, { kind: "quote", id: quote.id }, quote.site_id)}>
                      <strong>{quote.number}</strong>
                      <span>{quote.title || quote.site_name || "הצעת מחיר"}</span>
                    </button>
                  </li>
                ))}
                {calls.map((call) => (
                  <li key={call.id}>
                    <button type="button" onClick={() => pickSubject("repair", call.title, { kind: "service", id: call.id }, call.site_id)}>
                      <strong>{call.title}</strong>
                      <span>קריאת שירות</span>
                    </button>
                  </li>
                ))}
                {jobs.map((job) => (
                  <li key={job.id}>
                    <button type="button" onClick={() => pickSubject("work", job.title, { kind: "job", id: job.id }, job.site_id)}>
                      <strong>{job.number || job.title}</strong>
                      <span>{job.title}</span>
                    </button>
                  </li>
                ))}
                {equipment.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => pickSubject("product", item.name, { kind: "equipment", id: item.id }, item.site_id, item.id)}>
                      <strong>{item.name}</strong>
                      <span>{item.serial || item.model || "ציוד"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <label className="warranty-field">
                <span>+ הוספה ידנית</span>
                <input
                  value={policy.subject_label}
                  onChange={(event) => patchPolicy({ subject_label: event.target.value, subject_ref: null })}
                  placeholder="שם המוצר, השירות או העבודה"
                />
              </label>
              {sites.length > 0 ? (
                <label className="warranty-field">
                  <span>אתר, אם רלוונטי</span>
                  <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                    <option value="">ללא אתר</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="warranty-studio-step">
              <label className="warranty-field">
                <span>שם האחריות</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="אחריות לתיקון מסך" />
              </label>
              <p className="warranty-question">סוג אחריות</p>
              <div className="warranty-choice-row">
                {WARRANTY_KINDS.map((item) => (
                  <button key={item.id} type="button" className={policy.warranty_kind === item.id ? "is-selected" : ""} onClick={() => patchPolicy({ warranty_kind: item.id })}>
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="warranty-question">תאריך תחילת אחריות</p>
              <div className="warranty-choice-row">
                {START_BASES.map((item) => (
                  <button key={item.id} type="button" className={policy.start_basis === item.id ? "is-selected" : ""} onClick={() => patchPolicy({ start_basis: item.id })}>
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="warranty-field">
                <span>תאריך</span>
                <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
              </label>
              <p className="warranty-question">משך אחריות</p>
              <div className="warranty-choice-row">
                {DURATION_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={policy.duration_value === item.value && policy.duration_unit === item.unit ? "is-selected" : ""}
                    onClick={() => patchPolicy({ duration_value: item.value, duration_unit: item.unit })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="warranty-duration">
                <input
                  type="number"
                  min={1}
                  value={policy.duration_value}
                  onChange={(event) => patchPolicy({ duration_value: Math.max(1, Number(event.target.value) || 1) })}
                />
                <select value={policy.duration_unit} onChange={(event) => patchPolicy({ duration_unit: event.target.value as DurationUnit })}>
                  <option value="days">ימים</option>
                  <option value="months">חודשים</option>
                  <option value="years">שנים</option>
                </select>
                <span>סיום {endsOn}</span>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <ChoiceStep
              title="מה האחריות כוללת?"
              options={COVERAGE_OPTIONS}
              selected={policy.coverage}
              onToggle={(id) => patchPolicy({ coverage: toggle(policy.coverage, id) })}
              custom={customCoverage}
              onCustom={setCustomCoverage}
              customLabel="+ הוספת תנאי מותאם אישית"
              extras={policy.coverage_custom}
              onAddCustom={() => {
                if (!customCoverage.trim()) return;
                patchPolicy({ coverage_custom: [...policy.coverage_custom, customCoverage.trim()] });
                setCustomCoverage("");
              }}
            />
          ) : null}

          {step === 4 ? (
            <ChoiceStep
              title="מה האחריות אינה כוללת?"
              options={EXCLUSION_OPTIONS}
              selected={policy.exclusions}
              onToggle={(id) => patchPolicy({ exclusions: toggle(policy.exclusions, id) })}
              custom={customExclusion}
              onCustom={setCustomExclusion}
              customLabel="+ הוספת החרגה מותאמת אישית"
              extras={policy.exclusions_custom}
              onAddCustom={() => {
                if (!customExclusion.trim()) return;
                patchPolicy({ exclusions_custom: [...policy.exclusions_custom, customExclusion.trim()] });
                setCustomExclusion("");
              }}
            />
          ) : null}

          {step === 5 ? (
            <div className="warranty-studio-step">
              <ChoiceStep
                title="מה הלקוח צריך לצורך מימוש האחריות?"
                options={REQUIREMENT_OPTIONS}
                selected={policy.requirements}
                onToggle={(id) => patchPolicy({ requirements: toggle(policy.requirements, id) })}
              />
              <p className="warranty-question">כיצד הלקוח יכול לממש את האחריות?</p>
              <div className="warranty-choice-row">
                {CONTACT_OPTIONS.map((item) => (
                  <button key={item.id} type="button" className={policy.contact_methods.includes(item.id) ? "is-selected" : ""} onClick={() => patchPolicy({ contact_methods: toggle(policy.contact_methods, item.id) })}>
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="warranty-field">
                <span>פרטי קשר</span>
                <input value={policy.contact_details} onChange={(event) => patchPolicy({ contact_details: event.target.value })} placeholder="טלפון, אימייל או כתובת" />
              </label>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="warranty-studio-step">
              <p className="warranty-question">פתרון במקרה של תקלה</p>
              <p className="warranty-hint">גררו כדי לקבוע את סדר העדיפויות.</p>
              <ol className="warranty-rank">
                {policy.resolution.map((id, index) => {
                  const label = RESOLUTION_OPTIONS.find((item) => item.id === id)?.label ?? id;
                  return (
                    <li
                      key={id}
                      draggable
                      onDragStart={() => setDragId(id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveResolution(id)}
                    >
                      <span>{index + 1}</span>
                      {label}
                    </li>
                  );
                })}
              </ol>
              <p className="warranty-question">האם האחריות ניתנת להעברה לבעלים אחר?</p>
              <YesNo value={policy.transferable} onChange={(value) => patchPolicy({ transferable: value })} />
              <p className="warranty-question">האם האחריות תקפה ללא קבלה?</p>
              <YesNo value={policy.valid_without_receipt} onChange={(value) => patchPolicy({ valid_without_receipt: value })} />
              <p className="warranty-question">מי משלם על המשלוח במקרה של תיקון?</p>
              <div className="warranty-choice-row">
                {SHIPPING_OPTIONS.map((item) => (
                  <button key={item.id} type="button" className={policy.shipping === item.id ? "is-selected" : ""} onClick={() => patchPolicy({ shipping: item.id })}>
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="warranty-field">
                <span>זמן טיפול משוער</span>
                <input
                  type="number"
                  min={1}
                  value={policy.turnaround_days ?? ""}
                  placeholder="14"
                  onChange={(event) => patchPolicy({ turnaround_days: event.target.value ? Number(event.target.value) : null })}
                />
                <em>ימי עסקים</em>
              </label>
              <label className="warranty-field">
                <span>תנאים נוספים</span>
                <textarea value={policy.additional_terms} onChange={(event) => patchPolicy({ additional_terms: event.target.value })} rows={3} />
              </label>
            </div>
          ) : null}

          {step === 7 ? (
            <div className="warranty-review">
              <aside>
                <p className="warranty-question">הנתונים שנבחרו</p>
                <ul className="warranty-source-list">
                  <li>{customerName || "לקוח"}</li>
                  <li>{title || "ללא שם"}</li>
                  <li>{policy.subject_label || "ללא נושא"}</li>
                  <li>{durationLabel(policy.duration_value, policy.duration_unit)}</li>
                  <li>{startsOn} → {endsOn}</li>
                </ul>
                {suggestions.length > 0 ? (
                  <div className="warranty-suggestions">
                    <p>חסרים {suggestions.length} פרטים שכדאי להגדיר לפני יצירת המסמך.</p>
                    <ul>
                      {suggestions.map((item) => (
                        <li key={item.id}>{item.text}</li>
                      ))}
                    </ul>
                    <p className="warranty-hint">ההצעות הן המלצות בלבד.</p>
                  </div>
                ) : null}
                <p className="warranty-question">רמת ניסוח</p>
                <div className="warranty-choice-row">
                  {TONE_OPTIONS.map((item) => (
                    <button key={item.id} type="button" className={policy.tone === item.id ? "is-selected" : ""} onClick={() => patchPolicy({ tone: item.id })}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <Button type="button" onClick={generate}>יצירת נוסח אחריות מקצועי</Button>
                <p className="warranty-hint">המערכת הפכה את הבחירות שלך למסמך אחריות מקצועי ומסודר.</p>
                {policy.sections.length > 0 ? (
                  <div className="warranty-rewrite">
                    <p className="warranty-question">עריכה באמצעות ניסוח</p>
                    <select value={rewriteId} onChange={(event) => setRewriteId(event.target.value)}>
                      {policy.sections.map((section) => (
                        <option key={section.id} value={section.id}>{section.heading}</option>
                      ))}
                    </select>
                    <div className="warranty-choice-row">
                      {(
                        [
                          ["professional", "נסח בצורה מקצועית יותר"],
                          ["shorter", "קצר"],
                          ["longer", "הרחב"],
                          ["clearer", "הפוך לברור יותר"],
                          ["formal", "הפוך לרשמי יותר"],
                          ["simple", "כתוב בשפה פשוטה יותר"],
                        ] as const
                      ).map(([id, label]) => (
                        <button key={id} type="button" className={rewriteMode === id ? "is-selected" : ""} onClick={() => setRewriteMode(id)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="warranty-field">
                      <span>מה תרצה לשנות?</span>
                      <input value={rewriteNote} onChange={(event) => setRewriteNote(event.target.value)} placeholder='לדוגמה: תוסיף שהלקוח משלם על המשלוח' />
                    </label>
                    <button type="button" className="warranty-text-action" onClick={applyRewrite}>
                      החלת השינוי על הסעיף
                    </button>
                    <button type="button" className="warranty-text-action" onClick={() => setCompare((value) => !value)}>
                      {compare ? "הסתרת השוואה" : "השוואת בחירה מול נוסח"}
                    </button>
                  </div>
                ) : null}
                {policy.versions.length > 0 ? (
                  <div>
                    <p className="warranty-question">היסטוריית גרסאות</p>
                    <ul className="warranty-source-list">
                      {policy.versions.map((version) => (
                        <li key={`${version.version}-${version.at}`}>
                          Version {version.version} · {version.summary} · {version.actor}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </aside>
              <div>
                {policy.sections.length > 0 ? preview : <p className="warranty-hint">אחרי יצירת הנוסח יופיע כאן המסמך כפי שהלקוח יקבל אותו.</p>}
                <p className="warranty-disclaimer">{WARRANTY_DISCLAIMER}</p>
                <label className="warranty-confirm">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>קראתי את הנוסח ואני מאשר/ת את תוכנו לפני השימוש בו.</span>
                </label>
              </div>
            </div>
          ) : null}
          {error ? <p className="warranty-error">{error}</p> : null}
        </div>
        <footer className="warranty-studio-foot">
          <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            חזרה
          </Button>
          {step < 7 ? (
            <Button
              type="button"
              disabled={(step === 0 && !customerId) || (step === 1 && !policy.subject_label.trim()) || (step === 2 && !title.trim())}
              onClick={() => setStep((value) => Math.min(7, value + 1))}
            >
              המשך
            </Button>
          ) : (
            <div className="warranty-save-row">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => void save(false)}>
                שמירה כטיוטה
              </Button>
              <Button type="button" disabled={saving || !accepted} onClick={() => void save(true)}>
                {saving ? "שומרים…" : "שמירת אחריות"}
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function ChoiceStep({
  title,
  options,
  selected,
  onToggle,
  custom,
  onCustom,
  customLabel,
  extras = [],
  onAddCustom,
}: {
  title: string;
  options: readonly { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  custom?: string;
  onCustom?: (value: string) => void;
  customLabel?: string;
  extras?: string[];
  onAddCustom?: () => void;
}) {
  return (
    <div className="warranty-studio-step">
      <p className="warranty-question">{title}</p>
      <div className="warranty-choice-row">
        {options.map((item) => (
          <button key={item.id} type="button" className={selected.includes(item.id) ? "is-selected" : ""} onClick={() => onToggle(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {extras.length > 0 ? <p className="warranty-hint">{extras.join(" · ")}</p> : null}
      {onAddCustom && onCustom ? (
        <div className="warranty-duration">
          <input value={custom ?? ""} onChange={(event) => onCustom(event.target.value)} placeholder={customLabel} />
          <button type="button" className="warranty-text-action" onClick={onAddCustom}>{customLabel}</button>
        </div>
      ) : null}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <div className="warranty-choice-row">
      <button type="button" className={value === true ? "is-selected" : ""} onClick={() => onChange(true)}>כן</button>
      <button type="button" className={value === false ? "is-selected" : ""} onClick={() => onChange(false)}>לא</button>
    </div>
  );
}
