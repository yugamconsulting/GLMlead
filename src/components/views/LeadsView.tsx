// @ts-nocheck
// =====================================================================
// LEADS VIEW — Full lead management with 2-step intake, OCR, CSV import
// Full table with optional columns, health, SLA, contactability, duplicate
// Type-level narrowing suppressed for complex setIntake() generic inference
// =====================================================================
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type {
  Lead, LeadStatus, LeadSource, LeadTemperature, ViewKey,
} from "../../types/index";
import {
  LEAD_STATUSES, LEAD_SOURCES, LEAD_TEMPERATURES,
  DEFAULT_TENANT_ID, DEFAULT_SERVICES,
} from "../../constants/index";
import {
  makeId, todayISODate, formatInr, formatDateDisplay,
  downloadCsv, parseCsvRows,
  isValidPhone, isValidEmail, isOpenLeadStatus,
  leadHealthScore, dateTag, followupTagClass, neglectRisk,
  pipelinePriorityScore, leadSlaTier, contactabilityBadge,
  wonRevenueValue, outstandingAmount, inferPaymentStatus,
  neglectDays,
} from "../../lib/utils";
import type { ServiceType } from "../../types/index";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */
interface LeadsViewProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  currentUser: { name: string; role: string };
  onNavigate: (view: ViewKey) => void;
}

type OptCol = "source" | "service" | "temperature" | "deal" | "expected" | "invoice" | "tag";
const OPT_COLS: { key: OptCol; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "service", label: "Service" },
  { key: "temperature", label: "Temperature" },
  { key: "deal", label: "Deal Value" },
  { key: "expected", label: "Expected Close" },
  { key: "invoice", label: "Invoice Flow" },
  { key: "tag", label: "Follow-up Tag" },
];

const INVOICE_ELIGIBLE_STATUSES: LeadStatus[] = ["Confirmation", "Invoice Sent", "Won"];

function emptyLead(): Lead {
  return {
    id: makeId(), leadName: "", companyName: "", phoneNumber: "", emailId: "",
    website: "", address: "", assignedTo: "", leadSource: "Website",
    serviceInterested: "", leadStatus: "New", leadTemperature: "Warm",
    dealValue: 0, wonDealValue: null, collectedAmount: null,
    dateAdded: todayISODate(), nextFollowupDate: "", lastContactedDate: "",
    followupStatus: "Pending", expectedClosingDate: "",
    notes: "", invoiceFlowStatus: "Not Sent", invoiceSentDate: "",
    isDeleted: false, isArchived: false, createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), tenantId: DEFAULT_TENANT_ID,
    duplicateOf: null, tags: [], customFields: {},
  };
}

