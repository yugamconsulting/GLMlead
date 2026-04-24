// =====================================================================
// PIPELINE VIEW — Full Kanban board with drag-and-drop, WIP limits,
// priority scoring, SLA alerts, column statistics, filtering,
// batch operations, stage transition audit trail, enhanced cards,
// stage analytics, conversion funnel, audit log, velocity tracking,
// stage duration metrics, drag-drop with confirmation modal
// =====================================================================
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Lead, LeadStatus, ViewKey } from "../../types/index";
import { LEAD_STATUSES, LEAD_TEMPERATURES, LEAD_SOURCES } from "../../constants/index";
import {
  formatInr, formatDateDisplay, todayISODate, dateTag, followupTagClass,
  neglectRisk, pipelinePriorityScore, leadHealthScore,
  isOpenLeadStatus, leadSlaTier, contactabilityBadge,
  daysSince, neglectDays, makeId,
} from "../../lib/utils";

function slaBadge(tier: string): { label: string; className: string } {
  switch (tier) {
    case "critical": return { label: "🔴 Critical", className: "bg-rose-100 text-rose-700" };
    case "escalate": return { label: "🟠 Escalate", className: "bg-orange-100 text-orange-700" };
    case "watch": return { label: "🟡 Watch", className: "bg-amber-100 text-amber-700" };
    default: return { label: "🟢 OK", className: "bg-emerald-100 text-emerald-700" };
  }
}

type PipelineViewProps = {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  currentUser: { name: string; role: string };
  onNavigate?: (view: ViewKey) => void;
};

const STATUS_COLORS: Record<string, string> = {
  "New": "bg-sky-100 border-sky-300 text-sky-800",
  "Contacted": "bg-blue-100 border-blue-300 text-blue-800",
  "Qualified": "bg-indigo-100 border-indigo-300 text-indigo-800",
  "Proposal Sent": "bg-violet-100 border-violet-300 text-violet-800",
  "Negotiation": "bg-amber-100 border-amber-300 text-amber-800",
  "Confirmation": "bg-orange-100 border-orange-300 text-orange-800",
  "Invoice Sent": "bg-teal-100 border-teal-300 text-teal-800",
  "Won": "bg-emerald-100 border-emerald-300 text-emerald-800",
  "Lost": "bg-rose-100 border-rose-300 text-rose-800",
};

const COLUMN_COLORS: Record<string, string> = {
  "New": "border-t-sky-400",
  "Contacted": "border-t-blue-400",
  "Qualified": "border-t-indigo-400",
  "Proposal Sent": "border-t-violet-400",
  "Negotiation": "border-t-amber-400",
  "Confirmation": "border-t-orange-400",
  "Invoice Sent": "border-t-teal-400",
  "Won": "border-t-emerald-400",
  "Lost": "border-t-rose-400",
};

const COLUMN_BG: Record<string, string> = {
  "New": "bg-sky-50/50",
  "Contacted": "bg-blue-50/50",
  "Qualified": "bg-indigo-50/50",
  "Proposal Sent": "bg-violet-50/50",
  "Negotiation": "bg-amber-50/50",
  "Confirmation": "bg-orange-50/50",
  "Invoice Sent": "bg-teal-50/50",
  "Won": "bg-emerald-50/50",
  "Lost": "bg-rose-50/50",
};

const WIP_LIMITS: Record<string, number> = {
  "New": 20, "Contacted": 15, "Qualified": 10, "Proposal Sent": 8,
  "Negotiation": 6, "Confirmation": 4, "Invoice Sent": 4, "Won": 0, "Lost": 0,
};

const STAGE_PROBABILITY: Record<string, number> = {
  "New": 5, "Contacted": 10, "Qualified": 20, "Proposal Sent": 35,
  "Negotiation": 50, "Confirmation": 75, "Invoice Sent": 90, "Won": 100, "Lost": 0,
};

// Audit trail entry
interface AuditEntry {
  id: string;
  leadId: string;
  leadName: string;
  fromStage: string;
  toStage: string;
  by: string;
  at: string;
  reason: string;
  dealValue: number;
}

