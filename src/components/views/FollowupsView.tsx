// =====================================================================
// FOLLOW-UPS VIEW — Full queue with tabs, bulk actions, scheduling,
//   Calendar view, Activity Log, Notes History, Templates,
//   Auto-follow-up Rules, Quick-Compose, Enhanced Detail Modal,
//   Lead Contact Timeline, Snooze Presets, Recurring Follow-ups,
//   Follow-up Scoring, Email/WhatsApp Preview, Daily Digest
// =====================================================================
import { useState, useMemo, useCallback } from "react";
import type { Lead } from "../../types/index";
import {
  todayISODate, shiftISODate, formatDateDisplay, formatInr,
  dateTag, followupTagClass, followupQueueKey,
  leadHealthScore, leadSlaTier, contactabilityBadge, neglectRisk,
  pipelinePriorityScore, makeId,
} from "../../lib/utils";

type FollowupsViewProps = {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  currentUser: { name: string; role: string };
};

type QueueKey = "all" | "overdue" | "today" | "upcoming" | "no-date" | "done";
type FollowupTab = "queue" | "calendar" | "templates" | "activity" | "rules";

// Follow-up template presets
const FOLLOWUP_TEMPLATES = [
  { id: "t1", name: "Initial Contact", description: "First follow-up after lead creation", daysOffset: 1, note: "Hi {name}, following up on your interest in {service}. Would love to schedule a quick call.", channel: "Phone" },
  { id: "t2", name: "Post-Proposal", description: "After sending proposal", daysOffset: 2, note: "Hi {name}, wanted to check if you had a chance to review the proposal. Happy to clarify any questions.", channel: "Email" },
  { id: "t3", name: "Negotiation Nudge", description: "During active negotiation", daysOffset: 3, note: "Hi {name}, wanted to touch base on the discussion. Let me know if you need any additional information.", channel: "WhatsApp" },
  { id: "t4", name: "Weekly Check-in", description: "Regular weekly touchpoint", daysOffset: 7, note: "Hi {name}, just checking in. Hope everything is going well. Let me know if there's anything I can help with.", channel: "Email" },
  { id: "t5", name: "Re-engagement", description: "Re-engage cold leads", daysOffset: 14, note: "Hi {name}, it's been a while since we last connected. Just wanted to see if your priorities have changed.", channel: "WhatsApp" },
  { id: "t6", name: "Win-Back", description: "After losing a deal", daysOffset: 30, note: "Hi {name}, I wanted to reach out again. We've made some exciting updates since we last spoke.", channel: "Email" },
  { id: "t7", name: "Invoice Reminder", description: "After sending invoice", daysOffset: 3, note: "Hi {name}, just a friendly reminder about the invoice we sent. Let us know if you have any questions.", channel: "Email" },
];

// Auto-follow-up rules
interface AutoRule {
  id: string;
  name: string;
  trigger: "status_change" | "days_inactive" | "temperature_change" | "new_lead";
  condition: string;
  action: string;
  channel: string;
  daysOffset: number;
  enabled: boolean;
}

// Activity log entry type
interface ActivityEntry {
  id: string;
  leadId: string;
  leadName: string;
  action: string;
  detail: string;
  timestamp: string;
  type: "done" | "scheduled" | "created" | "snoozed" | "note" | "status" | "template" | "auto";
}

function slaBadge(tier: string): { label: string; className: string } {
  switch (tier) {
    case "critical": return { label: "🔴 Critical", className: "bg-rose-100 text-rose-700" };
    case "escalate": return { label: "🟠 Escalate", className: "bg-orange-100 text-orange-700" };
    case "watch": return { label: "🟡 Watch", className: "bg-amber-100 text-amber-700" };
    default: return { label: "🟢 OK", className: "bg-emerald-100 text-emerald-700" };
  }
}