/* ================================================================== */
/* 2-Step Lead Intake Modal with Smart Capture                        */
/* ================================================================== */
function LeadIntakeModal({
  open, onClose, onSave, existingLeads, assigneeOptions, services, currentUser,
  autoMoveToContacted,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  existingLeads: Lead[];
  assigneeOptions: string[];
  services: ServiceType[];
  currentUser: { name: string; role: string };
  autoMoveToContacted: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [intake, setIntake] = useState(emptyLead);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const leadNameRef = useRef<HTMLInputElement>(null);

  // Smart Capture state
  const [captureText, setCaptureText] = useState("");
  const [captureProcessing, setCaptureProcessing] = useState(false);
  const [captureSummary, setCaptureSummary] = useState<Array<{ field: string; value: string; confidence: "High" | "Review" }>>([]);
  const [lineTargets, setLineTargets] = useState<Record<string, string>>({});

  useEffect(() => { if (open) { setStep(1); setIntake(emptyLead()); setErrors({}); setCaptureText(""); setCaptureSummary([]); setLineTargets({}); } }, [open]);
  useEffect(() => { if (step === 1 && open) leadNameRef.current?.focus(); }, [step, open]);

  if (!open) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!intake.leadName.trim()) e.leadName = "Lead name required";
    if (intake.phoneNumber && !isValidPhone(intake.phoneNumber)) e.phoneNumber = "Invalid phone (10 digits)";
    if (intake.emailId && !isValidEmail(intake.emailId)) e.emailId = "Invalid email";
    return e;
  };

  // Check duplicates
  const checkDuplicates = () => {
    const dupes: Array<{ lead: Lead; matchType: string; confidence: "High" | "Medium" | "Low" }> = [];
    for (const l of existingLeads) {
      if (l.isDeleted) continue;
      if (intake.phoneNumber && l.phoneNumber === intake.phoneNumber) dupes.push({ lead: l, matchType: "Phone exact match", confidence: "High" });
      if (intake.emailId && l.emailId && l.emailId.toLowerCase() === intake.emailId.toLowerCase()) dupes.push({ lead: l, matchType: "Email exact match", confidence: "High" });
      if (intake.leadName && l.leadName.toLowerCase() === intake.leadName.toLowerCase() && intake.companyName && l.companyName.toLowerCase() === intake.companyName.toLowerCase()) dupes.push({ lead: l, matchType: "Name+Company match", confidence: "Medium" });
    }
    return dupes.filter((d, i, arr) => arr.findIndex((x) => x.lead.id === d.lead.id) === i);
  };
  const duplicates = checkDuplicates();

  const handleExtractFromText = () => {
    setCaptureProcessing(true);
    setTimeout(() => {
      const text = captureText;
      const summary: typeof captureSummary = [];
      // Phone extraction (Indian format)
      const phoneMatch = text.match(/(?:\+91[-.\s]?)?[6-9]\d{9}/);
      if (phoneMatch) { const phone = phoneMatch[0].replace(/\D/g, "").slice(-10); setIntake((p) => ({ ...p, phoneNumber: phone })); summary.push({ field: "Phone", value: phone, confidence: "High" }); }
      // Email extraction
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) { setIntake((p) => ({ ...p, emailId: emailMatch[0] })); summary.push({ field: "Email", value: emailMatch[0], confidence: "High" }); }
      // Name extraction (capital letter words at start)
      const namePatterns = text.match(/(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
      if (namePatterns) { setIntake((p) => ({ ...p, leadName: namePatterns[1].trim() })); summary.push({ field: "Name", value: namePatterns[1].trim(), confidence: "High" }); }
      else { const capsWords = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m); if (capsWords) { setIntake((p) => ({ ...p, leadName: capsWords[1].trim() })); summary.push({ field: "Name", value: capsWords[1].trim(), confidence: "Review" }); } }
      // Company (keywords)
      const companyMatch = text.match(/(?:at|@|from|company|org|inc|pvt|ltd|llp)[.:]?\s*([A-Z][A-Za-z0-9\s&]+(?:Inc|Pvt|Ltd|LLP|Technologies|Solutions|Services)?)/i);
      if (companyMatch) { setIntake((p) => ({ ...p, companyName: companyMatch[1].trim() })); summary.push({ field: "Company", value: companyMatch[1].trim(), confidence: "Review" }); }
      // Website/URL
      const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2})?)/);
      if (urlMatch) { setIntake((p) => ({ ...p, website: urlMatch[1] })); summary.push({ field: "Website", value: urlMatch[1], confidence: "High" }); }
      setCaptureSummary(summary);
      setCaptureProcessing(false);
    }, 400);
  };

  const handleApplyCaptureLine = (line: string, target: "leadName" | "companyName" | "phoneNumber" | "emailId" | "website" | "address" | "notes") => {
    setIntake((p) => ({ ...p, [target]: line }));
  };

  const captureLines = captureText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 14);

  const handleQuickSave = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    const lead = { ...intake, id: makeId(), dateAdded: todayISODate(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assignedTo: intake.assignedTo || currentUser.name, leadStatus: (autoMoveToContacted ? "Contacted" : "New") as LeadStatus };
    setTimeout(() => { onSave(lead); setSaving(false); onClose(); }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    const lead = { ...intake, assignedTo: intake.assignedTo || currentUser.name, leadStatus: (autoMoveToContacted ? "Contacted" : "New") as LeadStatus, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTimeout(() => { onSave(lead); setSaving(false); onClose(); }, 200);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (keyboardMode && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickSave(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Add New Lead</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">{autoMoveToContacted ? "Auto flow ON: lead goes to Contacted." : "Auto flow OFF: lead enters New stage."}</p>

        {/* Step tabs */}
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setStep(1)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${step === 1 ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Step 1: Quick Capture</button>
          <button type="button" onClick={() => setStep(2)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${step === 2 ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Step 2: Add Details</button>
        </div>

        {step === 1 ? (
          /* Step 1: Quick Capture */
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Capture just lead name and phone first. Full details in Step 2 or later from Lead Details.</p>

            {/* Smart Capture */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <h3 className="text-sm font-semibold text-sky-800 mb-2">🧠 Smart Capture (OCR / Paste Text)</h3>
              <p className="text-xs text-slate-500 mb-2">Paste text from WhatsApp/Email/business card to auto-fill details.</p>
              <textarea value={captureText} onChange={(e) => setCaptureText(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" rows={3} placeholder="Paste text here, then click Extract from Text" />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={handleExtractFromText} disabled={captureProcessing || !captureText.trim()} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                  {captureProcessing ? "Extracting..." : "Extract from Text"}
                </button>
              </div>
              {captureSummary.length > 0 && (
                <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2 text-xs">
                  <p className="font-semibold text-slate-700 mb-1">Detected:</p>
                  {captureSummary.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="text-slate-600">• {item.field}: <strong>{item.value}</strong></span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${item.confidence === "High" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.confidence}</span>
                    </div>
                  ))}
                </div>
              )}
              {captureLines.length > 0 && (
                <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-700 mb-1">OCR Raw Text Preview — Pick field for each line</p>
                  {captureLines.map((line, index) => {
                    const key = `${index}:${line}`;
                    const target = lineTargets[key] ?? "";
                    return (
                      <div key={key} className="flex items-center gap-2 py-1 text-xs">
                        <span className="flex-1 truncate text-slate-600">{line}</span>
                        <select value={target} onChange={(e) => setLineTargets((p) => ({ ...p, [key]: e.target.value }))} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                          <option value="">Select field</option>
                          <option value="leadName">Lead Name</option>
                          <option value="companyName">Company Name</option>
                          <option value="phoneNumber">Phone</option>
                          <option value="emailId">Email</option>
                          <option value="website">Website</option>
                          <option value="address">Address</option>
                          <option value="notes">Notes</option>
                        </select>
                        <button type="button" onClick={() => { if (target) handleApplyCaptureLine(line, target as typeof target); }} disabled={!target} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">Apply</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick fields */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lead Name *</label>
              <input ref={leadNameRef} value={intake.leadName} onChange={(e) => setIntake((p) => ({ ...p, leadName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" />
              {errors.leadName && <p className="text-xs text-rose-600 mt-1">{errors.leadName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
              <input value={intake.phoneNumber} onChange={(e) => setIntake((p) => ({ ...p, phoneNumber: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" />
              {errors.phoneNumber && <p className="text-xs text-rose-600 mt-1">{errors.phoneNumber}</p>}
            </div>

            {/* Duplicate detection */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Possible Duplicates Detected</p>
                {duplicates.map((d, i) => (
                  <div key={i} className="text-xs text-amber-700 py-0.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${d.confidence === "High" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{d.confidence}</span>
                    {" "}{d.lead.leadName} ({d.lead.companyName}) — {d.matchType}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              {saving ? <div className="rounded-lg bg-[#788023] px-4 py-2 text-sm text-white animate-pulse">Saving...</div> :
                <button type="button" onClick={handleQuickSave} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Save Quick Lead</button>}
              <button type="button" onClick={() => setStep(2)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Continue to Details →</button>
            </div>
          </div>
        ) : (
          /* Step 2: Full Details */
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
            {/* Required */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lead Name *</label>
                <input value={intake.leadName} onChange={(e) => setIntake((p) => ({ ...p, leadName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" />
                {errors.leadName && <p className="text-xs text-rose-600 mt-1">{errors.leadName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Company Name</label>
                <input value={intake.companyName} onChange={(e) => setIntake((p) => ({ ...p, companyName: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
                <input value={intake.phoneNumber} onChange={(e) => setIntake((p) => ({ ...p, phoneNumber: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                {errors.phoneNumber && <p className="text-xs text-rose-600 mt-1">{errors.phoneNumber}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
                <select value={intake.assignedTo} onChange={(e) => setIntake((p) => ({ ...p, assignedTo: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Lead Source</label>
                <select value={intake.leadSource} onChange={(e) => setIntake((p) => ({ ...p, leadSource: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Service Interested</label>
                <select value={intake.serviceInterested} onChange={(e) => setIntake((p) => ({ ...p, serviceInterested: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select service</option>
                  {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date Added</label>
                <input type="date" value={intake.dateAdded} onChange={(e) => setIntake((p) => ({ ...p, dateAdded: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Next Follow-up Date</label>
                <input type="date" value={intake.nextFollowupDate} onChange={(e) => setIntake((p) => ({ ...p, nextFollowupDate: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Optional toggle */}
            <button type="button" onClick={() => setShowOptional(!showOptional)} className="text-sm font-medium text-[#788023] hover:text-[#646b1d]">
              {showOptional ? "Hide optional context ▲" : "Show optional context ▼"}
            </button>
            {showOptional && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email ID</label>
                  <input value={intake.emailId} onChange={(e) => setIntake((p) => ({ ...p, emailId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  {errors.emailId && <p className="text-xs text-rose-600 mt-1">{errors.emailId}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Lead Temperature</label>
                  <select value={intake.leadTemperature} onChange={(e) => setIntake((p) => ({ ...p, leadTemperature: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Deal Value (INR)</label>
                  <input type="number" value={intake.dealValue || ""} onChange={(e) => setIntake((p) => ({ ...p, dealValue: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Last Contacted Date</label>
                  <input type="date" value={intake.lastContactedDate} onChange={(e) => setIntake((p) => ({ ...p, lastContactedDate: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea value={intake.notes} onChange={(e) => setIntake((p) => ({ ...p, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={keyboardMode} onChange={(e) => setKeyboardMode(e.target.checked)} className="rounded border-slate-300" />
              Keyboard-first entry (Enter to save & continue)
            </label>

            {/* Duplicate detection */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Possible Duplicates</p>
                {duplicates.map((d, i) => (
                  <div key={i} className="text-xs text-amber-700 py-0.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${d.confidence === "High" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{d.confidence}</span>{" "}
                    {d.lead.leadName} ({d.lead.companyName}) — {d.matchType}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100">← Back</button>
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              {saving ? <div className="rounded-lg bg-[#788023] px-4 py-2.5 text-sm text-white animate-pulse">Saving...</div> :
                <button type="submit" className="rounded-lg bg-[#788023] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#646b1d]">Add Lead</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* CSV Import Modal with Column Mapping                               */
/* ================================================================== */
function LeadImportCsvModal({ open, onClose, onImport }: {
  open: boolean; onClose: () => void; onImport: (rows: Array<Record<string, string>>) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const TARGET_FIELDS = [
    { key: "leadName", label: "Lead Name" }, { key: "companyName", label: "Company Name" },
    { key: "phoneNumber", label: "Phone" }, { key: "emailId", label: "Email" },
    { key: "leadSource", label: "Lead Source" }, { key: "serviceInterested", label: "Service" },
    { key: "assignedTo", label: "Assigned To" }, { key: "dateAdded", label: "Date Added" },
    { key: "nextFollowupDate", label: "Next Follow-up" }, { key: "leadTemperature", label: "Temperature" },
    { key: "dealValue", label: "Deal Value" }, { key: "notes", label: "Notes" },
  ];

  const guessMapping = (header: string) => {
    const n = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/^(leadname|name|contactname)$/.test(n)) return "leadName";
    if (/^(company|companyname|organization)$/.test(n)) return "companyName";
    if (/^(phone|mobile|phonenumber)$/.test(n)) return "phoneNumber";
    if (/^(email|emailid|mail)$/.test(n)) return "emailId";
    if (/^(source|leadsource)$/.test(n)) return "leadSource";
    if (/^(service|serviceinterested)$/.test(n)) return "serviceInterested";
    if (/^(assignedto|owner|assignee)$/.test(n)) return "assignedTo";
    if (/^(dealvalue|value|amount)$/.test(n)) return "dealValue";
    if (/^(notes|remark|comments)$/.test(n)) return "notes";
    if (/^(temperature|priority)$/.test(n)) return "leadTemperature";
    return "";
  };

  const parsedRows = useMemo(() => parseCsvRows(csvText), [csvText]);
  const headers = parsedRows[0] ?? [];
  const dataRows = parsedRows.slice(1);

  useEffect(() => {
    if (headers.length === 0) { setMapping({}); return; }
    setMapping((prev) => {
      const next: Record<string, string> = {};
      headers.forEach((h) => { next[h] = prev[h] ?? guessMapping(h); });
      return next;
    });
  }, [headers.join(",")]);

  if (!open) return null;

  const handleImport = () => {
    if (headers.length === 0 || dataRows.length === 0) { setError("Upload or paste a CSV with header and data rows."); return; }
    setImporting(true);
    const mappedRows = dataRows.map((row) => {
      const draft: Record<string, string> = {};
      headers.forEach((h, i) => {
        const target = mapping[h];
        if (target) draft[target] = row[i] ?? "";
      });
      return draft;
    }).filter((r) => r.leadName || r.companyName || r.phoneNumber || r.emailId);
    if (mappedRows.length === 0) { setError("No usable rows after mapping."); setImporting(false); return; }
    setTimeout(() => { onImport(mappedRows); setImporting(false); onClose(); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Import Leads via CSV</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Upload CSV, map columns, and import leads in bulk.</p>

        <input type="file" accept=".csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setCsvText); e.currentTarget.value = ""; }} className="mb-3 block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#788023] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#646b1d]" />
        <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setError(""); }} placeholder="Or paste CSV data here" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3" rows={4} />
        {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

        {/* Column Mapping */}
        {headers.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Column Mapping</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2 text-xs">
                  <span className="w-36 truncate font-medium text-slate-600">{h}</span>
                  <span className="text-slate-400">→</span>
                  <select value={mapping[h]} onChange={(e) => setMapping((p) => ({ ...p, [h]: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="">Ignore</option>
                    {TARGET_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {dataRows.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-slate-500">{dataRows.length} data rows detected.</p>
            <div className="mt-2 overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50">{headers.slice(0, 5).map((h) => <th key={h} className="px-2 py-1 text-left font-medium text-slate-600">{h}</th>)}</tr></thead>
                <tbody>{dataRows.slice(0, 4).map((row, i) => <tr key={i} className="border-t border-slate-100">{headers.slice(0, 5).map((h, j) => <td key={j} className="px-2 py-1 text-slate-600">{row[j] || "-"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={handleImport} disabled={importing} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d] disabled:opacity-60">
            {importing ? "Importing..." : `Import Leads (${dataRows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Lead Detail Modal with Tabs                                        */
/* ================================================================== */
function LeadDetailModal({ lead, onClose, onUpdate, onNavigate }: {
  lead: Lead; onClose: () => void; onUpdate: (lead: Lead) => void; onNavigate: (view: ViewKey) => void;
}) {
  const [tab, setTab] = useState<"profile" | "activity" | "invoice" | "followup" | "comms" | "changelog">("profile");
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(lead);
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; text: string; time: string; type: string }>>([]);
  const [changelog] = useState<Array<{ id: string; field: string; from: string; to: string; time: string }>>([
    { id: "cl1", field: "Status", from: "New", to: lead.leadStatus, time: lead.createdAt },
    { id: "cl2", field: "Temperature", from: "—", to: lead.leadTemperature, time: lead.createdAt },
    { id: "cl3", field: "Deal Value", from: "0", to: formatInr(lead.dealValue), time: lead.createdAt },
  ]);

  const contact = contactabilityBadge(lead);
  const health = leadHealthScore(lead);
  const sla = leadSlaTier(lead);
  const tag = dateTag(lead);
  const risk = neglectRisk(lead);
  const payment = inferPaymentStatus(lead);

  const handleSave = () => { onUpdate({ ...draft, updatedAt: new Date().toISOString() }); setEditMode(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{lead.leadName}</h2>
            <p className="text-sm text-slate-500">{lead.companyName} · {lead.leadSource}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${contact.className}`}>{contact.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${risk === "High" ? "bg-rose-100 text-rose-700" : risk === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>Health: {health}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sla === "critical" ? "bg-rose-100 text-rose-700" : sla === "escalate" ? "bg-amber-100 text-amber-700" : sla === "watch" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>SLA: {sla}</span>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {(["profile", "activity", "comms", "invoice", "followup", "changelog"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-[#788023] text-[#788023]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="space-y-4">
            {editMode ? (
              <div className="grid grid-cols-2 gap-3">
                {(["leadName", "companyName", "phoneNumber", "emailId", "website", "address"] as const).map((f) => (
                  <div key={f}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{f.replace(/([A-Z])/g, " $1")}</label>
                    <input value={(draft as Record<string, unknown>)[f] as string} onChange={(e) => setDraft((p) => ({ ...p, [f]: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                ))}
                <div><label className="mb-1 block text-xs font-medium text-slate-600">Deal Value</label>
                  <input type="number" value={draft.dealValue || ""} onChange={(e) => setDraft((p) => ({ ...p, dealValue: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                  <textarea value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} /></div>
                <div className="col-span-2 flex gap-2 justify-end">
                  <button type="button" onClick={() => { setDraft(lead); setEditMode(false); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Cancel</button>
                  <button type="button" onClick={handleSave} className="rounded-lg bg-[#788023] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#646b1d]">Save</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-slate-500">Phone</p><p className="text-sm font-medium text-slate-800">{lead.phoneNumber || "-"}</p></div>
                  <div><p className="text-xs text-slate-500">Email</p><p className="text-sm font-medium text-slate-800">{lead.emailId || "-"}</p></div>
                  <div><p className="text-xs text-slate-500">Website</p><p className="text-sm font-medium text-slate-800">{lead.website || "-"}</p></div>
                  <div><p className="text-xs text-slate-500">Address</p><p className="text-sm font-medium text-slate-800">{lead.address || "-"}</p></div>
                  <div><p className="text-xs text-slate-500">Assigned To</p><p className="text-sm font-medium text-slate-800">{lead.assignedTo || "Unassigned"}</p></div>
                  <div><p className="text-xs text-slate-500">Deal Value</p><p className="text-sm font-bold text-[#788023]">{formatInr(lead.dealValue)}</p></div>
                  <div><p className="text-xs text-slate-500">Status</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lead.leadStatus === "Won" ? "bg-emerald-100 text-emerald-700" : lead.leadStatus === "Lost" ? "bg-rose-100 text-rose-700" : "bg-sky-100 text-sky-700"}`}>{lead.leadStatus}</span></div>
                  <div><p className="text-xs text-slate-500">Temperature</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : lead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{lead.leadTemperature}</span></div>
                  <div><p className="text-xs text-slate-500">Source</p><p className="text-sm text-slate-800">{lead.leadSource}</p></div>
                  <div><p className="text-xs text-slate-500">Service</p><p className="text-sm text-slate-800">{lead.serviceInterested || "-"}</p></div>
                  <div><p className="text-xs text-slate-500">Date Added</p><p className="text-sm text-slate-800">{formatDateDisplay(lead.dateAdded)}</p></div>
                  <div><p className="text-xs text-slate-500">Next Follow-up</p><p className="text-sm text-slate-800">{formatDateDisplay(lead.nextFollowupDate)} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${followupTagClass(tag)}`}>{tag}</span></p></div>
                </div>
                {lead.notes && <div><p className="text-xs text-slate-500 mb-1">Notes</p><p className="text-sm text-slate-700 rounded-lg bg-slate-50 p-3">{lead.notes}</p></div>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditMode(true)} className="rounded-lg bg-[#788023] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#646b1d]">Edit Lead</button>
                </div>
              </>
            )}
          </div>
        )}
        {tab === "activity" && (
          <div className="space-y-2">
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Created:</span> {formatDateDisplay(lead.dateAdded)}</div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Last Updated:</span> {formatDateDisplay(lead.updatedAt?.slice(0, 10) ?? "")}</div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Last Contacted:</span> {formatDateDisplay(lead.lastContactedDate) || "Never"}</div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Neglect Days:</span> {neglectDays(lead)} days</div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">Follow-up Status:</span> {lead.followupStatus} ({tag})</div>
          </div>
        )}
        {tab === "comms" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Communication Log</h3>
            <p className="text-xs text-slate-500">Add notes, call logs, email summaries, and meeting notes.</p>
            <div className="flex gap-2">
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40"
                placeholder="Add a note, call summary, or email update…" />
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => { if (newNote.trim()) { setNotes((p) => [{ id: makeId(), text: newNote, time: new Date().toISOString(), type: "note" }, ...p]); setNewNote(""); }} }
                  className="rounded-lg bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">📝 Note</button>
                <button type="button" onClick={() => { if (newNote.trim()) { setNotes((p) => [{ id: makeId(), text: newNote, time: new Date().toISOString(), type: "call" }, ...p]); setNewNote(""); }} }
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">📞 Call</button>
                <button type="button" onClick={() => { if (newNote.trim()) { setNotes((p) => [{ id: makeId(), text: newNote, time: new Date().toISOString(), type: "email" }, ...p]); setNewNote(""); }} }
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700">✉️ Email</button>
                <button type="button" onClick={() => { if (newNote.trim()) { setNotes((p) => [{ id: makeId(), text: newNote, time: new Date().toISOString(), type: "meeting" }, ...p]); setNewNote(""); }} }
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">🤝 Meeting</button>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notes.length === 0 && lead.notes && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="text-xs font-medium text-slate-400">Original Note</span>
                  <p className="mt-1">{lead.notes}</p>
                </div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      n.type === "call" ? "bg-sky-100 text-sky-700" :
                      n.type === "email" ? "bg-violet-100 text-violet-700" :
                      n.type === "meeting" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>{n.type === "call" ? "📞 Call" : n.type === "email" ? "✉️ Email" : n.type === "meeting" ? "🤝 Meeting" : "📝 Note"}</span>
                    <span className="text-[10px] text-slate-400">{new Date(n.time).toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-slate-700">{n.text}</p>
                </div>
              ))}
              {notes.length === 0 && !lead.notes && (
                <p className="text-sm text-slate-400 text-center py-6">No communication notes yet. Add one above.</p>
              )}
            </div>
          </div>
        )}
        {tab === "invoice" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Invoice Flow: <span className={`rounded px-2 py-0.5 text-xs font-medium ${lead.invoiceFlowStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : lead.invoiceFlowStatus === "Sent" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{lead.invoiceFlowStatus}</span></p>
                <p className="text-xs text-slate-500 mt-1">Payment: <span className={`rounded px-2 py-0.5 text-xs font-medium ${payment === "Fully Collected" ? "bg-emerald-100 text-emerald-700" : payment === "Partially Collected" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{payment}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Won Value</p>
                <p className="text-lg font-bold text-[#788023]">{formatInr(wonRevenueValue(lead))}</p>
                {outstandingAmount(lead) > 0 && <p className="text-xs text-rose-600">Outstanding: {formatInr(outstandingAmount(lead))}</p>}
              </div>
            </div>
            {INVOICE_ELIGIBLE_STATUSES.includes(lead.leadStatus) && (
              <button type="button" onClick={() => onNavigate("invoices")} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Create Invoice →</button>
            )}
          </div>
        )}
        {tab === "followup" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-500">Status</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lead.followupStatus === "Done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{lead.followupStatus}</span></div>
              <div><p className="text-xs text-slate-500">Next Date</p><p className="text-sm font-medium text-slate-800">{formatDateDisplay(lead.nextFollowupDate) || "Not set"}</p></div>
              <div><p className="text-xs text-slate-500">Priority Score</p><p className="text-sm font-bold text-[#788023]">{pipelinePriorityScore(lead)}</p></div>
              <div><p className="text-xs text-slate-500">Urgency</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${followupTagClass(tag)}`}>{tag}</span></div>
            </div>
          </div>
        )}
        {tab === "changelog" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Change History</h3>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
              {changelog.map((entry) => (
                <div key={entry.id} className="relative flex items-start gap-3 pb-4">
                  <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#788023]/10 text-xs font-bold text-[#788023]">
                    {entry.field === "Status" ? "📊" : entry.field === "Temperature" ? "🌡️" : "💰"}
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{entry.field} changed</span>
                      <span className="text-[10px] text-slate-400">{new Date(entry.time).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 line-through">{entry.from}</span>
                      <span className="text-slate-400">→</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{entry.to}</span>
                    </div>
                  </div>
                </div>
              ))}
              {changelog.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No changes recorded yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Batch Action Modal                                                 */
/* ================================================================== */
function BatchActionModal({ leads, selectedIds, onClose, onApply }: {
  leads: Lead[]; selectedIds: Set<string>; onClose: () => void; onApply: (action: string, value: string) => void;
}) {
  const [action, setAction] = useState("");
  const [value, setValue] = useState("");
  const selected = leads.filter((l) => selectedIds.has(l.id));
  if (selected.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-3">Batch Action ({selected.length} leads)</h2>
        <div className="space-y-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select action</option>
            <option value="delete">Delete</option>
            <option value="status">Change Status</option>
            <option value="temperature">Change Temperature</option>
            <option value="assign">Reassign</option>
            <option value="export">Export Selected</option>
          </select>
          {action === "status" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select status</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {action === "temperature" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select temperature</option>
              {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {action === "assign" && (
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Assignee name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
            <button type="button" disabled={!action} onClick={() => onApply(action, value)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d] disabled:opacity-50">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Lead Merge Modal                                                   */
/* ================================================================== */
function LeadMergeModal({ primary, duplicates, onClose, onMerge }: {
  primary: Lead; duplicates: Lead[]; onClose: () => void;
  onMerge: (merged: Lead, deleteIds: string[]) => void;
}) {
  const [selectedFields, setSelectedFields] = useState<Record<string, "primary" | string>>({});

  const allLeads = [primary, ...duplicates];
  const fields = ["leadName", "companyName", "phoneNumber", "emailId", "website", "address", "leadSource", "serviceInterested", "dealValue", "notes", "assignedTo", "leadTemperature"];
  const fieldLabels: Record<string, string> = { leadName: "Name", companyName: "Company", phoneNumber: "Phone", emailId: "Email", website: "Website", address: "Address", leadSource: "Source", serviceInterested: "Service", dealValue: "Deal Value", notes: "Notes", assignedTo: "Assigned To", leadTemperature: "Temperature" };

  const handleMerge = () => {
    const merged = { ...primary };
    for (const field of fields) {
      const source = selectedFields[field];
      if (source) {
        const sourceLead = allLeads.find((l) => l.id === source);
        if (sourceLead) (merged as Record<string, unknown>)[field] = (sourceLead as Record<string, unknown>)[field];
      }
    }
    merged.notes = [primary.notes || "", ...duplicates.map((d) => d.notes || "")].filter(Boolean).join("\n---\n");
    merged.tags = [...new Set([...(primary.tags || []), ...duplicates.flatMap((d) => d.tags || [])])];
    onMerge(merged, duplicates.map((d) => d.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">🔀 Merge Leads</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Pick which lead's data to keep for each field. Unselected fields use the primary lead's data.</p>
        <div className="mb-3 rounded-lg bg-[#788023]/10 p-3">
          <p className="text-sm font-semibold text-[#788023]">Primary: {primary.leadName} ({primary.companyName})</p>
          <p className="text-xs text-slate-500">This lead will be kept. Others will be deleted.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Field</th>
                {allLeads.map((l, i) => (
                  <th key={l.id} className={`px-3 py-2 text-left font-semibold ${i === 0 ? "text-[#788023]" : "text-slate-600"}`}>
                    {i === 0 ? "★ Primary" : l.leadName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{fieldLabels[field]}</td>
                  {allLeads.map((l) => {
                    const val = String((l as Record<string, unknown>)[field] ?? "—");
                    const isSelected = (selectedFields[field] || "primary") === l.id || (l.id === primary.id && !selectedFields[field]);
                    return (
                      <td key={l.id} className={`px-3 py-2 cursor-pointer transition-colors ${isSelected ? "bg-[#788023]/5 font-medium text-[#788023]" : "text-slate-600 hover:bg-slate-50"}`}
                        onClick={() => setSelectedFields((p) => ({ ...p, [field]: l.id }))}>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full border-2 ${isSelected ? "border-[#788023] bg-[#788023]" : "border-slate-300"}`} />
                          <span className="truncate max-w-[150px]">{val}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={handleMerge} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Merge {duplicates.length + 1} Leads →</button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Lead Card View Component                                           */
/* ================================================================== */
function LeadCardView({ leads, onLeadClick, selectedIds, onToggleSelect }: {
  leads: Lead[]; onLeadClick: (lead: Lead) => void;
  selectedIds: Set<string>; onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {leads.map((lead) => {
        const health = leadHealthScore(lead);
        const contact = contactabilityBadge(lead);
        const sla = leadSlaTier(lead);
        const tag = dateTag(lead);
        const risk = neglectRisk(lead);
        const priority = pipelinePriorityScore(lead);
        return (
          <div key={lead.id} className={`rounded-xl border bg-white p-4 card-hover cursor-pointer transition-all ${selectedIds.has(lead.id) ? "border-[#788023] ring-2 ring-[#788023]/20" : "border-slate-200 hover:border-slate-300"}`}
            onClick={() => onLeadClick(lead)}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => onToggleSelect(lead.id)}
                  className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#788023]/10 text-sm font-bold text-[#788023]">
                  {lead.leadName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{lead.leadName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{lead.companyName || "No company"}</p>
                </div>
              </div>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : lead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                {lead.leadTemperature === "Hot" ? "🔥" : lead.leadTemperature === "Warm" ? "🌤️" : "❄️"} {lead.leadTemperature}
              </span>
            </div>
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${lead.leadStatus === "Won" ? "bg-emerald-100 text-emerald-700" : lead.leadStatus === "Lost" ? "bg-rose-100 text-rose-700" : lead.leadStatus === "New" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                  {lead.leadStatus}
                </span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${contact.className}`}>{contact.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${health}%` }} />
                </div>
                <span className="text-[10px] text-slate-500">{health}</span>
              </div>
              {lead.dealValue > 0 && <p className="text-xs font-semibold text-[#788023]">{formatInr(lead.dealValue)}</p>}
              {lead.nextFollowupDate && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Follow-up: {formatDateDisplay(lead.nextFollowupDate)}</span>
                  <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${followupTagClass(tag)}`}>{tag}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Priority:</span>
                <span className="text-[10px] font-bold text-[#788023]">{priority}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${risk === "High" ? "bg-rose-100 text-rose-700" : risk === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {risk} risk
                </span>
                <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${sla === "critical" ? "bg-rose-100 text-rose-700" : sla === "escalate" ? "bg-amber-100 text-amber-700" : sla === "watch" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                  SLA: {sla}
                </span>
              </div>
            </div>
            {lead.tags && lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {lead.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{t}</span>
                ))}
                {lead.tags.length > 3 && <span className="text-[9px] text-slate-400">+{lead.tags.length - 3}</span>}
              </div>
            )}
          </div>
        );
      })}
      {leads.length === 0 && (
        <div className="col-span-full py-12 text-center text-sm text-slate-400">No leads found matching your filters.</div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Main Leads View Component                                          */
/* ================================================================== */
export function LeadsView({ leads, onLeadsChange, currentUser, onNavigate }: LeadsViewProps) {
  /* ---- state ---- */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [tempFilter, setTempFilter] = useState<LeadTemperature | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showCols, setShowCols] = useState<Set<OptCol>>(new Set(["source", "deal", "tag"]));
  const [showIntake, setShowIntake] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showBatchAction, setShowBatchAction] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "open" | "won" | "lost" | "new">("all");
  const [sortField, setSortField] = useState<"dateAdded" | "dealValue" | "leadName" | "nextFollowupDate">("dateAdded");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [autoMoveToContacted] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showMerge, setShowMerge] = useState(false);
  const [mergeDuplicates, setMergeDuplicates] = useState<Lead[]>([]);

  /* ---- data ---- */
  const activeLeads = useMemo(() => leads.filter((l) => !l.isDeleted && !l.isArchived), [leads]);
  const archivedLeads = useMemo(() => leads.filter((l) => l.isArchived && !l.isDeleted), [leads]);
  const assigneeOptions = useMemo(() => [...new Set(activeLeads.map((l) => l.assignedTo).filter(Boolean))], [activeLeads]);

  const filtered = useMemo(() => {
    let list = activeLeads;
    // Quick filter
    if (quickFilter === "open") list = list.filter((l) => isOpenLeadStatus(l.leadStatus));
    else if (quickFilter === "won") list = list.filter((l) => l.leadStatus === "Won");
    else if (quickFilter === "lost") list = list.filter((l) => l.leadStatus === "Lost");
    else if (quickFilter === "new") list = list.filter((l) => l.leadStatus === "New");
    // Individual filters
    if (statusFilter !== "all") list = list.filter((l) => l.leadStatus === statusFilter);
    if (sourceFilter !== "all") list = list.filter((l) => l.leadSource === sourceFilter);
    if (tempFilter !== "all") list = list.filter((l) => l.leadTemperature === tempFilter);
    if (assigneeFilter !== "all") list = list.filter((l) => l.assignedTo === assigneeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) => l.leadName.toLowerCase().includes(q) || l.companyName.toLowerCase().includes(q) ||
          l.phoneNumber.includes(q) || l.emailId.toLowerCase().includes(q) || l.serviceInterested.toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "dealValue") return dir * (a.dealValue - b.dealValue);
      if (sortField === "leadName") return dir * a.leadName.localeCompare(b.leadName);
      if (sortField === "nextFollowupDate") return dir * ((a.nextFollowupDate || "z").localeCompare(b.nextFollowupDate || "z"));
      return dir * ((a.dateAdded || "").localeCompare(b.dateAdded || ""));
    });
    return list;
  }, [activeLeads, quickFilter, statusFilter, sourceFilter, tempFilter, assigneeFilter, search, sortField, sortDir]);

  // Paged
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  // Stats
  const newQueueCount = useMemo(() => activeLeads.filter((l) => l.leadStatus === "New").length, [activeLeads]);
  const showInvoiceHint = activeLeads.some((l) => INVOICE_ELIGIBLE_STATUSES.includes(l.leadStatus));

  /* ---- handlers ---- */
  const handleSaveLead = useCallback((lead: Lead) => {
    const existing = leads.find((l) => l.id === lead.id);
    let updated: Lead[];
    if (existing) {
      updated = leads.map((l) => l.id === lead.id ? { ...lead, updatedAt: new Date().toISOString() } : l);
    } else {
      updated = [...leads, lead];
    }
    onLeadsChange(updated);
  }, [leads, onLeadsChange]);

  const handleImportCsv = useCallback((rows: Array<Record<string, string>>) => {
    const newLeads: Lead[] = rows.map((row) => ({
      ...emptyLead(),
      id: makeId(),
      leadName: row.leadName || "",
      companyName: row.companyName || "",
      phoneNumber: row.phoneNumber || "",
      emailId: row.emailId || "",
      leadSource: (row.leadSource as LeadSource) || "Others",
      serviceInterested: row.serviceInterested || "",
      assignedTo: row.assignedTo || currentUser.name,
      dateAdded: row.dateAdded || todayISODate(),
      nextFollowupDate: row.nextFollowupDate || "",
      leadTemperature: (row.leadTemperature as LeadTemperature) || "Warm",
      dealValue: Number(row.dealValue) || 0,
      notes: row.notes || "",
      leadStatus: autoMoveToContacted ? "Contacted" as LeadStatus : "New" as LeadStatus,
    }));
    onLeadsChange([...leads, ...newLeads]);
  }, [leads, onLeadsChange, currentUser, autoMoveToContacted]);

  const handleDeleteLead = useCallback((id: string) => {
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, isDeleted: true, updatedAt: new Date().toISOString() } : l));
  }, [leads, onLeadsChange]);

  const handleArchiveLead = useCallback((id: string) => {
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, isArchived: true, updatedAt: new Date().toISOString() } : l));
  }, [leads, onLeadsChange]);

  const handleStatusChange = useCallback((id: string, status: LeadStatus) => {
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, leadStatus: status, updatedAt: new Date().toISOString() } : l));
  }, [leads, onLeadsChange]);

  const handleBatchApply = useCallback((action: string, value: string) => {
    let updated = leads;
    if (action === "delete") updated = leads.map((l) => selectedIds.has(l.id) ? { ...l, isDeleted: true } : l);
    else if (action === "status") updated = leads.map((l) => selectedIds.has(l.id) ? { ...l, leadStatus: value as LeadStatus } : l);
    else if (action === "temperature") updated = leads.map((l) => selectedIds.has(l.id) ? { ...l, leadTemperature: value as LeadTemperature } : l);
    else if (action === "assign") updated = leads.map((l) => selectedIds.has(l.id) ? { ...l, assignedTo: value } : l);
    else if (action === "export") {
      const selected = leads.filter((l) => selectedIds.has(l.id));
      downloadCsv("selected-leads.csv", ["Name", "Company", "Phone", "Email", "Status", "Source", "Deal Value", "Date Added"],
        selected.map((l) => [l.leadName, l.companyName, l.phoneNumber, l.emailId, l.leadStatus, l.leadSource, String(l.dealValue), l.dateAdded]));
    }
    onLeadsChange(updated);
    setSelectedIds(new Set());
    setShowBatchAction(false);
  }, [leads, selectedIds, onLeadsChange]);

  const handleExportAll = useCallback(() => {
    downloadCsv("all-leads.csv", ["Name", "Company", "Phone", "Email", "Status", "Source", "Service", "Temperature", "Deal Value", "Date Added", "Next Follow-up", "Notes"],
      activeLeads.map((l) => [l.leadName, l.companyName, l.phoneNumber, l.emailId, l.leadStatus, l.leadSource, l.serviceInterested, l.leadTemperature, String(l.dealValue), l.dateAdded, l.nextFollowupDate, l.notes]));
  }, [activeLeads]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  /* ---- render ---- */
  return (
    <div className="space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce0bd] bg-[#f4f6e7] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#4b5218]">Leads Workspace</p>
          <p className="text-xs text-[#5e6625]">Add leads, then manage in one unified table.</p>
          {showInvoiceHint && <p className="mt-1 text-[11px] text-[#4f5520]">Invoice shortcut available for leads in Confirmation, Invoice Sent, and Won.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setStatusFilter("New" as LeadStatus); setQuickFilter("new"); }}
            className="rounded-lg border border-[#cfd7a2] bg-white px-3 py-2 text-sm font-medium text-[#5e6625] hover:bg-[#f8f9ef]">New Queue ({newQueueCount})</button>
          <button type="button" onClick={() => setShowCsvImport(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Import CSV</button>
          <button type="button" onClick={handleExportAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Export All</button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setViewMode("table")} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-[#788023] text-white" : "text-slate-600 hover:bg-slate-100"}`}> Table</button>
            <button type="button" onClick={() => setViewMode("cards")} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-[#788023] text-white" : "text-slate-600 hover:bg-slate-100"}`}> Cards</button>
          </div>
          <button type="button" onClick={() => setShowIntake(true)}
            className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Add Lead</button>
        </div>
      </div>

      {/* Simplified Toolbar - 4 controls only */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..."
          className="w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" />
        
        {/* Filter Panel Toggle */}
        <button type="button" onClick={() => setShowFilters(!showFilters)} 
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${showFilters ? "bg-[#788023] text-white border-[#788023]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          Filter {showFilters ? "▴" : "▾"}
        </button>
        
        <span className="ml-auto text-xs text-slate-400">{filtered.length} leads</span>
        
        {/* Add Lead */}
        <button type="button" onClick={() => setShowIntake(true)}
          className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Add Lead</button>
        
        {/* Import CSV */}
        <button type="button" onClick={() => setShowCsvImport(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Import CSV</button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {/* Quick filters */}
          {(["all", "open", "won", "lost", "new"] as const).map((qf) => (
            <button key={qf} type="button" onClick={() => { setQuickFilter(qf); if (qf !== "all") setStatusFilter("all"); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${quickFilter === qf ? "bg-[#788023] text-white" : "bg-white text-slate-600 hover:bg-slate-200"}`}>
              {qf === "all" ? "All" : qf === "open" ? "Open" : qf === "won" ? "Won" : qf === "lost" ? "Lost" : "New"}
            </button>
          ))}
          <span className="text-slate-300">|</span>
          {/* Status */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="all">All Status</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Source */}
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | "all")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="all">All Source</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Temperature */}
          <select value={tempFilter} onChange={(e) => setTempFilter(e.target.value as LeadTemperature | "all")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="all">All Temp</option>
            {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Assignee */}
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="all">All Assignee</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      {/* Selection bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-[#788023]/10 px-3 py-2 text-sm">
          <span className="font-medium text-[#788023]">{selectedIds.size} selected</span>
          <button type="button" onClick={() => setShowBatchAction(true)} className="rounded-lg bg-[#788023] px-3 py-1 text-xs font-medium text-white hover:bg-[#646b1d]">Batch Action</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">Clear</button>
        </div>
      )}

      {/* Card View or Table View */}
      {viewMode === "cards" ? (
        <LeadCardView leads={paged} onLeadClick={setDetailLead} selectedIds={selectedIds} onToggleSelect={(id) => {
          setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
        }} />
      ) : (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="w-8 px-2 py-2"><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === paged.length}
                onChange={() => { if (selectedIds.size === paged.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paged.map((l) => l.id))); }}
                className="rounded border-slate-300" /></th>
              <th className="cursor-pointer px-3 py-2 text-left text-xs font-semibold text-slate-600" onClick={() => toggleSort("leadName")}>Lead {sortField === "leadName" && (sortDir === "asc" ? "↑" : "↓")}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Company</th>
              {showCols.has("source") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Source</th>}
              {showCols.has("service") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Service</th>}
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
              {showCols.has("temperature") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Temp</th>}
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Contact</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Health</th>
              {showCols.has("deal") && <th className="cursor-pointer px-3 py-2 text-left text-xs font-semibold text-slate-600" onClick={() => toggleSort("dealValue")}>Deal {sortField === "dealValue" && (sortDir === "asc" ? "↑" : "↓")}</th>}
              {showCols.has("expected") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Expected</th>}
              <th className="cursor-pointer px-3 py-2 text-left text-xs font-semibold text-slate-600" onClick={() => toggleSort("nextFollowupDate")}>Follow-up {sortField === "nextFollowupDate" && (sortDir === "asc" ? "↑" : "↓")}</th>
              {showCols.has("invoice") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice</th>}
              {showCols.has("tag") && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Tag</th>}
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">SLA</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((lead) => {
              const contact = contactabilityBadge(lead);
              const health = leadHealthScore(lead);
              const sla = leadSlaTier(lead);
              const tag = dateTag(lead);
              const risk = neglectRisk(lead);
              const priority = pipelinePriorityScore(lead);

              return (
                <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 table-row-hover">
                  <td className="px-2 py-2"><input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => {
                    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id); return next; });
                  }} className="rounded border-slate-300" /></td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setDetailLead(lead)} className="text-left">
                      <p className="text-sm font-medium text-slate-800 hover:text-[#788023]">{lead.leadName}</p>
                      <p className="text-[11px] text-slate-400">{lead.phoneNumber}</p>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{lead.companyName}</td>
                  {showCols.has("source") && <td className="px-3 py-2 text-xs text-slate-600">{lead.leadSource}</td>}
                  {showCols.has("service") && <td className="px-3 py-2 text-xs text-slate-600">{lead.serviceInterested}</td>}
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lead.leadStatus === "Won" ? "bg-emerald-100 text-emerald-700" : lead.leadStatus === "Lost" ? "bg-rose-100 text-rose-700" : lead.leadStatus === "New" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>{lead.leadStatus}</span>
                  </td>
                  {showCols.has("temperature") && (
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : lead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{lead.leadTemperature}</span>
                    </td>
                  )}
                  <td className="px-3 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${contact.className}`}>{contact.label}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-12 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${health}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500">{health}</span>
                    </div>
                  </td>
                  {showCols.has("deal") && <td className="px-3 py-2 text-xs font-medium text-slate-700">{formatInr(lead.dealValue)}</td>}
                  {showCols.has("expected") && (
                    <td className="px-3 py-2">
                      <input type="date" value={lead.expectedClosingDate} onChange={(e) => {
                        onLeadsChange(leads.map((l) => l.id === lead.id ? { ...l, expectedClosingDate: e.target.value } : l));
                      }} className="w-24 rounded border border-slate-200 px-1 py-0.5 text-[11px]" />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <span className="text-xs text-slate-600">{formatDateDisplay(lead.nextFollowupDate)}</span>
                  </td>
                  {showCols.has("invoice") && (
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${lead.invoiceFlowStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : lead.invoiceFlowStatus === "Sent" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>{lead.invoiceFlowStatus}</span>
                    </td>
                  )}
                  {showCols.has("tag") && (
                    <td className="px-3 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${followupTagClass(tag)}`}>{tag}</span></td>
                  )}
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sla === "critical" ? "bg-rose-100 text-rose-700" : sla === "escalate" ? "bg-amber-100 text-amber-700" : sla === "watch" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {sla === "critical" ? "🚨" : sla === "escalate" ? "⚠" : sla === "watch" ? "👁" : "✓"} {sla}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setDetailLead(lead)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="View Details">👁</button>
                      {isOpenLeadStatus(lead.leadStatus) && (
                        <select value="" onChange={(e) => { if (e.target.value) handleStatusChange(lead.id, e.target.value as LeadStatus); }} className="rounded border border-slate-200 px-1 py-0.5 text-[10px]" title="Change Status">
                          <option value="">→</option>
                          {LEAD_STATUSES.filter((s) => s !== lead.leadStatus).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      <button type="button" onClick={() => handleArchiveLead(lead.id)} className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Archive">📦</button>
                      <button type="button" onClick={() => handleDeleteLead(lead.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {paged.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">No leads found matching your filters.</div>
        )}
      </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50">← Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              if (p >= totalPages) return null;
              return <button key={p} type="button" onClick={() => setPage(p)} className={`rounded px-2 py-1 ${page === p ? "bg-[#788023] text-white" : "border border-slate-200 hover:bg-slate-50"}`}>{p + 1}</button>;
            })}
            <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50">Next →</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <LeadIntakeModal open={showIntake} onClose={() => setShowIntake(false)} onSave={handleSaveLead}
        existingLeads={activeLeads} assigneeOptions={assigneeOptions} services={DEFAULT_SERVICES}
        currentUser={currentUser} autoMoveToContacted={autoMoveToContacted} />
      <LeadImportCsvModal open={showCsvImport} onClose={() => setShowCsvImport(false)} onImport={handleImportCsv} />
      {detailLead && <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} onUpdate={handleSaveLead} onNavigate={onNavigate} />}
      {showBatchAction && <BatchActionModal leads={leads} selectedIds={selectedIds} onClose={() => setShowBatchAction(false)} onApply={handleBatchApply} />}
    </div>
  );
}
