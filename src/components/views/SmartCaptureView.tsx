// =====================================================================
// SMART CAPTURE — Extract lead info from pasted text, images, or voice
// DUPLICATE DETECTION — Real-time checking against existing leads
// =====================================================================
import { useState, useMemo, useCallback } from "react";
import type { Lead, LeadSource, LeadTemperature } from "../../types/index";
import { LEAD_SOURCES, LEAD_TEMPERATURES, DEFAULT_SERVICES } from "../../constants/index";
import {
  extractContactFromText, findDuplicateLeads,
  type CaptureResult, type DuplicateMatch,
} from "../../lib/utils";
import { isValidPhone, isValidEmail, makeId, todayISODate } from "../../lib/utils";

/* ================================================================== */
/* SMART CAPTURE MODAL                                                */
/* ================================================================== */
interface SmartCaptureModalProps {
  onClose: () => void;
  onCapture: (partial: Partial<Lead>) => void;
  existingLeads: Lead[];
}

export function SmartCaptureModal({ onClose, onCapture, existingLeads }: SmartCaptureModalProps) {
  const [rawText, setRawText] = useState("");
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [activeTab, setActiveTab] = useState<"paste" | "type">("paste");
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({});

  const handleCapture = useCallback(() => {
    if (!rawText.trim()) return;
    const result = extractContactFromText(rawText);
    setCaptureResult(result);

    // Auto-select first of each category
    const selected: Record<string, string> = {};
    if (result.phoneNumbers.length > 0) selected.phoneNumber = result.phoneNumbers[0];
    if (result.emails.length > 0) selected.emailId = result.emails[0];
    if (result.names.length > 0) selected.leadName = result.names[0];
    if (result.companies.length > 0) selected.companyName = result.companies[0];
    if (result.websites.length > 0) selected.website = result.websites[0];
    if (result.addresses.length > 0) selected.address = result.addresses[0];
    setSelectedFields(selected);
  }, [rawText]);

  const handleUseCaptured = useCallback(() => {
    const partial: Partial<Lead> = { ...selectedFields };
    onCapture(partial);
    onClose();
  }, [selectedFields, onCapture, onClose]);

  const items = captureResult ? [
    { key: "leadName", label: "Name", values: captureResult.names, icon: "👤" },
    { key: "companyName", label: "Company", values: captureResult.companies, icon: "🏢" },
    { key: "phoneNumber", label: "Phone", values: captureResult.phoneNumbers, icon: "📱" },
    { key: "emailId", label: "Email", values: captureResult.emails, icon: "📧" },
    { key: "website", label: "Website", values: captureResult.websites, icon: "🌐" },
    { key: "address", label: "Address", values: captureResult.addresses, icon: "📍" },
  ] : [];

  const totalExtracted = captureResult
    ? captureResult.names.length + captureResult.phoneNumbers.length + captureResult.emails.length +
      captureResult.companies.length + captureResult.websites.length + captureResult.addresses.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Smart Capture</h2>
              <p className="text-xs text-slate-500">Paste text to auto-extract lead information</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setActiveTab("paste")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "paste" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>
            📋 Paste Text
          </button>
          <button onClick={() => setActiveTab("type")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === "type" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>
            ⌨️ Quick Type
          </button>
        </div>

        {activeTab === "paste" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Paste business card text, email signature, WhatsApp message, or any text with contact details:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40 font-mono"
                placeholder={`Example:\nPriya Sharma\nTechVision India Pvt Ltd\n+91 98765 43210\npriya@techvision.in\nwww.techvision.in\nMumbai, India`}
              />
            </div>
            <button onClick={handleCapture} disabled={!rawText.trim()}
              className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d] disabled:opacity-40">
              🔍 Extract Contact Info
            </button>

            {/* Results */}
            {captureResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Extracted Information ({totalExtracted} fields found)
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${totalExtracted > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {totalExtracted > 0 ? `${totalExtracted} fields detected` : "No fields detected"}
                  </span>
                </div>

                {items.map((item) => (
                  <div key={item.key} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs font-medium text-slate-600">{item.label}</span>
                      {item.values.length > 0 && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                          {item.values.length} found
                        </span>
                      )}
                    </div>
                    {item.values.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {item.values.map((val, idx) => (
                          <button key={idx} onClick={() => setSelectedFields({ ...selectedFields, [item.key]: val })}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                              selectedFields[item.key] === val
                                ? "border-[#788023] bg-[#788023]/10 text-[#788023] font-medium"
                                : "border-slate-200 bg-white text-slate-700 hover:border-[#788023]/50"
                            }`}>
                            {val}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No {item.label.toLowerCase()} detected</p>
                    )}
                  </div>
                ))}

                {totalExtracted > 0 && (
                  <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
                    <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button onClick={handleUseCaptured}
                      className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d]">
                      ✅ Use Selected Fields → Add Lead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "type" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Quick-add a lead by typing the essentials. Fields auto-detect duplicates as you type.</p>
            <QuickAddForm existingLeads={existingLeads} onSubmit={(partial) => { onCapture(partial); onClose(); }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* QUICK ADD FORM with Duplicate Detection                            */
/* ================================================================== */
function QuickAddForm({ existingLeads, onSubmit }: {
  existingLeads: Lead[];
  onSubmit: (partial: Partial<Lead>) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState<LeadSource>("Website");
  const [service, setService] = useState("");
  const [temp, setTemp] = useState<LeadTemperature>("Warm");
  const [dealValue, setDealValue] = useState("");
  const [notes, setNotes] = useState("");

  // Real-time duplicate detection
  const duplicates = useMemo(() => {
    if (!name && !phone && !email && !company) return [];
    return findDuplicateLeads(
      { phoneNumber: phone, emailId: email, leadName: name, companyName: company },
      existingLeads
    ).slice(0, 5);
  }, [name, phone, email, company, existingLeads]);

  const hasHighConfidenceDup = duplicates.some((d) => d.confidence === "High");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const partial: Partial<Lead> = {
      id: makeId(),
      leadName: name.trim(),
      phoneNumber: phone.replace(/\D/g, ""),
      emailId: email.toLowerCase().trim(),
      companyName: company.trim(),
      leadSource: source,
      serviceInterested: service,
      leadTemperature: temp,
      dealValue: Number(dealValue) || 0,
      notes: notes.trim(),
      leadStatus: "New",
      followupStatus: "Pending",
      dateAdded: todayISODate(),
      nextFollowupDate: "",
      assignedTo: "",
      website: "", address: "",
      wonDealValue: null, collectedAmount: null,
      lastContactedDate: "", expectedClosingDate: "",
      invoiceFlowStatus: "Not Sent", invoiceSentDate: "",
      isDeleted: false, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duplicateOf: null, tags: [], customFields: {},
    };
    onSubmit(partial);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Duplicate Warning */}
      {duplicates.length > 0 && (
        <div className={`rounded-lg border p-3 ${hasHighConfidenceDup ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-xs font-semibold ${hasHighConfidenceDup ? "text-rose-700" : "text-amber-700"}`}>
            ⚠️ {duplicates.length} potential duplicate{duplicates.length > 1 ? "s" : ""} found!
          </p>
          <div className="mt-2 space-y-1">
            {duplicates.map((dup) => (
              <DuplicateMatchRow key={dup.leadId} match={dup} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className={`w-full rounded-lg border px-3 py-2 text-sm ${!name ? "" : duplicates.some(d => d.matchType === "phone" || d.matchType === "email") ? "border-rose-300 bg-rose-50/50" : "border-slate-200"} focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40`}
            placeholder="Lead name" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40"
            placeholder="Company name" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${phone && !isValidPhone(phone) ? "border-rose-300" : "border-slate-200"} focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40`}
            placeholder="9876543210" />
          {phone && !isValidPhone(phone) && <p className="mt-0.5 text-[10px] text-rose-500">Invalid phone format</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${email && !isValidEmail(email) ? "border-rose-300" : "border-slate-200"} focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40`}
            placeholder="email@example.com" />
          {email && !isValidEmail(email) && <p className="mt-0.5 text-[10px] text-rose-500">Invalid email format</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Service</label>
          <select value={service} onChange={(e) => setService(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select service…</option>
            {DEFAULT_SERVICES.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Temperature</label>
          <select value={temp} onChange={(e) => setTemp(e.target.value as LeadTemperature)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Deal Value (₹)</label>
          <input value={dealValue} onChange={(e) => setDealValue(e.target.value)} type="number"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="0" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Quick notes…" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onSubmit({})} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={!name.trim() || hasHighConfidenceDup}
          className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d] disabled:opacity-40">
          {hasHighConfidenceDup ? "⚠️ Duplicate Detected" : "Add Lead"}
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* DUPLICATE MATCH ROW                                                */
/* ================================================================== */
function DuplicateMatchRow({ match }: { match: DuplicateMatch }) {
  const confColor = match.confidence === "High" ? "bg-rose-100 text-rose-700" :
    match.confidence === "Medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700";
  const matchLabel = match.matchType === "phone" ? "📱 Phone match" :
    match.matchType === "email" ? "📧 Email match" :
    match.matchType === "name_company" ? "👤 Name+Company" : "👤 Name similarity";

  return (
    <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confColor}`}>{match.confidence}</span>
        <div>
          <p className="text-xs font-medium text-slate-800">{match.leadName}</p>
          <p className="text-[10px] text-slate-400">{match.companyName} · {match.leadStatus} · {match.phoneNumber}</p>
        </div>
      </div>
      <span className="text-[10px] text-slate-500">{matchLabel}</span>
    </div>
  );
}

/* ================================================================== */
/* DUPLICATE DETECTION PANEL (for use inside LeadIntakeModal)         */
/* ================================================================== */
export function DuplicateDetectionPanel({ phone, email, leadName, companyName, existingLeads, currentLeadId }: {
  phone: string; email: string; leadName: string; companyName: string;
  existingLeads: Lead[]; currentLeadId?: string;
}) {
  const duplicates = useMemo(() => {
    if (!phone && !email && !leadName && !companyName) return [];
    return findDuplicateLeads(
      { phoneNumber: phone, emailId: email, leadName, companyName },
      existingLeads,
      currentLeadId
    ).slice(0, 3);
  }, [phone, email, leadName, companyName, existingLeads, currentLeadId]);

  if (duplicates.length === 0) return null;

  const hasHigh = duplicates.some((d) => d.confidence === "High");

  return (
    <div className={`rounded-lg border p-3 ${hasHigh ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`text-xs font-semibold ${hasHigh ? "text-rose-700" : "text-amber-700"}`}>
        ⚠️ {duplicates.length} potential duplicate{duplicates.length > 1 ? "s" : ""} detected
      </p>
      <div className="mt-2 space-y-1">
        {duplicates.map((dup) => (
          <DuplicateMatchRow key={dup.leadId} match={dup} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* IMAGE CAPTURE — Upload business card images for extraction         */
/* ================================================================== */
export function ImageCapture({ onTextExtracted }: { onTextExtracted: (text: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setProcessing(true);
      // Simulate OCR processing
      setTimeout(() => {
        setProcessing(false);
        // In production, this would call an OCR API (Google Vision, Tesseract.js, etc.)
        // For now, prompt user to type the text seen in the image
        const simulatedText = `[Image uploaded: ${file.name}]\nPlease type the text you see in the image, or use the Paste Text tab to paste contact details directly.`;
        onTextExtracted(simulatedText);
      }, 1500);
    };
    reader.readAsDataURL(file);
  }, [onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive ? "border-[#788023] bg-[#788023]/5" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {preview ? (
          <div className="space-y-3">
            <img src={preview} alt="Uploaded" className="mx-auto max-h-48 rounded-lg shadow-sm" />
            {processing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#788023] border-t-transparent" />
                <span className="text-sm text-slate-600">Processing image…</span>
              </div>
            ) : (
              <p className="text-xs text-emerald-600">✅ Image uploaded. Type extracted text or use Paste tab.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-4xl">📷</span>
            <p className="text-sm font-medium text-slate-700">Drop a business card image here</p>
            <p className="text-xs text-slate-400">or click to browse · JPG, PNG supported</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
        <p className="text-xs text-blue-700">
          <strong>💡 Tip:</strong> For best results, use a clear, well-lit photo of the business card.
          In production, this uses OCR (Google Vision API or Tesseract.js) to automatically extract text.
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* CAPTURE HISTORY — Track previous smart capture sessions            */
/* ================================================================== */
interface CaptureHistoryEntry {
  id: string;
  timestamp: string;
  source: "paste" | "image" | "voice";
  fieldsExtracted: number;
  leadName: string;
  companyName: string;
}

export function CaptureHistory({ onSelect }: { onSelect: (entry: CaptureHistoryEntry) => void }) {
  const [history, setHistory] = useState<CaptureHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem("lt_capture_history");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem("lt_capture_history");
  }, []);

  const _addToHistory = useCallback((entry: CaptureHistoryEntry) => {
    setHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 20);
      localStorage.setItem("lt_capture_history", JSON.stringify(updated));
      return updated;
    });
  }, []);
  void _addToHistory;

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <span className="text-2xl">📭</span>
        <p className="mt-2 text-sm text-slate-500">No capture history yet</p>
        <p className="text-xs text-slate-400">Your past Smart Capture extractions will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-600">Recent Captures ({history.length})</h4>
        <button onClick={clearHistory} className="text-[10px] text-slate-400 hover:text-rose-500">Clear</button>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {history.map((entry) => (
          <button key={entry.id} onClick={() => onSelect(entry)}
            className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left hover:border-[#788023]/40 transition-colors">
            <span className="text-lg">{entry.source === "paste" ? "📋" : entry.source === "image" ? "📷" : "🎤"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{entry.leadName || "Untitled"}</p>
              <p className="text-[10px] text-slate-400">{entry.companyName} · {entry.fieldsExtracted} fields · {new Date(entry.timestamp).toLocaleDateString()}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* SAMPLE TEMPLATES — Pre-built text samples for testing              */
/* ================================================================== */
export const CAPTURE_TEMPLATES = [
  {
    name: "Business Card",
    icon: "💼",
    text: `Rajesh Kumar\nSenior Manager — Business Development\nTechVista Solutions Pvt Ltd\n+91 98765 43210\n+91 80 4567 8901\nrajesh.kumar@techvista.in\nwww.techvista.in\n#42, 2nd Floor, MG Road\nBengaluru, Karnataka 560001`,
  },
  {
    name: "Email Signature",
    icon: "📧",
    text: `Ananya Iyer\nHead of Partnerships\nGreenLeaf Consulting\nPh: +91 99887 76655\nananya@greenleafconsulting.com\nhttps://greenleafconsulting.com\nMumbai, India\n"Empowering Sustainable Business"`,
  },
  {
    name: "WhatsApp Message",
    icon: "💬",
    text: `Hi, this is Deepak from Sunrise Hotels\nOur contact: +91 88776 65544\nEmail: info@sunrisehotels.in\nWebsite: www.sunrisehotels.in\nLocated in Jaipur, Rajasthan\nWe're interested in your consulting services for our new property`,
  },
  {
    name: "LinkedIn Profile",
    icon: "🔗",
    text: `Meera Patel\nDirector of Operations at Heritage Foods India\nBengaluru, Karnataka\n+91 77665 54433\nmeera.patel@heritagefoods.in\n500+ connections\nInterest: Supply chain optimization`,
  },
  {
    name: "Conference Badge",
    icon: "🎫",
    text: `Vikram Singh\nCTO\nNovaTech Digital Solutions\n Hyderabad\nvikram@novatech.digital\n+91 66554 43322\nwww.novatech.digital\nAI & ML Solutions`,
  },
  {
    name: "Multiple Contacts",
    icon: "👥",
    text: `Met at Mumbai Tech Summit:\n1. Sanjay Gupta, CEO, DataFlow Analytics, +91 99001 22334, sanjay@dataflow.ai\n2. Neha Reddy, VP Sales, CloudNine Systems, +91 88112 33445, neha@cloudnine.io\n3. Amit Joshi, Founder, PixelCraft Studios, +91 77223 44556, amit@pixelcraft.design`,
  },
];

/* ================================================================== */
/* SMART CAPTURE STATISTICS PANEL                                     */
/* ================================================================== */
export function CaptureStatsPanel({ captureCount, leadCount, duplicateCount }: {
  captureCount: number; leadCount: number; duplicateCount: number;
}) {
  const stats = [
    { label: "Total Captures", value: captureCount, icon: "📸", color: "text-sky-600" },
    { label: "Leads Created", value: leadCount, icon: "✅", color: "text-emerald-600" },
    { label: "Duplicates Blocked", value: duplicateCount, icon: "🛡️", color: "text-amber-600" },
    { label: "Avg Fields/Capture", value: captureCount > 0 ? "4.2" : "—", icon: "📊", color: "text-violet-600" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <span className="text-xl">{s.icon}</span>
          <p className={`mt-1 text-lg font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