export function PipelineView({ leads, onLeadsChange, currentUser, onNavigate: _onNavigate }: PipelineViewProps) {
  void _onNavigate;
  const [pipelineView, setPipelineView] = useState<"kanban" | "funnel" | "analytics" | "audit" | "velocity">("kanban");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTarget, setBatchTarget] = useState<string>("");
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [wonModal, setWonModal] = useState<Lead | null>(null);
  const [lostModal, setLostModal] = useState<Lead | null>(null);
  const [wonValue, setWonValue] = useState(0);
  const [lostReason, setLostReason] = useState("");
  const [transitionModal, setTransitionModal] = useState<{ lead: Lead; from: string; to: string } | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const kanbanRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const openStages = LEAD_STATUSES.filter(isOpenLeadStatus);
  const allStages = LEAD_STATUSES;

  // Unique assignees and sources
  const assignees = useMemo(() => [...new Set(leads.map((l) => l.assignedTo).filter(Boolean))], [leads]);
  const sources = useMemo(() => [...new Set(leads.map((l) => l.leadSource).filter(Boolean))], [leads]);

  // Filter pipeline leads
  const pipelineLeads = useMemo(() => leads.filter((l) => {
    if (l.isDeleted) return false;
    if (l.leadStatus === "Won" || l.leadStatus === "Lost") return false;
    if (tempFilter !== "all" && l.leadTemperature !== tempFilter) return false;
    if (sourceFilter !== "all" && l.leadSource !== sourceFilter) return false;
    if (assigneeFilter !== "all" && l.assignedTo !== assigneeFilter) return false;
    if (searchQ && !l.leadName.toLowerCase().includes(searchQ.toLowerCase()) && !l.companyName.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [leads, tempFilter, sourceFilter, assigneeFilter, searchQ]);

  const wonLeads = useMemo(() => leads.filter((l) => !l.isDeleted && l.leadStatus === "Won"), [leads]);
  const lostLeads = useMemo(() => leads.filter((l) => !l.isDeleted && l.leadStatus === "Lost"), [leads]);

  // Pipeline totals
  const pipelineTotals = useMemo(() => {
    const totalValue = pipelineLeads.reduce((s, l) => s + (l.dealValue || 0), 0);
    const weightedValue = pipelineLeads.reduce((s, l) => s + (l.dealValue || 0) * (STAGE_PROBABILITY[l.leadStatus] || 0) / 100, 0);
    return { openCount: pipelineLeads.length, totalOpenValue: totalValue, weightedPipeline: weightedValue };
  }, [pipelineLeads]);

  // Stage stats
  const stageStats = useMemo(() => {
    const map = new Map<string, { count: number; value: number; hotCount: number; avgDays: number; leads: Lead[] }>();
    for (const s of allStages) {
      const sl = pipelineLeads.filter((l) => l.leadStatus === s);
      const wl = wonLeads.filter((l) => l.leadStatus === s);
      const ll = lostLeads.filter((l) => l.leadStatus === s);
      const all = [...sl, ...wl, ...ll];
      const val = sl.reduce((s2, l) => s2 + (l.dealValue || 0), 0);
      const hot = sl.filter((l) => l.leadTemperature === "Hot").length;
      const avgD = sl.length > 0 ? sl.reduce((s2, l) => s2 + daysSince(l.createdAt), 0) / sl.length : 0;
      map.set(s, { count: sl.length, value: val, hotCount: hot, avgDays: avgD, leads: all });
    }
    return map;
  }, [pipelineLeads, wonLeads, lostLeads, allStages]);

  // Conversion funnel data (used in analytics)
  const _funnelData = useMemo(() => {
    const totalNew = pipelineLeads.filter((l) => l.leadStatus === "New").length;
    return allStages.map((stage) => {
      const count = stageStats.get(stage)?.count || 0;
      const wonFromStage = wonLeads.filter((l) => l.leadStatus === "Won").length;
      return { stage, count, pct: totalNew > 0 ? (count / totalNew * 100) : 0, wonFromStage };
    });
  }, [pipelineLeads, wonLeads, stageStats, allStages]);
  void _funnelData;

  // Velocity metrics
  const velocityMetrics = useMemo(() => {
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 86400000);
    const recentWon = wonLeads.filter((l) => new Date(l.updatedAt) >= last30);
    const recentLost = lostLeads.filter((l) => new Date(l.updatedAt) >= last30);
    const recentNew = pipelineLeads.filter((l) => new Date(l.createdAt) >= last30);
    const avgDaysToWon = recentWon.length > 0 ? recentWon.reduce((s, l) => s + daysSince(l.createdAt), 0) / recentWon.length : 0;
    const avgDealSize = recentWon.length > 0 ? recentWon.reduce((s, l) => s + (l.wonDealValue || l.dealValue || 0), 0) / recentWon.length : 0;
    const winRate = (recentWon.length + recentLost.length) > 0 ? recentWon.length / (recentWon.length + recentLost.length) * 100 : 0;
    return { recentNew: recentNew.length, recentWon: recentWon.length, recentLost: recentLost.length, avgDaysToWon, avgDealSize, winRate };
  }, [wonLeads, lostLeads, pipelineLeads]);

  // Stage duration analysis
  const stageDurations = useMemo(() => {
    return openStages.map((stage) => {
      const stageLeadsList = pipelineLeads.filter((l) => l.leadStatus === stage);
      const avgDays = stageLeadsList.length > 0 ? stageLeadsList.reduce((s, l) => s + daysSince(l.createdAt), 0) / stageLeadsList.length : 0;
      const maxDays = stageLeadsList.length > 0 ? Math.max(...stageLeadsList.map((l) => daysSince(l.createdAt))) : 0;
      const stagnant = stageLeadsList.filter((l) => daysSince(l.createdAt) > 14).length;
      return { stage, count: stageLeadsList.length, avgDays, maxDays, stagnant, value: stageLeadsList.reduce((s, l) => s + (l.dealValue || 0), 0) };
    });
  }, [pipelineLeads, openStages]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    setDragId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverStage(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStage: LeadStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setDragOverStage(null);
    setDragId(null);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.leadStatus === targetStage) return;
    if (targetStage === "Won") { setWonModal(lead); setWonValue(lead.dealValue || 0); return; }
    if (targetStage === "Lost") { setLostModal(lead); return; }
    if (lead.leadStatus !== "Won" && lead.leadStatus !== "Lost") {
      setTransitionModal({ lead, from: lead.leadStatus, to: targetStage });
    }
  }, [leads]);

  const confirmTransition = useCallback((reason: string) => {
    if (!transitionModal) return;
    const { lead, from, to } = transitionModal;
    onLeadsChange(leads.map((l) => l.id === lead.id ? { ...l, leadStatus: to as LeadStatus, updatedAt: new Date().toISOString(), lastContactedDate: todayISODate() } : l));
    setAuditLog((prev) => [{ id: makeId(), leadId: lead.id, leadName: lead.leadName, fromStage: from, toStage: to, by: currentUser.name, at: new Date().toISOString(), reason, dealValue: lead.dealValue || 0 }, ...prev]);
    setTransitionModal(null);
    setTransitionReason("");
  }, [transitionModal, leads, onLeadsChange, currentUser.name]);

  const confirmWon = useCallback(() => {
    if (!wonModal) return;
    onLeadsChange(leads.map((l) => l.id === wonModal.id ? { ...l, leadStatus: "Won" as LeadStatus, wonDealValue: wonValue, updatedAt: new Date().toISOString(), lastContactedDate: todayISODate() } : l));
    setAuditLog((prev) => [{ id: makeId(), leadId: wonModal.id, leadName: wonModal.leadName, fromStage: wonModal.leadStatus, toStage: "Won", by: currentUser.name, at: new Date().toISOString(), reason: `Won deal — ${formatInr(wonValue)}`, dealValue: wonValue }, ...prev]);
    setWonModal(null);
  }, [wonModal, wonValue, leads, onLeadsChange, currentUser.name]);

  const confirmLost = useCallback(() => {
    if (!lostModal) return;
    onLeadsChange(leads.map((l) => l.id === lostModal.id ? { ...l, leadStatus: "Lost" as LeadStatus, updatedAt: new Date().toISOString(), lastContactedDate: todayISODate() } : l));
    setAuditLog((prev) => [{ id: makeId(), leadId: lostModal.id, leadName: lostModal.leadName, fromStage: lostModal.leadStatus, toStage: "Lost", by: currentUser.name, at: new Date().toISOString(), reason: lostReason || "No reason provided", dealValue: 0 }, ...prev]);
    setLostModal(null);
    setLostReason("");
  }, [lostModal, lostReason, leads, onLeadsChange, currentUser.name]);

  // Batch operations
  const handleBatchMove = useCallback(() => {
    if (!batchTarget || selectedLeads.size === 0) return;
    let updated = [...leads];
    const entries: AuditEntry[] = [];
    updated = updated.map((l) => {
      if (selectedLeads.has(l.id)) {
        entries.push({ id: makeId(), leadId: l.id, leadName: l.leadName, fromStage: l.leadStatus, toStage: batchTarget, by: currentUser.name, at: new Date().toISOString(), reason: `Batch move (${selectedLeads.size} leads)`, dealValue: l.dealValue || 0 });
        return { ...l, leadStatus: batchTarget as LeadStatus, updatedAt: new Date().toISOString() };
      }
      return l;
    });
    onLeadsChange(updated);
    setAuditLog((prev) => [...entries, ...prev]);
    setSelectedLeads(new Set());
    setShowBatchModal(false);
    setBatchTarget("");
  }, [batchTarget, selectedLeads, leads, onLeadsChange, currentUser.name]);

  const handleBatchTemp = useCallback((temp: string) => {
    onLeadsChange(leads.map((l) => selectedLeads.has(l.id) ? { ...l, leadTemperature: temp as Lead["leadTemperature"], updatedAt: new Date().toISOString() } : l));
    setSelectedLeads(new Set());
  }, [selectedLeads, leads, onLeadsChange]);

  const handleBatchAssign = useCallback((assignee: string) => {
    onLeadsChange(leads.map((l) => selectedLeads.has(l.id) ? { ...l, assignedTo: assignee, updatedAt: new Date().toISOString() } : l));
    setSelectedLeads(new Set());
  }, [selectedLeads, leads, onLeadsChange]);

  // Render pipeline card
  const renderCard = useCallback((lead: Lead) => {
    const health = leadHealthScore(lead);
    const sla = leadSlaTier(lead);
    const contact = contactabilityBadge(lead);
    const risk = neglectRisk(lead);
    const priority = pipelinePriorityScore(lead);
    const tag = dateTag(lead);
    const isSelected = selectedLeads.has(lead.id);
    const isDragging = dragId === lead.id;

    return (
      <div key={lead.id}
        draggable={!batchMode}
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onClick={() => { if (batchMode) { setSelectedLeads((prev) => { const next = new Set(prev); if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id); return next; }); } else { setDetailLead(lead); } }}
        className={`group relative rounded-lg border p-2.5 cursor-pointer transition-all duration-200 ${
          isDragging ? "opacity-50 rotate-1 scale-95 shadow-lg" : "hover:shadow-md hover:-translate-y-0.5"
        } ${isSelected ? "border-[#788023] bg-[#788023]/5 ring-1 ring-[#788023]/30" : "border-slate-200 bg-white hover:border-slate-300"}`}
      >
        {batchMode && (
          <div className="absolute -top-1.5 -left-1.5">
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center text-[8px] ${isSelected ? "border-[#788023] bg-[#788023] text-white" : "border-slate-300 bg-white"}`}>
              {isSelected && "✓"}
            </div>
          </div>
        )}

        {/* Priority indicator */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${lead.leadTemperature === "Hot" ? "bg-rose-500" : lead.leadTemperature === "Warm" ? "bg-amber-500" : "bg-sky-500"}`} />
            <span className="text-[10px] text-slate-400">P{priority}</span>
          </div>
          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${contact.label === "Strong" ? "bg-emerald-50 text-emerald-600" : contact.label === "Partial" ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}`}>{contact.label}</span>
        </div>

        {/* Lead name & company */}
        <p className="text-sm font-medium text-slate-800 truncate">{lead.leadName}</p>
        {lead.companyName && <p className="text-[11px] text-slate-500 truncate">{lead.companyName}</p>}

        {/* Deal value */}
        {(lead.dealValue || 0) > 0 && (
          <p className="mt-1 text-xs font-semibold text-[#788023]">{formatInr(lead.dealValue)}</p>
        )}

        {/* Health bar */}
        <div className="mt-1.5 flex items-center gap-1">
          <div className="h-1 flex-1 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${health}%` }} />
          </div>
          <span className="text-[9px] text-slate-400">{health}</span>
        </div>

        {/* Tags row */}
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${slaBadge(sla).className}`}>{slaBadge(sla).label}</span>
          <span className={`rounded px-1 py-0.5 text-[9px] ${followupTagClass(tag)}`}>{tag}</span>
          {risk === "High" && <span className="rounded bg-rose-50 px-1 py-0.5 text-[9px] text-rose-600">⚠️ Neglect</span>}
        </div>

        {/* Assignee & source */}
        <div className="mt-1.5 flex items-center justify-between">
          {lead.assignedTo && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <span className="h-3.5 w-3.5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-medium text-slate-600">{lead.assignedTo[0]}</span>
              {lead.assignedTo}
            </span>
          )}
          <span className="text-[10px] text-slate-400">{lead.leadSource}</span>
        </div>

        {/* Follow-up indicator */}
        {lead.nextFollowupDate && (
          <div className="mt-1 text-[10px] text-slate-400">
            📅 {formatDateDisplay(lead.nextFollowupDate)}
          </div>
        )}
      </div>
    );
  }, [batchMode, selectedLeads, dragId, handleDragStart]);

  // Analytics view
  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Velocity KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "New (30d)", value: velocityMetrics.recentNew, color: "sky" },
          { label: "Won (30d)", value: velocityMetrics.recentWon, color: "emerald" },
          { label: "Lost (30d)", value: velocityMetrics.recentLost, color: "rose" },
          { label: "Win Rate", value: `${velocityMetrics.winRate.toFixed(0)}%`, color: "violet" },
          { label: "Avg Days to Won", value: `${velocityMetrics.avgDaysToWon.toFixed(0)}d`, color: "amber" },
          { label: "Avg Deal Size", value: formatInr(velocityMetrics.avgDealSize), color: "indigo" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color === "emerald" ? "text-emerald-600" : kpi.color === "rose" ? "text-rose-600" : kpi.color === "violet" ? "text-violet-600" : kpi.color === "amber" ? "text-amber-600" : kpi.color === "indigo" ? "text-indigo-600" : "text-sky-600"}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Stage Duration Analysis */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">⏱️ Stage Duration Analysis</h3>
          <p className="text-xs text-slate-400">Average and maximum days leads spend in each stage</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Stage</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Count</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Value</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Avg Days</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Max Days</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Stagnant (&gt;14d)</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Health</th>
              </tr>
            </thead>
            <tbody>
              {stageDurations.map((row) => (
                <tr key={row.stage} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_COLORS[row.stage]?.replace("border-t-", "bg-").replace("-400", "-400") || "bg-slate-400"}`} />
                      <span className="font-medium text-slate-700">{row.stage}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">{row.count}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatInr(row.value)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-medium ${row.avgDays > 10 ? "text-rose-600" : row.avgDays > 5 ? "text-amber-600" : "text-emerald-600"}`}>{row.avgDays.toFixed(1)}d</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-slate-500">{row.maxDays}d</td>
                  <td className="px-4 py-2.5 text-center">
                    {row.stagnant > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{row.stagnant}</span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${row.avgDays > 10 ? "bg-rose-500" : row.avgDays > 5 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (1 - row.avgDays / 30) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">🔻 Conversion Funnel</h3>
          <p className="text-xs text-slate-400">Lead count and value by pipeline stage</p>
        </div>
        <div className="p-4 space-y-2">
          {allStages.map((stage) => {
            const stats = stageStats.get(stage);
            const count = stats?.count || 0;
            const value = stats?.value || 0;
            const maxCount = Math.max(...allStages.map((s) => stageStats.get(s)?.count || 1));
            const widthPct = maxCount > 0 ? (count / maxCount * 100) : 0;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-28 text-xs font-medium text-slate-600">{stage}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-7 rounded bg-slate-50 relative overflow-hidden">
                    <div className={`h-7 rounded flex items-center px-2 text-xs font-medium transition-all duration-500 ${
                      stage === "Won" ? "bg-emerald-100 text-emerald-800" : stage === "Lost" ? "bg-rose-100 text-rose-800" : "bg-[#788023]/15 text-[#788023]"
                    }`} style={{ width: `${Math.max(widthPct, count > 0 ? 15 : 3)}%` }}>
                      {count > 0 && `${count}`}
                    </div>
                  </div>
                  <span className="w-24 text-right text-xs text-slate-500">{value > 0 ? formatInr(value) : "—"}</span>
                  <span className="w-12 text-right text-[10px] text-slate-400">{STAGE_PROBABILITY[stage]}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source performance in pipeline */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">📊 Pipeline by Source</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Source</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">In Pipeline</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Won</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Lost</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Pipeline Value</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Won Value</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {LEAD_SOURCES.map((source) => {
                const srcPipeline = pipelineLeads.filter((l) => l.leadSource === source);
                const srcWon = wonLeads.filter((l) => l.leadSource === source);
                const srcLost = lostLeads.filter((l) => l.leadSource === source);
                const total = srcWon.length + srcLost.length;
                const conv = total > 0 ? (srcWon.length / total * 100) : 0;
                return (
                  <tr key={source} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">{source}</td>
                    <td className="px-4 py-2 text-center text-sky-600">{srcPipeline.length}</td>
                    <td className="px-4 py-2 text-center text-emerald-600">{srcWon.length}</td>
                    <td className="px-4 py-2 text-center text-rose-600">{srcLost.length}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatInr(srcPipeline.reduce((s, l) => s + (l.dealValue || 0), 0))}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{formatInr(srcWon.reduce((s, l) => s + (l.wonDealValue || l.dealValue || 0), 0))}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conv >= 50 ? "bg-emerald-100 text-emerald-700" : conv >= 25 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{conv.toFixed(0)}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Temperature Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">🌡️ Temperature Distribution by Stage</h3>
        </div>
        <div className="p-4 space-y-3">
          {openStages.map((stage) => {
            const stageL = pipelineLeads.filter((l) => l.leadStatus === stage);
            const hot = stageL.filter((l) => l.leadTemperature === "Hot").length;
            const warm = stageL.filter((l) => l.leadTemperature === "Warm").length;
            const cold = stageL.filter((l) => l.leadTemperature === "Cold").length;
            const total = hot + warm + cold;
            if (total === 0) return null;
            return (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-28 text-xs font-medium text-slate-600">{stage}</span>
                <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden flex">
                  {hot > 0 && <div className="h-full bg-rose-400 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(hot / total) * 100}%` }}>{hot}</div>}
                  {warm > 0 && <div className="h-full bg-amber-400 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(warm / total) * 100}%` }}>{warm}</div>}
                  {cold > 0 && <div className="h-full bg-sky-400 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(cold / total) * 100}%` }}>{cold}</div>}
                </div>
                <span className="w-8 text-right text-xs text-slate-500">{total}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Audit log view
  const renderAuditLog = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">📋 Stage Transition Audit Log</h3>
          <p className="text-xs text-slate-400">{auditLog.length} recorded transitions</p>
        </div>
        {auditLog.length > 0 && (
          <button onClick={() => setAuditLog([])} className="text-xs text-slate-400 hover:text-rose-500">Clear Log</button>
        )}
      </div>
      {auditLog.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <span className="text-3xl">📋</span>
          <p className="mt-2 text-sm text-slate-500">No stage transitions recorded yet</p>
          <p className="text-xs text-slate-400">Drag leads between stages to see audit entries here</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Lead</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">From → To</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">By</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Value</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.slice(0, 50).map((entry) => (
                <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(entry.at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2 font-medium text-slate-700">{entry.leadName}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs">
                      <span className={`rounded px-1.5 py-0.5 ${STATUS_COLORS[entry.fromStage] || "bg-slate-100 text-slate-600"}`}>{entry.fromStage}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className={`rounded px-1.5 py-0.5 ${STATUS_COLORS[entry.toStage] || "bg-slate-100 text-slate-600"}`}>{entry.toStage}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{entry.by}</td>
                  <td className="px-4 py-2 text-right text-xs font-medium">{formatInr(entry.dealValue)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 max-w-[200px] truncate">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Funnel view
  const renderFunnelView = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Open Pipeline</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{pipelineLeads.length}</p>
          <p className="text-xs text-slate-400">{formatInr(pipelineTotals.totalOpenValue)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">Won Deals</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{wonLeads.length}</p>
          <p className="text-xs text-emerald-600">{formatInr(wonLeads.reduce((s, l) => s + (l.wonDealValue || l.dealValue || 0), 0))}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-medium text-rose-700">Lost Deals</p>
          <p className="mt-1 text-2xl font-bold text-rose-800">{lostLeads.length}</p>
          <p className="text-xs text-rose-600">{formatInr(lostLeads.reduce((s, l) => s + (l.dealValue || 0), 0))}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-medium text-indigo-700">Weighted Forecast</p>
          <p className="mt-1 text-2xl font-bold text-indigo-800">{formatInr(pipelineTotals.weightedPipeline)}</p>
          <p className="text-xs text-indigo-600">Probability-adjusted</p>
        </div>
      </div>

      {/* Visual funnel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">🔻 Pipeline Funnel</h3>
        <div className="space-y-1.5">
          {allStages.map((stage) => {
            const stats = stageStats.get(stage);
            const count = stats?.count || 0;
            const value = stats?.value || 0;
            const maxCount = Math.max(...allStages.map((s) => stageStats.get(s)?.count || 0), 1);
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-28 text-right text-xs font-medium text-slate-600">{stage}</div>
                <div className="flex-1 flex items-center">
                  <div className={`h-8 rounded-r flex items-center px-3 text-xs font-medium transition-all duration-700 ${
                    stage === "Won" ? "bg-emerald-200 text-emerald-800" : stage === "Lost" ? "bg-rose-200 text-rose-800" : "bg-[#788023]/20 text-[#788023]"
                  }`} style={{ width: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 1)}%` }}>
                    {count > 0 && <span>{count} · {formatInr(value)}</span>}
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-slate-400">{STAGE_PROBABILITY[stage]}%</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-400">
          <span>Total Pipeline: {formatInr(pipelineTotals.totalOpenValue)}</span>
          <span>Weighted: {formatInr(pipelineTotals.weightedPipeline)}</span>
        </div>
      </div>
    </div>
  );

  // Kanban view
  const renderKanban = () => (
    <div ref={kanbanRef} className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-300px)]">
      {openStages.map((stage) => {
        const stageLeads = pipelineLeads.filter((l) => l.leadStatus === stage);
        const stats = stageStats.get(stage);
        const count = stats?.count || 0;
        const value = stats?.value || 0;
        const wipLimit = WIP_LIMITS[stage] || 0;
        const wipPct = wipLimit > 0 ? (count / wipLimit * 100) : 0;
        const isDragOver = dragOverStage === stage;

        return (
          <div key={stage} className={`flex-shrink-0 w-72 rounded-xl border-t-4 ${COLUMN_COLORS[stage] || "border-t-slate-300"} ${COLUMN_BG[stage] || "bg-white"} border border-slate-200 flex flex-col transition-all duration-200 ${isDragOver ? "ring-2 ring-[#788023]/40 bg-[#788023]/5" : ""}`}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage as LeadStatus)}>
            {/* Column header */}
            <div className="p-3 border-b border-slate-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">{stage}</span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{count}</span>
                </div>
                {wipLimit > 0 && (
                  <span className={`text-[10px] font-medium ${wipPct > 90 ? "text-rose-600" : wipPct > 70 ? "text-amber-600" : "text-emerald-600"}`}>{count}/{wipLimit}</span>
                )}
              </div>
              {value > 0 && <p className="mt-0.5 text-[11px] font-medium text-slate-500">{formatInr(value)}</p>}
              {wipLimit > 0 && (
                <div className="mt-1.5 h-1 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-1 rounded-full transition-all duration-500 ${wipPct > 90 ? "bg-rose-500" : wipPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(wipPct, 100)}%` }} />
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 overflow-y-auto max-h-[calc(100vh-420px)]">
              {stageLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-400">
                  <span className="text-2xl mb-1">📭</span>
                  <span>No leads</span>
                </div>
              ) : (
                stageLeads.map((lead) => renderCard(lead))
              )}
              {isDragOver && (
                <div className="mt-2 rounded-lg border-2 border-dashed border-[#788023]/50 bg-[#788023]/5 p-4 text-center text-xs text-[#788023] animate-pulse">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Detail modal
  const renderDetailModal = () => {
    if (!detailLead) return null;
    const health = leadHealthScore(detailLead);
    const sla = leadSlaTier(detailLead);
    const contact = contactabilityBadge(detailLead);
    const priority = pipelinePriorityScore(detailLead);
    const risk = neglectRisk(detailLead);
    const dSince = daysSince(detailLead.createdAt);
    const nDays = neglectDays(detailLead);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailLead(null)}>
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className={`p-4 border-b ${COLUMN_COLORS[detailLead.leadStatus] || "border-slate-200"} border-t-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{detailLead.leadName}</h3>
                {detailLead.companyName && <p className="text-sm text-slate-500">{detailLead.companyName}</p>}
              </div>
              <button onClick={() => setDetailLead(null)} className="rounded-lg p-1 hover:bg-slate-100 text-slate-400">✕</button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailLead.leadStatus]}`}>{detailLead.leadStatus}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${detailLead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : detailLead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{detailLead.leadTemperature}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${contact.label === "Strong" ? "bg-emerald-100 text-emerald-700" : contact.label === "Partial" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>📞 {contact.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${slaBadge(sla).className}`}>SLA: {slaBadge(sla).label}</span>
            </div>

            {/* Scoring breakdown */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">📊 Lead Score Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Priority Score</span><span className="font-medium">P{priority}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Health Score</span><span className={`font-medium ${health >= 70 ? "text-emerald-600" : health >= 40 ? "text-amber-600" : "text-rose-600"}`}>{health}/100</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Neglect Risk</span><span className={`font-medium ${risk === "High" ? "text-rose-600" : risk === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>{risk}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Days in Pipeline</span><span className="font-medium">{dSince}d</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Days Neglected</span><span className={`font-medium ${nDays > 7 ? "text-rose-600" : "text-emerald-600"}`}>{nDays}d</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Stage Probability</span><span className="font-medium">{STAGE_PROBABILITY[detailLead.leadStatus]}%</span></div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full rounded-full ${health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${health}%` }} />
              </div>
            </div>

            {/* Contact info */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-600 mb-1">👤 Contact Info</h4>
              {detailLead.phoneNumber && <p className="text-xs text-slate-600">📱 {detailLead.phoneNumber}</p>}
              {detailLead.emailId && <p className="text-xs text-slate-600">📧 {detailLead.emailId}</p>}
              {detailLead.companyName && <p className="text-xs text-slate-600">🏢 {detailLead.companyName}</p>}
              {detailLead.leadSource && <p className="text-xs text-slate-600">🔗 {detailLead.leadSource}</p>}
              {detailLead.serviceInterested && <p className="text-xs text-slate-600">💼 {detailLead.serviceInterested}</p>}
              {detailLead.assignedTo && <p className="text-xs text-slate-600">👤 {detailLead.assignedTo}</p>}
            </div>

            {/* Deal info */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-600 mb-1">💰 Deal Information</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Deal Value:</span> <span className="font-medium">{formatInr(detailLead.dealValue)}</span></div>
                <div><span className="text-slate-500">Weighted:</span> <span className="font-medium">{formatInr((detailLead.dealValue || 0) * (STAGE_PROBABILITY[detailLead.leadStatus] || 0) / 100)}</span></div>
                <div><span className="text-slate-500">Expected Close:</span> <span className="font-medium">{detailLead.expectedClosingDate ? formatDateDisplay(detailLead.expectedClosingDate) : "—"}</span></div>
                <div><span className="text-slate-500">Follow-up:</span> <span className="font-medium">{detailLead.nextFollowupDate ? formatDateDisplay(detailLead.nextFollowupDate) : "—"}</span></div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="text-xs font-semibold text-slate-600 mb-2">⚡ Quick Actions</h4>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => { setDetailLead(null); setTransitionModal({ lead: detailLead, from: detailLead.leadStatus, to: "Contacted" }); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">→ Contacted</button>
                <button onClick={() => { setDetailLead(null); setTransitionModal({ lead: detailLead, from: detailLead.leadStatus, to: "Qualified" }); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">→ Qualified</button>
                <button onClick={() => { setDetailLead(null); setTransitionModal({ lead: detailLead, from: detailLead.leadStatus, to: "Proposal Sent" }); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">→ Proposal</button>
                <button onClick={() => { setDetailLead(null); setTransitionModal({ lead: detailLead, from: detailLead.leadStatus, to: "Negotiation" }); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">→ Negotiation</button>
                <button onClick={() => { setDetailLead(null); setWonModal(detailLead); setWonValue(detailLead.dealValue || 0); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">✅ Won</button>
                <button onClick={() => { setDetailLead(null); setLostModal(detailLead); }} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">❌ Lost</button>
              </div>
            </div>

            {detailLead.notes && (
              <div className="rounded-lg border border-slate-200 p-3">
                <h4 className="text-xs font-semibold text-slate-600 mb-1">📝 Notes</h4>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{detailLead.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
          <p className="text-sm text-slate-500">
            {pipelineTotals.openCount} open · {formatInr(pipelineTotals.totalOpenValue)} pipeline · {formatInr(pipelineTotals.weightedPipeline)} weighted forecast
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(["kanban", "funnel", "analytics", "velocity", "audit"] as const).map((v) => (
              <button key={v} onClick={() => setPipelineView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  pipelineView === v ? "bg-[#788023] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}>
                {v === "kanban" ? "📋 Kanban" : v === "funnel" ? "🔻 Funnel" : v === "analytics" ? "📊 Analytics" : v === "velocity" ? "⚡ Velocity" : "📋 Audit"}
              </button>
            ))}
          </div>
          <button onClick={() => { setBatchMode(!batchMode); setSelectedLeads(new Set()); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              batchMode ? "bg-[#788023] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {batchMode ? "✓ Batch Mode" : "☑️ Batch"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="text" placeholder="Search leads..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          className="w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        <select value={tempFilter} onChange={(e) => setTempFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="all">All Temps</option>
          {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="all">All Sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="all">All Assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Batch actions bar */}
      {batchMode && selectedLeads.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-[#788023]/10 px-4 py-2.5">
          <span className="text-sm font-medium text-[#788023]">{selectedLeads.size} selected</span>
          <button onClick={() => setShowBatchModal(true)} className="rounded-lg bg-[#788023] px-3 py-1 text-xs font-medium text-white hover:bg-[#646b1d]">Move Stage</button>
          <select onChange={(e) => { if (e.target.value) handleBatchTemp(e.target.value); e.target.value = ""; }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs" defaultValue="">
            <option value="" disabled>Set Temp…</option>
            {LEAD_TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) handleBatchAssign(e.target.value); e.target.value = ""; }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs" defaultValue="">
            <option value="" disabled>Assign to…</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => setSelectedLeads(new Set())} className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Clear</button>
        </div>
      )}

      {/* Views */}
      {pipelineView === "kanban" && renderKanban()}
      {pipelineView === "funnel" && renderFunnelView()}
      {pipelineView === "analytics" && renderAnalytics()}
      {pipelineView === "audit" && renderAuditLog()}

      {/* Modals */}
      {renderDetailModal()}

      {/* Transition Confirmation Modal */}
      {transitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setTransitionModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-800">Move Lead</h3>
              <p className="mt-1 text-sm text-slate-600">
                Move <span className="font-semibold">{transitionModal.lead.leadName}</span> from{" "}
                <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[transitionModal.from]}`}>{transitionModal.from}</span>{" "}
                to{" "}
                <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[transitionModal.to]}`}>{transitionModal.to}</span>
              </p>
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Reason (optional)</label>
                <textarea value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Why are you moving this lead?"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" rows={3} />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setTransitionModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => confirmTransition(transitionReason)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">Confirm Move</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Won Modal */}
      {wonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setWonModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-emerald-800">🎉 Mark as Won!</h3>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold">{wonModal.leadName}</span> from {wonModal.companyName || "N/A"}
              </p>
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Won Deal Value (₹)</label>
                <input type="number" value={wonValue} onChange={(e) => setWonValue(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setWonModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={confirmWon} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Confirm Won</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lost Modal */}
      {lostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setLostModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-rose-800">Mark as Lost</h3>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold">{lostModal.leadName}</span> from {lostModal.companyName || "N/A"}
              </p>
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600">Loss Reason</label>
                <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm">
                  <option value="">Select reason…</option>
                  <option>Budget constraints</option>
                  <option>Went with competitor</option>
                  <option>No response / ghosted</option>
                  <option>Not a good fit</option>
                  <option>Project cancelled</option>
                  <option>Timing not right</option>
                  <option>Other</option>
                </select>
                {!["Budget constraints", "Went with competitor", "No response / ghosted", "Not a good fit", "Project cancelled", "Timing not right"].includes(lostReason) && lostReason && (
                  <textarea placeholder="Describe the reason..." className="mt-2 w-full rounded-lg border border-slate-200 p-2.5 text-sm" rows={2} />
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setLostModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={confirmLost} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Confirm Lost</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Velocity Tracker */}
      {pipelineView === "analytics" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">⚡ Pipeline Velocity Analysis</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {allStages.filter((s) => s !== "Won" && s !== "Lost").map((stage) => {
              const sLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === stage);
              const avgDays = sLeads.length > 0
                ? Math.round(sLeads.reduce((sum: number, l: Lead) => sum + daysSince(l.dateAdded), 0) / sLeads.length)
                : 0;
              const avgDeal = sLeads.length > 0
                ? Math.round(sLeads.reduce((sum: number, l: Lead) => sum + (l.dealValue || 0), 0) / sLeads.length)
                : 0;
              const totalValue = sLeads.reduce((sum: number, l: Lead) => sum + (l.dealValue || 0), 0);
              const hotCount = sLeads.filter((l: Lead) => l.leadTemperature === "Hot").length;
              const conversionRate = sLeads.length > 0
                ? Math.round(((STAGE_PROBABILITY[stage] || 0) / 100) * 100)
                : 0;
              return (
                <div key={stage} className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">{stage}</span>
                    <span className="text-[10px] text-slate-400">{sLeads.length} leads</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avg Days</span>
                      <span className={`font-bold ${avgDays > 14 ? "text-rose-600" : avgDays > 7 ? "text-amber-600" : "text-emerald-600"}`}>{avgDays}d</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Avg Deal</span>
                      <span className="font-bold text-slate-700">{formatInr(avgDeal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Value</span>
                      <span className="font-bold text-[#788023]">{formatInr(totalValue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Hot Leads</span>
                      <span className="font-bold text-rose-600">{hotCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Win Prob.</span>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-12 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${conversionRate}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-slate-600">{conversionRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stage Transition Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">🔀 Stage Transition Matrix</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3 text-left font-semibold text-slate-600">From → To</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-600">Count</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-600">Avg Days</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-600">Avg Deal</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-600">Conv. Rate</th>
                    <th className="py-2 px-3 text-center font-semibold text-slate-600">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {allStages.filter((s) => s !== "Won" && s !== "Lost" && s !== "New").map((stage) => {
                    const nextIdx = allStages.indexOf(stage) + 1;
                    const nextStage = nextIdx < allStages.length ? allStages[nextIdx] : "Won";
                    const stageLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === stage);
                    const nextLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === nextStage);
                    const totalFromStage = stageLeads.length;
                    const avgDaysTransition = totalFromStage > 0
                      ? Math.round(stageLeads.reduce((s: number, l: Lead) => s + daysSince(l.dateAdded), 0) / totalFromStage)
                      : 0;
                    const avgDealTransition = totalFromStage > 0
                      ? Math.round(stageLeads.reduce((s: number, l: Lead) => s + (l.dealValue || 0), 0) / totalFromStage)
                      : 0;
                    const convRate = totalFromStage > 0 ? Math.round((nextLeads.length / (totalFromStage + nextLeads.length)) * 100) : 0;
                    return (
                      <tr key={stage} className="border-b border-slate-50">
                        <td className="py-2 px-3">
                          <span className="font-medium text-slate-700">{stage}</span>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="font-medium text-emerald-700">{nextStage}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-medium">{totalFromStage}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-medium ${avgDaysTransition > 14 ? "text-rose-600" : avgDaysTransition > 7 ? "text-amber-600" : "text-emerald-600"}`}>
                            {avgDaysTransition}d
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-medium">{formatInr(avgDealTransition)}</td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div className="h-1.5 w-10 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-[#788023]" style={{ width: `${convRate}%` }} />
                            </div>
                            <span className="text-[10px]">{convRate}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-emerald-500">↗</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pipeline Health Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">💚 Pipeline Health Summary</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{pipelineLeads.filter((l: Lead) => { const h = leadHealthScore(l); return h >= 70; }).length}</p>
                <p className="text-xs text-emerald-600">Healthy Leads (70+)</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{pipelineLeads.filter((l: Lead) => { const h = leadHealthScore(l); return h >= 40 && h < 70; }).length}</p>
                <p className="text-xs text-amber-600">At Risk (40-69)</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-center">
                <p className="text-2xl font-bold text-rose-700">{pipelineLeads.filter((l: Lead) => { const h = leadHealthScore(l); return h < 40; }).length}</p>
                <p className="text-xs text-rose-600">Critical (&lt;40)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== TAB: VELOCITY TRACKER ====== */}
      {pipelineView === "velocity" && (
        <div className="space-y-4">
          {/* Velocity KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
              <p className="text-[10px] text-sky-600">Avg Days in Pipeline</p>
              <p className="text-2xl font-bold text-sky-800">{pipelineLeads.length > 0 ? Math.round(pipelineLeads.reduce((s: number, l: Lead) => s + daysSince(l.dateAdded), 0) / pipelineLeads.length) : 0}d</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-[10px] text-emerald-600">Avg Days to Won</p>
              <p className="text-2xl font-bold text-emerald-800">{(() => {
                const wonLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === "Won");
                return wonLeads.length > 0 ? Math.round(wonLeads.reduce((s: number, l: Lead) => s + daysSince(l.dateAdded), 0) / wonLeads.length) : 0;
              })()}d</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-[10px] text-amber-600">Fastest Close</p>
              <p className="text-2xl font-bold text-amber-800">{(() => {
                const wonLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === "Won");
                return wonLeads.length > 0 ? Math.min(...wonLeads.map((l: Lead) => daysSince(l.dateAdded))) : 0;
              })()}d</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <p className="text-[10px] text-rose-600">Stale Leads (14d+)</p>
              <p className="text-2xl font-bold text-rose-800">{pipelineLeads.filter((l: Lead) => daysSince(l.dateAdded) > 14 && isOpenLeadStatus(l.leadStatus)).length}</p>
            </div>
          </div>

          {/* Stage Velocity Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Stage Velocity (Avg Days per Stage)</h3>
            <div className="space-y-3">
              {allStages.filter((s: string) => s !== "Won" && s !== "Lost").map((stage: string) => {
                const stageLeads = pipelineLeads.filter((l: Lead) => l.leadStatus === stage);
                const avgDays = stageLeads.length > 0
                  ? Math.round(stageLeads.reduce((s: number, l: Lead) => s + daysSince(l.dateAdded), 0) / stageLeads.length)
                  : 0;
                const maxDays = 30;
                const pct = Math.min(100, (avgDays / maxDays) * 100);
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{stage}</span>
                      <span className="text-slate-500">{stageLeads.length} leads · avg {avgDays}d</span>
                    </div>
                    <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-4 rounded-full transition-all duration-700 ${avgDays > 14 ? "bg-rose-500" : avgDays > 7 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Lead Flow */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Weekly Lead Flow (Last 8 Weeks)</h3>
            <div className="flex items-end gap-2 h-40">
              {(() => {
                const weeks: Array<{ label: string; added: number; won: number; lost: number }> = [];
                for (let w = 7; w >= 0; w--) {
                  const weekEnd = new Date(Date.now() - w * 7 * 86400000);
                  const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
                  const ws = weekStart.toISOString().slice(0, 10);
                  const we = weekEnd.toISOString().slice(0, 10);
                  const added = pipelineLeads.filter((l: Lead) => l.dateAdded >= ws && l.dateAdded <= we).length;
                  const won = pipelineLeads.filter((l: Lead) => l.leadStatus === "Won" && l.dateAdded >= ws && l.dateAdded <= we).length;
                  const lost = pipelineLeads.filter((l: Lead) => l.leadStatus === "Lost" && l.dateAdded >= ws && l.dateAdded <= we).length;
                  weeks.push({ label: `W${8 - w}`, added, won, lost });
                }
                const maxVal = Math.max(1, ...weeks.map((w) => w.added));
                return weeks.map((week) => (
                  <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-28 w-full">
                      <div className="flex-1 rounded-t bg-sky-400 transition-all duration-500" style={{ height: `${(week.added / maxVal) * 100}%`, minHeight: week.added > 0 ? "4px" : "0" }} />
                      <div className="flex-1 rounded-t bg-emerald-400 transition-all duration-500" style={{ height: `${(week.won / maxVal) * 100}%`, minHeight: week.won > 0 ? "4px" : "0" }} />
                      <div className="flex-1 rounded-t bg-rose-400 transition-all duration-500" style={{ height: `${(week.lost / maxVal) * 100}%`, minHeight: week.lost > 0 ? "4px" : "0" }} />
                    </div>
                    <span className="text-[9px] text-slate-500">{week.label}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[9px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-sky-400" /> Added</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Won</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-400" /> Lost</span>
            </div>
          </div>

          {/* Deal Size Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Deal Size Distribution</h3>
            <div className="space-y-2">
              {[
                { label: "Micro (<₹10K)", min: 0, max: 10000, color: "bg-slate-400" },
                { label: "Small (₹10K-50K)", min: 10000, max: 50000, color: "bg-sky-400" },
                { label: "Medium (₹50K-1L)", min: 50000, max: 100000, color: "bg-emerald-400" },
                { label: "Large (₹1L-5L)", min: 100000, max: 500000, color: "bg-amber-400" },
                { label: "Enterprise (₹5L+)", min: 500000, max: Infinity, color: "bg-violet-400" },
              ].map((bucket) => {
                const count = pipelineLeads.filter((l: Lead) => l.dealValue >= bucket.min && l.dealValue < bucket.max).length;
                const value = pipelineLeads.filter((l: Lead) => l.dealValue >= bucket.min && l.dealValue < bucket.max).reduce((s: number, l: Lead) => s + l.dealValue, 0);
                const maxCount = Math.max(1, ...[0, 10000, 50000, 100000, 500000].map((min, i) => {
                  const max = [10000, 50000, 100000, 500000, Infinity][i];
                  return pipelineLeads.filter((l: Lead) => l.dealValue >= min && l.dealValue < max).length;
                }));
                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="w-32 text-xs text-slate-700 shrink-0">{bucket.label}</span>
                    <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-4 rounded-full ${bucket.color} transition-all duration-500`}
                        style={{ width: `${Math.max(2, (count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="w-20 text-right text-[10px] text-slate-500 shrink-0">{count} · {formatInr(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stale Leads Alert */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-base font-semibold text-amber-800 mb-3">⚠️ Stale Leads Alert</h3>
            {(() => {
              const staleLeads = pipelineLeads
                .filter((l: Lead) => isOpenLeadStatus(l.leadStatus) && daysSince(l.dateAdded) > 14)
                .sort((a: Lead, b: Lead) => daysSince(b.dateAdded) - daysSince(a.dateAdded))
                .slice(0, 10);
              return staleLeads.length === 0 ? (
                <p className="text-sm text-amber-600">No stale leads — all leads have recent activity! 🎉</p>
              ) : (
                <div className="space-y-2">
                  {staleLeads.map((lead: Lead) => (
                    <div key={lead.id} className="flex items-center gap-3 rounded-lg bg-white p-2 border border-amber-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{lead.leadName}</p>
                        <p className="text-[10px] text-slate-500">{lead.companyName} · {lead.leadSource} · {lead.leadStatus}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-600">{daysSince(lead.dateAdded)}d old</p>
                        <p className="text-[9px] text-slate-400">{formatInr(lead.dealValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Batch Move Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowBatchModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-800">Batch Move {selectedLeads.size} Leads</h3>
              <div className="mt-3 space-y-1.5">
                {allStages.map((stage) => (
                  <button key={stage} onClick={() => setBatchTarget(stage)}
                    className={`w-full rounded-lg border p-2.5 text-left text-sm transition-colors ${
                      batchTarget === stage ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-200 hover:bg-slate-50"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_COLORS[stage]?.replace("border-t-", "bg-").replace("-400", "-400") || "bg-slate-400"}`} />
                      <span className="font-medium">{stage}</span>
                      <span className="ml-auto text-xs text-slate-400">{stageStats.get(stage)?.count || 0} leads</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowBatchModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleBatchMove} disabled={!batchTarget} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d] disabled:opacity-40">Move to {batchTarget || "..."}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