export function FollowupsView({ leads, onLeadsChange, currentUser: _currentUser }: FollowupsViewProps) {
  void _currentUser;
  const [queue, setQueue] = useState<QueueKey>("all");
  const [followupSearch, setFollowupSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [activeTab, setActiveTab] = useState<FollowupTab>("queue");
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [noteText, setNoteText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [showCompose, setShowCompose] = useState(false);
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [composeChannel, setComposeChannel] = useState<"email" | "whatsapp" | "phone">("email");
  const [composeText, setComposeText] = useState("");
  const [autoRules, setAutoRules] = useState<AutoRule[]>([
    { id: "ar1", name: "New Lead → Schedule call", trigger: "new_lead", condition: "Lead Status = New", action: "Schedule follow-up", channel: "Phone", daysOffset: 1, enabled: true },
    { id: "ar2", name: "3 days inactive → Alert", trigger: "days_inactive", condition: "Days since contact ≥ 3", action: "Flag for follow-up", channel: "In-App", daysOffset: 3, enabled: true },
    { id: "ar3", name: "Won → Send thank you", trigger: "status_change", condition: "Lead Status = Won", action: "Send thank you email", channel: "Email", daysOffset: 1, enabled: false },
    { id: "ar4", name: "Cold lead → Re-engage", trigger: "temperature_change", condition: "Temperature = Cold", action: "Schedule re-engagement", channel: "WhatsApp", daysOffset: 7, enabled: true },
  ]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() =>
    leads.slice(0, 15).flatMap((l) => [
      { id: makeId(), leadId: l.id, leadName: l.leadName, action: "created", detail: "Lead created", timestamp: l.createdAt, type: "created" as const },
      ...(l.lastContactedDate ? [{ id: makeId(), leadId: l.id, leadName: l.leadName, action: "contacted", detail: `Last contacted: ${formatDateDisplay(l.lastContactedDate)}`, timestamp: l.lastContactedDate, type: "done" as const }] : []),
    ])
  );
  const [detailNotes, setDetailNotes] = useState<Array<{ id: string; text: string; time: string }>>([]);
  // Recurring follow-up state
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringLeadId, setRecurringLeadId] = useState("");
  const [recurringFreq, setRecurringFreq] = useState("weekly");
  const [recurringChannel, setRecurringChannel] = useState("email");
  const [recurringStart, setRecurringStart] = useState(todayISODate());
  const [recurringEndAfter, setRecurringEndAfter] = useState("5");
  const [recurringNote, setRecurringNote] = useState("");
  // Contact timeline
  const [showTimeline, setShowTimeline] = useState(false);
  // Batch schedule
  const [showBatchSchedule, setShowBatchSchedule] = useState(false);
  const [batchScheduleDate, setBatchScheduleDate] = useState(shiftISODate(todayISODate(), 1));

  // Unique assignees
  const assignees = useMemo(() => [...new Set(leads.filter((l) => !l.isDeleted).map((l) => l.assignedTo).filter(Boolean))], [leads]);

  // Queue classification
  const classifiedLeads = useMemo(() => {
    const today = todayISODate();
    const active = leads.filter((l) => !l.isDeleted && l.leadStatus !== "Won" && l.leadStatus !== "Lost");
    return active.map((l) => {
      const key = followupQueueKey(l);
      const health = leadHealthScore(l);
      const sla = leadSlaTier(l);
      const contact = contactabilityBadge(l);
      const risk = neglectRisk(l);
      const priority = pipelinePriorityScore(l);
      const daysOverdue = l.nextFollowupDate && l.nextFollowupDate < today ? Math.ceil((new Date(today).getTime() - new Date(l.nextFollowupDate).getTime()) / 86400000) : 0;
      return { ...l, key, health, sla, contact, risk, priority, daysOverdue };
    });
  }, [leads]);

  // Filtered queue
  const queueLeads = useMemo(() => {
    let list = classifiedLeads;
    if (queue === "overdue") list = list.filter((l) => l.key === "overdue");
    else if (queue === "today") list = list.filter((l) => l.key === "today");
    else if (queue === "upcoming") list = list.filter((l) => l.key === "upcoming");
    else if (queue === "no-date") list = list.filter((l) => !l.nextFollowupDate);
    else if (queue === "done") list = list.filter((l) => l.followupStatus === "Done");
    if (followupSearch) list = list.filter((l) => l.leadName.toLowerCase().includes(followupSearch.toLowerCase()) || (l.companyName || "").toLowerCase().includes(followupSearch.toLowerCase()));
    if (filterAssignee !== "All") list = list.filter((l) => l.assignedTo === filterAssignee);
    if (filterStage !== "All") list = list.filter((l) => l.leadStatus === filterStage);
    // Sort: overdue first, then by priority score desc
    return list.sort((a, b) => {
      if (a.daysOverdue > 0 && b.daysOverdue === 0) return -1;
      if (b.daysOverdue > 0 && a.daysOverdue === 0) return 1;
      return b.priority - a.priority;
    });
  }, [classifiedLeads, queue, followupSearch, filterAssignee, filterStage]);

  // Queue counts
  const queueCounts = useMemo(() => ({
    all: classifiedLeads.length,
    overdue: classifiedLeads.filter((l) => l.key === "overdue").length,
    today: classifiedLeads.filter((l) => l.key === "today").length,
    upcoming: classifiedLeads.filter((l) => l.key === "upcoming").length,
    "no-date": classifiedLeads.filter((l) => !l.nextFollowupDate).length,
    done: classifiedLeads.filter((l) => l.followupStatus === "Done").length,
  }), [classifiedLeads]);

  // Calendar data
  const calDays = useMemo(() => {
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const startDay = first.getDay();
    const totalDays = last.getDate();
    const days: Array<{ date: string; day: number; leads: typeof classifiedLeads }> = [];
    for (let i = 0; i < startDay; i++) days.push({ date: "", day: 0, leads: [] });
    for (let d = 1; d <= totalDays; d++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: ds, day: d, leads: classifiedLeads.filter((l) => l.nextFollowupDate === ds) });
    }
    return days;
  }, [calMonth, classifiedLeads]);

  // Follow-up scoring
  const fuScore = useCallback((lead: Lead) => {
    let score = 0;
    const today = todayISODate();
    if (lead.nextFollowupDate && lead.nextFollowupDate < today) score += 40;
    else if (lead.nextFollowupDate === today) score += 25;
    if (lead.leadTemperature === "Hot") score += 20;
    else if (lead.leadTemperature === "Warm") score += 10;
    score += leadHealthScore(lead) * 0.2;
    if (lead.dealValue > 50000) score += 15;
    else if (lead.dealValue > 20000) score += 10;
    return Math.min(100, Math.round(score));
  }, []);

  // Actions
  const markDone = useCallback((id: string) => {
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, followupStatus: "Done" as const, lastContactedDate: todayISODate(), updatedAt: new Date().toISOString() } : l));
    const lead = leads.find((l) => l.id === id);
    if (lead) setActivityLog((prev) => [{ id: makeId(), leadId: id, leadName: lead.leadName, action: "done", detail: "Follow-up marked as done", timestamp: new Date().toISOString(), type: "done" }, ...prev]);
  }, [leads, onLeadsChange]);

  const scheduleLead = useCallback((id: string, date: string) => {
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, nextFollowupDate: date, followupStatus: "Pending" as const, updatedAt: new Date().toISOString() } : l));
    const lead = leads.find((l) => l.id === id);
    if (lead) setActivityLog((prev) => [{ id: makeId(), leadId: id, leadName: lead.leadName, action: "scheduled", detail: `Scheduled for ${formatDateDisplay(date)}`, timestamp: new Date().toISOString(), type: "scheduled" }, ...prev]);
  }, [leads, onLeadsChange]);

  const snoozeLead = useCallback((id: string, days: number) => {
    const newDate = shiftISODate(todayISODate(), days);
    onLeadsChange(leads.map((l) => l.id === id ? { ...l, nextFollowupDate: newDate, followupStatus: "Pending" as const, updatedAt: new Date().toISOString() } : l));
    const lead = leads.find((l) => l.id === id);
    if (lead) setActivityLog((prev) => [{ id: makeId(), leadId: id, leadName: lead.leadName, action: "snoozed", detail: `Snoozed for ${days} days → ${formatDateDisplay(newDate)}`, timestamp: new Date().toISOString(), type: "snoozed" }, ...prev]);
  }, [leads, onLeadsChange]);

  const bulkMarkDone = useCallback(() => {
    onLeadsChange(leads.map((l) => selectedIds.has(l.id) ? { ...l, followupStatus: "Done" as const, lastContactedDate: todayISODate(), updatedAt: new Date().toISOString() } : l));
    setSelectedIds(new Set());
  }, [selectedIds, leads, onLeadsChange]);

  const bulkSnooze = useCallback((days: number) => {
    const newDate = shiftISODate(todayISODate(), days);
    onLeadsChange(leads.map((l) => selectedIds.has(l.id) ? { ...l, nextFollowupDate: newDate, followupStatus: "Pending" as const, updatedAt: new Date().toISOString() } : l));
    setSelectedIds(new Set());
  }, [selectedIds, leads, onLeadsChange]);

  const addNote = useCallback(() => {
    if (!noteText.trim() || !detailLead) return;
    setDetailNotes((prev) => [...prev, { id: `manual_${makeId()}`, text: noteText, time: new Date().toISOString() }]);
    setActivityLog((prev) => [{ id: makeId(), leadId: detailLead.id, leadName: detailLead.leadName, action: "note", detail: noteText.slice(0, 100), timestamp: new Date().toISOString(), type: "note" }, ...prev]);
    setNoteText("");
  }, [noteText, detailLead]);

  const openCompose = useCallback((lead: Lead, channel: "email" | "whatsapp" | "phone") => {
    const template = FOLLOWUP_TEMPLATES[0];
    const text = template.note.replace("{name}", lead.leadName).replace("{service}", lead.serviceInterested || "our services");
    setComposeLead(lead);
    setComposeChannel(channel);
    setComposeText(text);
    setShowCompose(true);
  }, []);

  const sendCompose = useCallback(() => {
    if (!composeLead) return;
    setActivityLog((prev) => [{ id: makeId(), leadId: composeLead.id, leadName: composeLead.leadName, action: "composed", detail: `Sent ${composeChannel}: "${composeText.slice(0, 60)}..."`, timestamp: new Date().toISOString(), type: "template" }, ...prev]);
    onLeadsChange(leads.map((l) => l.id === composeLead.id ? { ...l, followupStatus: "Done" as const, lastContactedDate: todayISODate(), updatedAt: new Date().toISOString() } : l));
    setShowCompose(false);
    setComposeLead(null);
  }, [composeLead, composeChannel, composeText, leads, onLeadsChange]);

  const toggleRule = useCallback((ruleId: string) => {
    setAutoRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  }, []);

  // Detail modal
  const renderDetailModal = () => {
    if (!detailLead) return null;
    const health = leadHealthScore(detailLead);
    const sla = leadSlaTier(detailLead);
    const contact = contactabilityBadge(detailLead);
    const risk = neglectRisk(detailLead);
    const score = fuScore(detailLead);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailLead(null)}>
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{detailLead.leadName}</h3>
                {detailLead.companyName && <p className="text-sm text-slate-500">{detailLead.companyName}</p>}
              </div>
              <button onClick={() => setDetailLead(null)} className="rounded-lg p-1 hover:bg-slate-100 text-slate-400">✕</button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Score & badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-lg bg-slate-50 px-3 py-1.5">
                <span className="text-xs text-slate-500">FU Score</span>
                <span className={`ml-1 text-sm font-bold ${score >= 70 ? "text-rose-600" : score >= 40 ? "text-amber-600" : "text-emerald-600"}`}>{score}</span>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${contact.label === "Strong" ? "bg-emerald-100 text-emerald-700" : contact.label === "Partial" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>📞 {contact.label}</span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${slaBadge(sla).className}`}>{slaBadge(sla).label}</span>
              {risk === "High" && <span className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-600">⚠️ High Neglect</span>}
            </div>

            {/* Health */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Health:</span>
              <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${health}%` }} />
              </div>
              <span className="text-xs font-medium">{health}</span>
            </div>

            {/* Contact info */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-1">
              {detailLead.phoneNumber && <p className="text-xs text-slate-600">📱 {detailLead.phoneNumber}</p>}
              {detailLead.emailId && <p className="text-xs text-slate-600">📧 {detailLead.emailId}</p>}
              {detailLead.leadSource && <p className="text-xs text-slate-600">🔗 {detailLead.leadSource}</p>}
              {(detailLead.dealValue || 0) > 0 && <p className="text-xs text-slate-600">💰 {formatInr(detailLead.dealValue)}</p>}
            </div>

            {/* Quick Schedule */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">⏰ Schedule Follow-up</h4>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "Today", date: todayISODate() },
                  { label: "+1d", date: shiftISODate(todayISODate(), 1) },
                  { label: "+2d", date: shiftISODate(todayISODate(), 2) },
                  { label: "+3d", date: shiftISODate(todayISODate(), 3) },
                  { label: "+7d", date: shiftISODate(todayISODate(), 7) },
                  { label: "+14d", date: shiftISODate(todayISODate(), 14) },
                ].map((opt) => (
                  <button key={opt.label} onClick={() => scheduleLead(detailLead.id, opt.date)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      detailLead.nextFollowupDate === opt.date ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" />
                <button onClick={() => { if (scheduleDate) scheduleLead(detailLead.id, scheduleDate); setScheduleDate(""); }}
                  disabled={!scheduleDate}
                  className="rounded-lg bg-[#788023] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#646b1d] disabled:opacity-40">
                  Set Date
                </button>
              </div>
            </div>

            {/* Quick Compose */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">✉️ Quick Compose</h4>
              <div className="flex gap-1.5">
                <button onClick={() => openCompose(detailLead, "email")} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">📧 Email</button>
                <button onClick={() => openCompose(detailLead, "whatsapp")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">💬 WhatsApp</button>
                <button onClick={() => openCompose(detailLead, "phone")} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100">📞 Log Call</button>
              </div>
            </div>

            {/* Mark Done */}
            <div className="flex gap-2">
              <button onClick={() => markDone(detailLead.id)} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">✅ Mark Done</button>
              <button onClick={() => snoozeLead(detailLead.id, 2)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Snooze +2d</button>
              <button onClick={() => snoozeLead(detailLead.id, 7)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Snooze +7d</button>
            </div>

            {/* Add Note */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">📝 Add Note</h4>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a follow-up note..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" rows={2} />
              <button onClick={addNote} disabled={!noteText.trim()} className="mt-1.5 rounded-lg bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d] disabled:opacity-40">Add Note</button>
            </div>

            {/* Follow-up Timeline */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">📋 Timeline</h4>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200" />
                <div className="space-y-2">
                  <div className="relative flex items-start gap-3">
                    <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[10px]">🆕</div>
                    <div><p className="text-xs font-medium text-slate-700">Lead Created</p><p className="text-[10px] text-slate-400">{new Date(detailLead.createdAt).toLocaleString("en-IN")}</p></div>
                  </div>
                  {detailLead.lastContactedDate && (
                    <div className="relative flex items-start gap-3">
                      <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px]">📞</div>
                      <div><p className="text-xs font-medium text-slate-700">Last Contacted</p><p className="text-[10px] text-slate-400">{new Date(detailLead.lastContactedDate).toLocaleDateString("en-IN")}</p></div>
                    </div>
                  )}
                  {detailLead.nextFollowupDate && (
                    <div className="relative flex items-start gap-3">
                      <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px]">📅</div>
                      <div><p className="text-xs font-medium text-slate-700">Next Follow-up</p><p className="text-[10px] text-slate-400">{formatDateDisplay(detailLead.nextFollowupDate)}</p></div>
                    </div>
                  )}
                  {detailNotes.filter((n) => n.id.startsWith("manual")).map((note) => (
                    <div key={note.id} className="relative flex items-start gap-3">
                      <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px]">📝</div>
                      <div><p className="text-xs text-slate-700">{note.text}</p><p className="text-[10px] text-slate-400">{new Date(note.time).toLocaleString("en-IN")}</p></div>
                    </div>
                  ))}
                  {activityLog.filter((e) => e.leadId === detailLead.id).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="relative flex items-start gap-3">
                      <div className={`z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${
                        entry.type === "done" ? "bg-emerald-100" : entry.type === "scheduled" ? "bg-sky-100" : entry.type === "snoozed" ? "bg-amber-100" : "bg-indigo-100"
                      }`}>
                        {entry.type === "done" ? "✅" : entry.type === "scheduled" ? "📅" : entry.type === "snoozed" ? "⏰" : "📝"}
                      </div>
                      <div><p className="text-xs text-slate-700">{entry.detail}</p><p className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleString("en-IN")}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Compose modal
  const renderComposeModal = () => {
    if (!showCompose || !composeLead) return null;
    const isEmail = composeChannel === "email";
    const isWhatsapp = composeChannel === "whatsapp";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCompose(false)}>
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className={`p-4 border-b ${isEmail ? "border-sky-200 bg-sky-50" : isWhatsapp ? "border-emerald-200 bg-emerald-50" : "border-violet-200 bg-violet-50"}`}>
            <h3 className="text-lg font-bold text-slate-800">
              {isEmail ? "📧 Email" : isWhatsapp ? "💬 WhatsApp" : "📞 Log Call"} — {composeLead.leadName}
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {isEmail && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600">To</label>
                  <input value={composeLead.emailId} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Subject</label>
                  <input value={`Following up — ${composeLead.serviceInterested || "our services"}`} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600">{isEmail ? "Body" : isWhatsapp ? "Message" : "Call Notes"}</label>
              <textarea value={composeText} onChange={(e) => setComposeText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={6} />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Templates:</span>
              {FOLLOWUP_TEMPLATES.slice(0, 3).map((t) => (
                <button key={t.id} onClick={() => setComposeText(t.note.replace("{name}", composeLead.leadName).replace("{service}", composeLead.serviceInterested || "our services"))}
                  className="rounded border border-slate-200 px-2 py-0.5 hover:bg-slate-50">{t.name}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCompose(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={sendCompose} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${isEmail ? "bg-sky-600 hover:bg-sky-700" : isWhatsapp ? "bg-emerald-600 hover:bg-emerald-700" : "bg-violet-600 hover:bg-violet-700"}`}>
                {isEmail ? "Send Email" : isWhatsapp ? "Send WhatsApp" : "Save Call Log"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Calendar view
  const renderCalendar = () => {
    const [y, m] = calMonth.split("-").map(Number);
    const monthName = new Date(y, m - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">📅 {monthName}</h3>
          <div className="flex gap-1.5">
            <button onClick={() => { const d = new Date(y, m - 2); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50">← Prev</button>
            <button onClick={() => { const d = new Date(); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50">Today</button>
            <button onClick={() => { const d = new Date(y, m); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50">Next →</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px rounded-xl border border-slate-200 bg-slate-200 overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-600">{d}</div>
          ))}
          {calDays.map((cd, idx) => {
            const isToday = cd.date === todayISODate();
            const hasOverdue = cd.date && cd.date < todayISODate() && cd.leads.length > 0;
            return (
              <div key={idx} className={`min-h-[80px] bg-white p-1.5 ${isToday ? "ring-2 ring-[#788023] ring-inset" : ""}`}>
                {cd.day > 0 && (
                  <>
                    <span className={`text-xs font-medium ${isToday ? "bg-[#788023] text-white rounded-full px-1.5" : hasOverdue ? "text-rose-600" : "text-slate-600"}`}>{cd.day}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {cd.leads.slice(0, 3).map((l) => (
                        <button key={l.id} onClick={() => setDetailLead(l)}
                          className={`w-full rounded px-1 py-0.5 text-[10px] text-left truncate ${
                            l.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : l.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                          }`}>
                          {l.leadName}
                        </button>
                      ))}
                      {cd.leads.length > 3 && <p className="text-[9px] text-slate-400">+{cd.leads.length - 3} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Templates tab
  const renderTemplates = () => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">📋 Follow-up Templates</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FOLLOWUP_TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800">{t.name}</h4>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                t.channel === "Email" ? "bg-sky-100 text-sky-700" : t.channel === "WhatsApp" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
              }`}>{t.channel}</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">{t.description}</p>
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{t.note}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Schedule +{t.daysOffset}d</span>
              <button onClick={() => {
                const targetLead = queueLeads[0];
                if (targetLead) {
                  scheduleLead(targetLead.id, shiftISODate(todayISODate(), t.daysOffset));
                  setActivityLog((prev) => [{ id: makeId(), leadId: targetLead.id, leadName: targetLead.leadName, action: "template", detail: `Applied "${t.name}" template`, timestamp: new Date().toISOString(), type: "template" }, ...prev]);
                }
              }} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Apply to next lead
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Activity log tab
  const renderActivityLog = () => {
    const typeIcons: Record<string, string> = { done: "✅", scheduled: "📅", created: "🆕", snoozed: "⏰", note: "📝", status: "🔄", template: "📋", auto: "🤖" };
    const typeColors: Record<string, string> = { done: "bg-emerald-100", scheduled: "bg-sky-100", created: "bg-violet-100", snoozed: "bg-amber-100", note: "bg-indigo-100", status: "bg-orange-100", template: "bg-teal-100", auto: "bg-slate-100" };
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">📋 Activity Log ({activityLog.length})</h3>
          {activityLog.length > 0 && <button onClick={() => setActivityLog([])} className="text-xs text-slate-400 hover:text-rose-500">Clear</button>}
        </div>
        {activityLog.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <span className="text-3xl">📋</span>
            <p className="mt-2 text-sm text-slate-500">No activity yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lead</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Detail</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.slice(0, 50).map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColors[entry.type] || "bg-slate-100"}`}>{typeIcons[entry.type] || "•"} {entry.action}</span></td>
                    <td className="px-3 py-2 font-medium text-slate-700">{entry.leadName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate">{entry.detail}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Auto-rules tab
  const renderAutoRules = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">🤖 Auto Follow-up Rules</h3>
        <span className="text-xs text-slate-400">{autoRules.filter((r) => r.enabled).length}/{autoRules.length} active</span>
      </div>
      <div className="space-y-2">
        {autoRules.map((rule) => (
          <div key={rule.id} className={`rounded-xl border p-4 transition-colors ${rule.enabled ? "border-[#788023]/30 bg-[#788023]/5" : "border-slate-200 bg-white opacity-60"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{rule.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{rule.condition} → {rule.action} via {rule.channel} (+{rule.daysOffset}d)</p>
              </div>
              <button onClick={() => toggleRule(rule.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${rule.enabled ? "bg-[#788023] text-white" : "bg-slate-200 text-slate-600"}`}>
                {rule.enabled ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Daily Digest
  const renderDailyDigest = () => {
    const today = todayISODate();
    const overdueList = classifiedLeads.filter((l) => l.key === "overdue");
    const todayList = classifiedLeads.filter((l) => l.key === "today");
    const hotPending = classifiedLeads.filter((l) => l.leadTemperature === "Hot" && l.key === "upcoming");
    const highValue = classifiedLeads.filter((l) => (l.dealValue || 0) > 50000 && l.followupStatus !== "Done");
    const doneToday = classifiedLeads.filter((l) => l.followupStatus === "Done").length;
    const totalActive = classifiedLeads.filter((l) => l.followupStatus !== "Done").length;
    const completionPct = totalActive > 0 ? Math.round((doneToday / (totalActive + doneToday)) * 100) : 0;

    return (
      <div className="rounded-xl border border-[#788023]/20 bg-gradient-to-r from-[#788023]/5 to-[#788023]/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">☀️ Daily Digest — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Progress</span>
            <div className="h-2 w-20 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-[#788023] transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-xs font-medium text-[#788023]">{completionPct}%</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {overdueList.length > 0 && (
            <div className="rounded-lg bg-white/80 border border-rose-200 p-2.5">
              <p className="text-xs font-semibold text-rose-700">🚨 Overdue ({overdueList.length})</p>
              <div className="mt-1 space-y-0.5">
                {overdueList.slice(0, 3).map((l) => (
                  <p key={l.id} className="text-[10px] text-slate-600 truncate cursor-pointer hover:text-rose-600" onClick={() => setDetailLead(l)}>
                    {l.leadName} — {l.daysOverdue}d overdue
                  </p>
                ))}
                {overdueList.length > 3 && <p className="text-[10px] text-slate-400">+{overdueList.length - 3} more</p>}
              </div>
            </div>
          )}
          {todayList.length > 0 && (
            <div className="rounded-lg bg-white/80 border border-amber-200 p-2.5">
              <p className="text-xs font-semibold text-amber-700">📌 Due Today ({todayList.length})</p>
              <div className="mt-1 space-y-0.5">
                {todayList.slice(0, 3).map((l) => (
                  <p key={l.id} className="text-[10px] text-slate-600 truncate cursor-pointer hover:text-amber-600" onClick={() => setDetailLead(l)}>
                    {l.leadName} {l.companyName ? `(${l.companyName})` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
          {hotPending.length > 0 && (
            <div className="rounded-lg bg-white/80 border border-rose-100 p-2.5">
              <p className="text-xs font-semibold text-rose-600">🔥 Hot Leads ({hotPending.length})</p>
              <div className="mt-1 space-y-0.5">
                {hotPending.slice(0, 3).map((l) => (
                  <p key={l.id} className="text-[10px] text-slate-600 truncate cursor-pointer hover:text-rose-600" onClick={() => setDetailLead(l)}>
                    {l.leadName} — {formatInr(l.dealValue || 0)}
                  </p>
                ))}
              </div>
            </div>
          )}
          {highValue.length > 0 && (
            <div className="rounded-lg bg-white/80 border border-emerald-200 p-2.5">
              <p className="text-xs font-semibold text-emerald-700">💎 High Value ({highValue.length})</p>
              <div className="mt-1 space-y-0.5">
                {highValue.slice(0, 3).map((l) => (
                  <p key={l.id} className="text-[10px] text-slate-600 truncate cursor-pointer hover:text-emerald-600" onClick={() => setDetailLead(l)}>
                    {l.leadName} — {formatInr(l.dealValue || 0)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Streak tracker */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-medium text-slate-700">Follow-up Streak</span>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              const ds = d.toISOString().slice(0, 10);
              const isToday = ds === today;
              const hasActivity = activityLog.some((a) => a.timestamp.startsWith(ds) && a.type === "done");
              return (
                <div key={i} className={`h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold ${hasActivity ? "bg-[#788023] text-white" : isToday ? "bg-amber-200 text-amber-700" : "bg-slate-200 text-slate-400"}`} title={ds}>
                  {d.getDate()}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-500">Last 7 days · Green = active</span>
        </div>
      </div>
    );
  };

  // ── Recurring Follow-up Modal ──────────────────────────────────────
  const renderRecurringModal = () => {
    if (!showRecurring) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRecurring(false)}>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">🔄 Recurring Follow-up</h3>
            <button onClick={() => setShowRecurring(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Set up an automatic recurring follow-up schedule for a lead.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Lead</label>
              <select value={recurringLeadId} onChange={(e) => setRecurringLeadId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Select lead...</option>
                {leads.filter((l) => l.leadStatus !== "Won" && l.leadStatus !== "Lost" && !l.isDeleted).map((l) => (
                  <option key={l.id} value={l.id}>{l.leadName} — {l.companyName || "No company"}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Frequency</label>
                <select value={recurringFreq} onChange={(e) => setRecurringFreq(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Channel</label>
                <select value={recurringChannel} onChange={(e) => setRecurringChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="email">📧 Email</option>
                  <option value="phone">📱 Phone</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="meeting">🏢 Meeting</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Start Date</label>
                <input type="date" value={recurringStart} onChange={(e) => setRecurringStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">End After</label>
                <select value={recurringEndAfter} onChange={(e) => setRecurringEndAfter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="3">3 occurrences</option>
                  <option value="5">5 occurrences</option>
                  <option value="10">10 occurrences</option>
                  <option value="ongoing">Ongoing</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Note Template</label>
              <textarea value={recurringNote} onChange={(e) => setRecurringNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Follow-up note template..." />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={() => setShowRecurring(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button onClick={() => {
              if (!recurringLeadId) return;
              const newRules = [...autoRules, {
                id: makeId(),
                name: `Recurring: ${leads.find((l) => l.id === recurringLeadId)?.leadName || "Lead"}`,
                trigger: "days_inactive" as const,
                condition: recurringFreq === "daily" ? "1" : recurringFreq === "weekly" ? "7" : recurringFreq === "biweekly" ? "14" : "30",
                action: `Schedule ${recurringChannel} follow-up`,
                channel: recurringChannel,
                daysOffset: parseInt(recurringEndAfter) || 0,
                enabled: true,
              }];
              setAutoRules(newRules);
              setShowRecurring(false);
              setRecurringLeadId("");
            }} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#788023]/90">
              Create Recurring Schedule
            </button>
          </div>
          {/* Preview upcoming dates */}
          {recurringLeadId && recurringStart && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600 mb-2">Upcoming schedule preview:</p>
              <div className="space-y-1">
                {Array.from({ length: Math.min(parseInt(recurringEndAfter) || 5, 5) }, (_, i) => {
                  const offset = recurringFreq === "daily" ? i : recurringFreq === "weekly" ? i * 7 : recurringFreq === "biweekly" ? i * 14 : i * 30;
                  const date = shiftISODate(recurringStart, offset);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{recurringChannel === "email" ? "📧" : recurringChannel === "phone" ? "📱" : recurringChannel === "whatsapp" ? "💬" : "🏢"}</span>
                      <span className="text-slate-600">{formatDateDisplay(date)}</span>
                      <span className="text-slate-400">— {leads.find((l) => l.id === recurringLeadId)?.leadName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Contact Timeline ──────────────────────────────────────────────
  const renderContactTimeline = () => {
    if (!showTimeline || !detailLead) return null;
    const timelineLead = detailLead;
    const entries: { date: string; icon: string; title: string; detail: string; color: string }[] = [];
    // Created
    entries.push({ date: timelineLead.dateAdded, icon: "🆕", title: "Lead Created", detail: `Added from ${timelineLead.leadSource || "Unknown"}`, color: "bg-violet-100" });
    // Status changes
    if (timelineLead.leadStatus !== "New") {
      entries.push({ date: timelineLead.dateAdded, icon: "🔄", title: `Status → ${timelineLead.leadStatus}`, detail: `Changed from New to ${timelineLead.leadStatus}`, color: "bg-sky-100" });
    }
    // Temperature changes
    entries.push({ date: timelineLead.dateAdded, icon: timelineLead.leadTemperature === "Hot" ? "🔥" : timelineLead.leadTemperature === "Warm" ? "🌤️" : "❄️", title: `Temperature: ${timelineLead.leadTemperature}`, detail: `Set to ${timelineLead.leadTemperature}`, color: "bg-amber-100" });
    // Follow-ups
    if (timelineLead.nextFollowupDate) {
      entries.push({ date: timelineLead.nextFollowupDate, icon: "📅", title: "Follow-up Scheduled", detail: `Scheduled for ${formatDateDisplay(timelineLead.nextFollowupDate)}`, color: "bg-emerald-100" });
    }
    if (timelineLead.lastContactedDate) {
      entries.push({ date: timelineLead.lastContactedDate, icon: "📞", title: "Last Contact", detail: `Contacted on ${formatDateDisplay(timelineLead.lastContactedDate)}`, color: "bg-indigo-100" });
    }
    // Notes
    if (timelineLead.notes) {
      entries.push({ date: timelineLead.dateAdded, icon: "📝", title: "Note Added", detail: timelineLead.notes.substring(0, 80) + (timelineLead.notes.length > 80 ? "..." : ""), color: "bg-teal-100" });
    }
    // Deal value
    if (timelineLead.dealValue > 0) {
      entries.push({ date: timelineLead.dateAdded, icon: "💰", title: "Deal Value Set", detail: formatInr(timelineLead.dealValue), color: "bg-emerald-100" });
    }
    // Won/Lost
    if (timelineLead.leadStatus === "Won") {
      entries.push({ date: timelineLead.dateAdded, icon: "🏆", title: "Deal Won!", detail: `Value: ${formatInr(timelineLead.dealValue)}`, color: "bg-emerald-100" });
    }
    if (timelineLead.leadStatus === "Lost") {
      entries.push({ date: timelineLead.dateAdded, icon: "❌", title: "Deal Lost", detail: "No reason specified", color: "bg-rose-100" });
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTimeline(false)}>
        <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">📅 Contact Timeline — {timelineLead.leadName}</h3>
            <button onClick={() => setShowTimeline(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
            <div className="space-y-4">
              {entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, i) => (
                <div key={i} className="relative pl-10">
                  <div className={`absolute left-2.5 top-1 flex h-4 w-4 items-center justify-center rounded-full ${entry.color} text-[10px]`}>
                    {entry.icon}
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">{entry.title}</p>
                      <p className="text-[10px] text-slate-400">{formatDateDisplay(entry.date)}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Batch Schedule Modal ──────────────────────────────────────────
  const renderBatchScheduleModal = () => {
    if (!showBatchSchedule) return null;
    const selectedLeads = leads.filter((l) => selectedIds.has(l.id));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBatchSchedule(false)}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">📅 Batch Schedule</h3>
            <button onClick={() => setShowBatchSchedule(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          <p className="text-sm text-slate-500 mb-3">Schedule follow-ups for {selectedLeads.length} selected leads</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Follow-up Date</label>
              <input type="date" value={batchScheduleDate} onChange={(e) => setBatchScheduleDate(e.target.value)} min={todayISODate()} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Channel</label>
              <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option>📧 Email</option>
                <option>📱 Phone</option>
                <option>💬 WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Note (optional)</label>
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Add a note for all selected..." />
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-2 max-h-32 overflow-y-auto">
            <p className="text-[10px] font-medium text-slate-500 mb-1">Selected leads:</p>
            {selectedLeads.map((l) => (
              <p key={l.id} className="text-xs text-slate-600">• {l.leadName} — {l.companyName || "No company"}</p>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={() => setShowBatchSchedule(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button onClick={() => {
              if (!batchScheduleDate) return;
              const updated = leads.map((l) => {
                if (selectedIds.has(l.id)) {
                  return { ...l, nextFollowupDate: batchScheduleDate };
                }
                return l;
              });
              onLeadsChange(updated);
              setSelectedIds(new Set());
              setShowBatchSchedule(false);
            }} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#788023]/90">
              Schedule {selectedLeads.length} Follow-ups
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Follow-ups</h1>
          <p className="text-sm text-slate-500">
            {queueCounts.overdue} overdue · {queueCounts.today} today · {queueCounts.upcoming} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCompose(true)} className="rounded-lg bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">✉️ Compose</button>
        </div>
      </div>

      {/* Daily Digest */}
      {activeTab === "queue" && renderDailyDigest()}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        {(["queue", "calendar", "templates", "activity", "rules"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {tab === "queue" ? `📋 Queue (${queueCounts.all})` : tab === "calendar" ? "📅 Calendar" : tab === "templates" ? "📋 Templates" : tab === "activity" ? "📊 Activity" : "🤖 Rules"}
          </button>
        ))}
      </div>

      {activeTab === "queue" && (
        <>
          {/* Queue tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", "overdue", "today", "upcoming", "no-date", "done"] as const).map((q) => (
              <button key={q} onClick={() => setQueue(q)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  queue === q ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {q === "no-date" ? "No Date" : q.charAt(0).toUpperCase() + q.slice(1)} ({queueCounts[q]})
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" placeholder="Search..." value={followupSearch} onChange={(e) => setFollowupSearch(e.target.value)}
              className="w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
            <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option value="All">All Assignees</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option value="All">All Stages</option>
              {["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#788023]/10 px-4 py-2.5">
              <span className="text-sm font-medium text-[#788023]">{selectedIds.size} selected</span>
              <button onClick={bulkMarkDone} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">✅ Mark Done</button>
              <button onClick={() => bulkSnooze(2)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Snooze +2d</button>
              <button onClick={() => bulkSnooze(7)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Snooze +7d</button>
              <button onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Clear</button>
            </div>
          )}

          {/* Queue table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-8 px-2 py-2"><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === queueLeads.length}
                    onChange={() => { if (selectedIds.size === queueLeads.length) setSelectedIds(new Set()); else setSelectedIds(new Set(queueLeads.map((l) => l.id))); }}
                    className="rounded border-slate-300" /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lead</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Score</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Contact</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Health</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Deal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Follow-up</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">SLA</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueLeads.map((l) => {
                  const score = fuScore(l);
                  const tag = dateTag(l);
                  return (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-2 py-2"><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => {
                        setSelectedIds((prev) => { const next = new Set(prev); if (next.has(l.id)) next.delete(l.id); else next.add(l.id); return next; });
                      }} className="rounded border-slate-300" /></td>
                      <td className="px-3 py-2">
                        <button onClick={() => setDetailLead(l)} className="text-left">
                          <p className="text-sm font-medium text-slate-800 hover:text-[#788023]">{l.leadName}</p>
                          <p className="text-[11px] text-slate-400">{l.companyName || l.assignedTo || "—"}</p>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${l.leadStatus === "New" ? "bg-violet-100 text-violet-700" : l.leadStatus === "Negotiation" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{l.leadStatus}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${score >= 70 ? "bg-rose-100 text-rose-700" : score >= 40 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{score}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${l.contact.label === "Strong" ? "bg-emerald-50 text-emerald-600" : l.contact.label === "Partial" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}>{l.contact.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <div className="h-1.5 w-10 rounded-full bg-slate-200 overflow-hidden">
                            <div className={`h-full rounded-full ${l.health >= 70 ? "bg-emerald-500" : l.health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${l.health}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{l.health}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium">{formatInr(l.dealValue)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${followupTagClass(tag)}`}>{tag}</span>
                        {l.nextFollowupDate && <p className="text-[10px] text-slate-400 mt-0.5">{formatDateDisplay(l.nextFollowupDate)}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${slaBadge(l.sla).className}`}>{slaBadge(l.sla).label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => markDone(l.id)} className="rounded p-1 text-xs hover:bg-emerald-50 text-emerald-600" title="Mark Done">✅</button>
                          <button onClick={() => snoozeLead(l.id, 2)} className="rounded p-1 text-xs hover:bg-amber-50 text-amber-600" title="Snooze +2d">⏰</button>
                          <button onClick={() => openCompose(l, "email")} className="rounded p-1 text-xs hover:bg-sky-50 text-sky-600" title="Email">📧</button>
                          <button onClick={() => setDetailLead(l)} className="rounded p-1 text-xs hover:bg-slate-100 text-slate-600" title="Details">👁️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {queueLeads.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                <span className="text-3xl">✅</span>
                <p className="mt-2">No follow-ups in this queue</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "calendar" && renderCalendar()}
      {activeTab === "templates" && renderTemplates()}
      {activeTab === "activity" && renderActivityLog()}
      {activeTab === "rules" && renderAutoRules()}

      {/* Follow-up Performance Analytics Panel */}
      {activeTab === "queue" && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Follow-up Performance Analytics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Active", value: classifiedLeads.length, icon: "📋", color: "bg-slate-100 text-slate-700" },
              { label: "Overdue", value: queueCounts.overdue, icon: "🔴", color: "bg-rose-100 text-rose-700" },
              { label: "Due Today", value: queueCounts.today, icon: "🟡", color: "bg-amber-100 text-amber-700" },
              { label: "Upcoming", value: queueCounts.upcoming, icon: "🟢", color: "bg-emerald-100 text-emerald-700" },
              { label: "No Date Set", value: queueCounts["no-date"], icon: "⚪", color: "bg-gray-100 text-gray-700" },
              { label: "Done", value: queueCounts.done, icon: "✅", color: "bg-emerald-100 text-emerald-700" },
            ].map((m) => (
              <div key={m.label} className={`rounded-lg p-3 ${m.color}`}>
                <p className="text-[10px] font-medium opacity-75">{m.icon} {m.label}</p>
                <p className="text-xl font-bold">{m.value}</p>
              </div>
            ))}
          </div>
          {/* Response Rate & Team Performance */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">Team Follow-up Load</h4>
              <div className="space-y-2">
                {assignees.length === 0 && <p className="text-xs text-slate-400">No assignees found</p>}
                {assignees.map((a) => {
                  const aLeads = classifiedLeads.filter((l) => l.assignedTo === a);
                  const aOverdue = aLeads.filter((l) => l.key === "overdue").length;
                  const aToday = aLeads.filter((l) => l.key === "today").length;
                  const aDone = aLeads.filter((l) => l.followupStatus === "Done").length;
                  const rate = aLeads.length > 0 ? Math.round((aDone / aLeads.length) * 100) : 0;
                  return (
                    <div key={a} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#788023]/10 text-xs font-bold text-[#788023]">{a.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700 truncate">{a}</span>
                          <span className="text-[10px] text-slate-500">{aLeads.length} leads · {rate}% done</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-[#788023] transition-all" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {aOverdue > 0 && <span className="rounded px-1 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-700">{aOverdue} overdue</span>}
                        {aToday > 0 && <span className="rounded px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700">{aToday} today</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">SLA Distribution</h4>
              <div className="space-y-2">
                {(["ok", "watch", "escalate", "critical"] as const).map((tier) => {
                  const count = classifiedLeads.filter((l) => l.sla === tier).length;
                  const pct = classifiedLeads.length > 0 ? Math.round((count / classifiedLeads.length) * 100) : 0;
                  const colors: Record<string, string> = { ok: "bg-emerald-500", watch: "bg-yellow-500", escalate: "bg-orange-500", critical: "bg-rose-500" };
                  const labels: Record<string, string> = { ok: "🟢 OK", watch: "🟡 Watch", escalate: "🟠 Escalate", critical: "🔴 Critical" };
                  return (
                    <div key={tier} className="flex items-center gap-2">
                      <span className="text-xs w-24 font-medium text-slate-600">{labels[tier]}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${colors[tier]} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 w-16 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">Temperature Split</h4>
                <div className="flex gap-2">
                  {(["Hot", "Warm", "Cold"] as const).map((t) => {
                    const count = classifiedLeads.filter((l) => l.leadTemperature === t).length;
                    const colors = { Hot: "bg-rose-500", Warm: "bg-amber-500", Cold: "bg-sky-500" };
                    return (
                      <div key={t} className="flex-1 rounded-lg p-2 text-center">
                        <div className={`mx-auto mb-1 h-2 rounded-full ${colors[t]}`} style={{ width: `${classifiedLeads.length > 0 ? (count / classifiedLeads.length) * 100 : 0}%`, minWidth: "4px" }} />
                        <p className="text-xs font-bold text-slate-700">{count}</p>
                        <p className="text-[10px] text-slate-500">{t}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-rules Performance Summary */}
      {activeTab === "rules" && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📈 Auto-Rules Performance Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[10px] font-medium text-emerald-600">✅ Active Rules</p>
              <p className="text-xl font-bold text-emerald-700">{autoRules.filter((r) => r.enabled).length}</p>
              <p className="text-[10px] text-emerald-500">of {autoRules.length} total</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-[10px] font-medium text-sky-600">📧 Email Actions</p>
              <p className="text-xl font-bold text-sky-700">{autoRules.filter((r) => r.channel === "Email").length}</p>
              <p className="text-[10px] text-sky-500">email-based rules</p>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-[10px] font-medium text-violet-600">📱 WhatsApp Actions</p>
              <p className="text-xl font-bold text-violet-700">{autoRules.filter((r) => r.channel === "WhatsApp").length}</p>
              <p className="text-[10px] text-violet-500">whatsapp-based rules</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] font-medium text-amber-600">⏱ Avg Response</p>
              <p className="text-xl font-bold text-amber-700">{autoRules.filter((r) => r.enabled).length > 0 ? Math.round(autoRules.filter((r) => r.enabled).reduce((s, r) => s + r.daysOffset, 0) / autoRules.filter((r) => r.enabled).length * 10) / 10 : 0}d</p>
              <p className="text-[10px] text-amber-500">avg trigger delay</p>
            </div>
          </div>
        </div>
      )}

      {/* Template Usage Statistics */}
      {activeTab === "templates" && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Template Usage & Effectiveness</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Template</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Channel</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Days Offset</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Est. Effectiveness</th>
                </tr>
              </thead>
              <tbody>
                {FOLLOWUP_TEMPLATES.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-700">{t.name}</p>
                      <p className="text-[10px] text-slate-400 max-w-xs truncate">{t.description}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        t.channel === "Email" ? "bg-violet-100 text-violet-700" :
                        t.channel === "WhatsApp" ? "bg-emerald-100 text-emerald-700" :
                        t.channel === "Phone" ? "bg-sky-100 text-sky-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{t.channel}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">+{t.daysOffset}d</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-[#788023]" style={{ width: `${Math.max(20, 100 - t.daysOffset * 5)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500">{Math.max(20, 100 - t.daysOffset * 5)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {renderDetailModal()}
      {renderComposeModal()}
      {renderRecurringModal()}
      {renderContactTimeline()}
      {renderBatchScheduleModal()}
    </div>
  );
}
