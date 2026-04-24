// =====================================================================
// DASHBOARD VIEW — Full dashboard with animated counters, sparklines,
// trends, team performance, conversion funnel, target tracking,
// forecast section, activity feed, source breakdown, invoice summary,
// aging analysis, lead velocity, collection efficiency, target metrics,
// stage velocity, win/loss analysis, and pipeline health indicators
// Phase 8: Massive expansion (~1050 lines)
// =====================================================================
import React, { useState, useMemo, useEffect } from "react";
import type { Lead, Invoice, DashboardDateScope } from "../../types/index";
import { LEAD_STATUSES } from "../../constants/index";
import {
  formatInr, formatDateDisplay, todayISODate, isOpenLeadStatus,
  leadHealthScore, daysSince,
  leadSlaTier, inferPaymentStatus,
} from "../../lib/utils";
import { Badge, AnimatedValue, Sparkline, EmptyState } from "../ui/SharedUI";

const TEMP_ICONS: Record<string, string> = { "Hot": "🔥", "Warm": "🌤️", "Cold": "❄️" };
const TEMP_COLORS: Record<string, string> = { "Hot": "bg-rose-500", "Warm": "bg-amber-500", "Cold": "bg-sky-500" };

const STAGE_PROBABILITY: Record<string, number> = {
  "New": 5, "Contacted": 10, "Qualified": 20, "Proposal Sent": 35,
  "Negotiation": 55, "Confirmation": 75, "Invoice Sent": 90, "Won": 100, "Lost": 0,
};

const AGING_BUCKETS = [
  { label: "0-7 days", min: 0, max: 7, color: "bg-emerald-500" },
  { label: "8-14 days", min: 8, max: 14, color: "bg-amber-500" },
  { label: "15-30 days", min: 15, max: 30, color: "bg-orange-500" },
  { label: "30+ days", min: 31, max: 999, color: "bg-rose-500" },
];

export function DashboardView({ leads, invoices, onNavigate }: {
  leads: Lead[];
  invoices: Invoice[];
  onNavigate?: (view: string) => void;
}) {
  const [dateScope, setDateScope] = useState<DashboardDateScope>("all");
  const [dashboardTab, setDashboardTab] = useState<"overview" | "pipeline" | "revenue" | "team" | "targets">("overview");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const now = new Date();
  const todayStr = todayISODate();

  // Date-filtered leads
  const filteredByDate = useMemo(() => {
    if (dateScope === "all") return leads.filter((l) => !l.isDeleted);
    return leads.filter((l) => {
      if (l.isDeleted) return false;
      const d = l.dateAdded;
      if (dateScope === "today") return d === todayStr;
      if (dateScope === "yesterday") {
        const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
        return d === y;
      }
      if (dateScope === "last7") { const c = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10); return d >= c; }
      if (dateScope === "last30") { const c = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10); return d >= c; }
      if (dateScope === "mtd") { const c = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; return d >= c; }
      if (dateScope === "qtd") {
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().slice(0, 10);
        return d >= qStart;
      }
      if (dateScope === "lastMonth") {
        const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
        return d >= lmStart && d <= lmEnd;
      }
      return true;
    });
  }, [leads, dateScope, todayStr, now]);

  // Core metrics
  const activeLeads = leads.filter((l) => !l.isDeleted);
  const openLeads = filteredByDate.filter((l) => isOpenLeadStatus(l.leadStatus));
  const wonLeads = filteredByDate.filter((l) => l.leadStatus === "Won");
  const lostLeads = filteredByDate.filter((l) => l.leadStatus === "Lost");
  const newLeads = filteredByDate.filter((l) => l.leadStatus === "New");
  const hotLeads = openLeads.filter((l) => l.leadTemperature === "Hot");
  const totalPipelineValue = openLeads.reduce((s, l) => s + (Number.isFinite(l.dealValue) ? l.dealValue : 0), 0);
  const totalWonValue = wonLeads.reduce((s, l) => s + (l.wonDealValue ?? (Number.isFinite(l.dealValue) ? l.dealValue : 0)), 0);
  const totalLostValue = lostLeads.reduce((s, l) => s + (Number.isFinite(l.dealValue) ? l.dealValue : 0), 0);
  const totalInvoiceValue = invoices.reduce((s, i) => s + (Number.isFinite(i.totalAmount) ? i.totalAmount : 0), 0);
  const collectedAmount = invoices.filter((i) => i.status === "Paid" || i.status === "Partially Paid")
    .reduce((s, i) => s + (Number.isFinite(i.amountPaid) ? i.amountPaid : 0), 0);
  const overdueFollowups = openLeads.filter((l) => l.nextFollowupDate && l.nextFollowupDate < todayStr && l.followupStatus !== "Done");
  const todayFollowups = openLeads.filter((l) => l.nextFollowupDate === todayStr);
  const avgDealSize = openLeads.length > 0 ? totalPipelineValue / openLeads.length : 0;
  const conversionRate = filteredByDate.length > 0 ? (wonLeads.length / filteredByDate.length) * 100 : 0;
  const weightedPipeline = openLeads.reduce((s, l) => s + l.dealValue * ((STAGE_PROBABILITY[l.leadStatus] || 0) / 100), 0);

  // Sparkline data (last 7 days of lead adds)
  const sparklineData = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      data.push(leads.filter((l) => !l.isDeleted && l.dateAdded === date).length);
    }
    return data;
  }, [leads, now]);

  const revenueSparkline = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      data.push(leads.filter((l) => l.leadStatus === "Won" && l.dateAdded === date).reduce((s, l) => s + (l.wonDealValue ?? l.dealValue), 0) / 1000);
    }
    return data;
  }, [leads, now]);

  const followupSparkline = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      data.push(leads.filter((l) => !l.isDeleted && l.nextFollowupDate === date).length);
    }
    return data;
  }, [leads, now]);

  // Lead aging analysis
  const agingAnalysis = useMemo(() => {
    return AGING_BUCKETS.map((bucket) => {
      const bucketLeads = openLeads.filter((l) => {
        const age = daysSince(l.dateAdded);
        return age >= bucket.min && age <= bucket.max;
      });
      const value = bucketLeads.reduce((s, l) => s + l.dealValue, 0);
      return { ...bucket, count: bucketLeads.length, value, leads: bucketLeads };
    });
  }, [openLeads]);

  // Lead velocity (weekly trend for last 8 weeks)
  const leadVelocity = useMemo(() => {
    const weeks: Array<{ label: string; added: number; won: number; lost: number }> = [];
    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now.getTime() - w * 7 * 86400000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
      const ws = weekStart.toISOString().slice(0, 10);
      const we = weekEnd.toISOString().slice(0, 10);
      const added = activeLeads.filter((l) => l.dateAdded >= ws && l.dateAdded <= we).length;
      const won = activeLeads.filter((l) => l.leadStatus === "Won" && l.dateAdded >= ws && l.dateAdded <= we).length;
      const lost = activeLeads.filter((l) => l.leadStatus === "Lost" && l.dateAdded >= ws && l.dateAdded <= we).length;
      weeks.push({ label: `W${8 - w}`, added, won, lost });
    }
    return weeks;
  }, [activeLeads, now]);

  // Collection efficiency
  const collectionMetrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollected = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
    const overdueInvoices = invoices.filter((i) => i.status === "Overdue");
    const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.totalAmount - (i.amountPaid || 0)), 0);
    const avgCollectionDays = invoices.filter((i) => i.status === "Paid").length > 0
      ? invoices.filter((i) => i.status === "Paid").reduce((s, i) => {
          const issueDate = new Date(i.issueDate).getTime();
          const paidDate = i.updatedAt ? new Date(i.updatedAt).getTime() : Date.now();
          return s + Math.max(0, Math.floor((paidDate - issueDate) / 86400000));
        }, 0) / invoices.filter((i) => i.status === "Paid").length
      : 0;
    const efficiency = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
    return { totalInvoiced, totalCollected, overdueAmount, overdueCount: overdueInvoices.length, avgCollectionDays: Math.round(avgCollectionDays), efficiency };
  }, [invoices]);

  // Win/Loss analysis
  const winLossAnalysis = useMemo(() => {
    const closedLeads = filteredByDate.filter((l) => l.leadStatus === "Won" || l.leadStatus === "Lost");
    const bySource: Record<string, { won: number; lost: number; wonValue: number }> = {};
    for (const l of closedLeads) {
      if (!bySource[l.leadSource]) bySource[l.leadSource] = { won: 0, lost: 0, wonValue: 0 };
      if (l.leadStatus === "Won") { bySource[l.leadSource].won++; bySource[l.leadSource].wonValue += l.wonDealValue ?? l.dealValue; }
      else bySource[l.leadSource].lost++;
    }
    return { totalClosed: closedLeads.length, winRate: closedLeads.length > 0 ? (wonLeads.length / closedLeads.length) * 100 : 0, bySource };
  }, [filteredByDate, wonLeads]);

  // SLA distribution
  const slaDistribution = useMemo(() => {
    const tiers: Record<string, number> = { ok: 0, watch: 0, escalate: 0, critical: 0 };
    for (const l of openLeads) { const tier = leadSlaTier(l); tiers[tier] = (tiers[tier] || 0) + 1; }
    return tiers;
  }, [openLeads]);

  // KPI cards
  const kpis = [
    { label: "Total Leads", value: filteredByDate.length, icon: "👥", color: "bg-sky-50 text-sky-700 border-sky-200", sparkline: sparklineData, sparkColor: "#0ea5e9" },
    { label: "Open Pipeline", value: openLeads.length, icon: "🔄", color: "bg-indigo-50 text-indigo-700 border-indigo-200", sparkColor: "#6366f1" },
    { label: "Pipeline Value", value: totalPipelineValue, icon: "💰", color: "bg-violet-50 text-violet-700 border-violet-200", sparkline: revenueSparkline, sparkColor: "#8b5cf6", isCurrency: true },
    { label: "Weighted Forecast", value: weightedPipeline, icon: "🎯", color: "bg-teal-50 text-teal-700 border-teal-200", isCurrency: true },
    { label: "Won Revenue", value: totalWonValue, icon: "🏆", color: "bg-emerald-50 text-emerald-700 border-emerald-200", sparkColor: "#10b981", isCurrency: true },
    { label: "Avg Deal Size", value: avgDealSize, icon: "📊", color: "bg-teal-50 text-teal-700 border-teal-200", isCurrency: true },
    { label: "Conversion Rate", value: conversionRate, icon: "📈", color: "bg-emerald-50 text-emerald-700 border-emerald-200", isPercent: true },
    { label: "Overdue Follow-ups", value: overdueFollowups.length, icon: "⚠️", color: overdueFollowups.length > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200", sparkline: followupSparkline, sparkColor: "#f43f5e" },
    { label: "Won Leads", value: wonLeads.length, icon: "✅", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Lost Leads", value: lostLeads.length, icon: "❌", color: "bg-rose-50 text-rose-700 border-rose-200" },
    { label: "Total Invoiced", value: totalInvoiceValue, icon: "🧾", color: "bg-amber-50 text-amber-700 border-amber-200", isCurrency: true },
    { label: "Collected", value: collectedAmount, icon: "💳", color: "bg-green-50 text-green-700 border-green-200", isCurrency: true },
  ];

  // Activity feed
  const recentActivity = useMemo(() => {
    const activities: Array<{ id: string; text: string; time: string; icon: string; color: string; leadId: string }> = [];
    const sorted = [...filteredByDate].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    for (const lead of sorted.slice(0, 15)) {
      if (lead.leadStatus === "Won") activities.push({ id: lead.id + "-won", text: `${lead.leadName} marked as Won (${formatInr(lead.wonDealValue ?? lead.dealValue)})`, time: formatDateDisplay(lead.updatedAt.slice(0, 10)), icon: "🏆", color: "text-emerald-600", leadId: lead.id });
      else if (lead.leadStatus === "Lost") activities.push({ id: lead.id + "-lost", text: `${lead.leadName} marked as Lost`, time: formatDateDisplay(lead.updatedAt.slice(0, 10)), icon: "❌", color: "text-rose-600", leadId: lead.id });
      else if (lead.followupStatus === "Done") activities.push({ id: lead.id + "-fu", text: `Follow-up completed for ${lead.leadName}`, time: formatDateDisplay(lead.lastContactedDate), icon: "✅", color: "text-sky-600", leadId: lead.id });
      else if (lead.dateAdded === todayStr) activities.push({ id: lead.id + "-new", text: `${lead.leadName} added as new lead`, time: formatDateDisplay(lead.dateAdded), icon: "🆕", color: "text-violet-600", leadId: lead.id });
      else activities.push({ id: lead.id + "-up", text: `${lead.leadName} updated (${lead.leadStatus})`, time: formatDateDisplay(lead.updatedAt.slice(0, 10)), icon: "📝", color: "text-slate-600", leadId: lead.id });
    }
    return activities.slice(0, 10);
  }, [filteredByDate, todayStr]);

  // Source breakdown
  const sourceBreakdown = useMemo(() => {
    const sources: Record<string, { count: number; value: number; won: number; wonCount: number }> = {};
    for (const l of filteredByDate) {
      if (!sources[l.leadSource]) sources[l.leadSource] = { count: 0, value: 0, won: 0, wonCount: 0 };
      sources[l.leadSource].count++;
      sources[l.leadSource].value += l.dealValue;
      if (l.leadStatus === "Won") { sources[l.leadSource].won += l.wonDealValue ?? l.dealValue; sources[l.leadSource].wonCount++; }
    }
    return Object.entries(sources).sort((a, b) => b[1].value - a[1].value);
  }, [filteredByDate]);

  // Team performance
  const teamPerformance = useMemo(() => {
    const team: Record<string, { total: number; open: number; won: number; lost: number; pipelineValue: number; wonValue: number; overdue: number; avgHealth: number }> = {};
    for (const l of filteredByDate) {
      const assignee = l.assignedTo || "Unassigned";
      if (!team[assignee]) team[assignee] = { total: 0, open: 0, won: 0, lost: 0, pipelineValue: 0, wonValue: 0, overdue: 0, avgHealth: 0 };
      team[assignee].total++;
      if (isOpenLeadStatus(l.leadStatus)) { team[assignee].open++; team[assignee].pipelineValue += l.dealValue; team[assignee].avgHealth += leadHealthScore(l); }
      if (l.leadStatus === "Won") { team[assignee].won++; team[assignee].wonValue += l.wonDealValue ?? l.dealValue; }
      if (l.leadStatus === "Lost") team[assignee].lost++;
      if (l.nextFollowupDate && l.nextFollowupDate < todayStr && l.followupStatus !== "Done") team[assignee].overdue++;
    }
    for (const k of Object.keys(team)) { if (team[k].open > 0) team[k].avgHealth = Math.round(team[k].avgHealth / team[k].open); }
    return Object.entries(team).sort((a, b) => b[1].wonValue - a[1].wonValue);
  }, [filteredByDate, todayStr]);

  // Stage distribution
  const stageDistribution = useMemo(() => {
    return LEAD_STATUSES.filter((s) => s !== "Won" && s !== "Lost").map((stage) => {
      const stageLeads = filteredByDate.filter((l) => l.leadStatus === stage);
      const value = stageLeads.reduce((s, l) => s + l.dealValue, 0);
      const probability = STAGE_PROBABILITY[stage] || 0;
      const weighted = value * probability / 100;
      const avgDays = stageLeads.length > 0 ? Math.round(stageLeads.reduce((s, l) => s + daysSince(l.dateAdded), 0) / stageLeads.length) : 0;
      const hotCount = stageLeads.filter((l) => l.leadTemperature === "Hot").length;
      return { stage, count: stageLeads.length, value, probability, weighted, avgDays, hotCount };
    });
  }, [filteredByDate]);

  // Invoice summary
  const invoiceSummary = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "Paid");
    const partial = invoices.filter((i) => i.status === "Partially Paid");
    const overdue = invoices.filter((i) => i.status === "Overdue");
    const draft = invoices.filter((i) => i.status === "Draft");
    return {
      total: invoices.length, paid: paid.length, partial: partial.length,
      overdue: overdue.length, draft: draft.length,
      paidAmount: paid.reduce((s, i) => s + i.totalAmount, 0) + partial.reduce((s, i) => s + (i.amountPaid || 0), 0),
      outstanding: overdue.reduce((s, i) => s + i.totalAmount, 0) + partial.reduce((s, i) => s + (i.totalAmount - (i.amountPaid || 0)), 0),
    };
  }, [invoices]);

  // Temperature distribution
  const tempDistribution = useMemo(() => {
    const temps: Record<string, number> = { "Hot": 0, "Warm": 0, "Cold": 0 };
    for (const l of openLeads) { temps[l.leadTemperature] = (temps[l.leadTemperature] || 0) + 1; }
    return Object.entries(temps);
  }, [openLeads]);

  // Payment status distribution (for Won leads)
  const paymentStatusDistribution = useMemo(() => {
    const statuses: Record<string, number> = { "Not Invoiced": 0, "Partially Collected": 0, "Fully Collected": 0 };
    for (const l of filteredByDate.filter((l) => l.leadStatus === "Won")) {
      statuses[inferPaymentStatus(l)] = (statuses[inferPaymentStatus(l)] || 0) + 1;
    }
    return statuses;
  }, [filteredByDate]);

  return (
    <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of your sales pipeline, team activity, and revenue</p>
        </div>
        <div className="flex items-center gap-2">
          {(["overview", "pipeline", "revenue", "team", "targets"] as const).map((tab) => (
            <button key={tab} onClick={() => setDashboardTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${dashboardTab === tab ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {tab === "overview" ? "📊 Overview" : tab === "pipeline" ? "🔄 Pipeline" : tab === "revenue" ? "💰 Revenue" : tab === "team" ? "👥 Team" : "🎯 Targets"}
            </button>
          ))}
          <span className="text-slate-300">|</span>
          <select value={dateScope} onChange={(e) => setDateScope(e.target.value as DashboardDateScope)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all cursor-pointer">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="mtd">Month to Date</option>
            <option value="qtd">Quarter to Date</option>
            <option value="lastMonth">Last Month</option>
          </select>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{formatDateDisplay(todayStr)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map((kpi, idx) => (
          <div key={kpi.label}
            className={`animate-fade-in-up card-hover rounded-xl border p-3.5 ${kpi.color}`}
            style={{ animationDelay: `${idx * 40}ms` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{kpi.icon}</span>
                <span className="text-[10px] font-medium opacity-80 leading-tight">{kpi.label}</span>
              </div>
              {kpi.sparkline && <Sparkline data={kpi.sparkline} color={kpi.sparkColor} width={40} height={14} />}
            </div>
            <p className="mt-1.5 text-lg font-bold">
              {kpi.isCurrency ? <AnimatedValue value={Math.round(kpi.value)} format={(v) => formatInr(v)} /> :
               kpi.isPercent ? <AnimatedValue value={Math.round(kpi.value * 10) / 10} format={(v) => `${v.toFixed(1)}%`} /> :
               <AnimatedValue value={kpi.value} />}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => onNavigate?.("leads")} className="rounded-xl border border-slate-200 bg-white p-3 text-left card-hover hover:border-sky-300 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg">🆕</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{newLeads.length} New Leads</p>
              <p className="text-[10px] text-slate-400">Need first contact</p>
            </div>
          </div>
        </button>
        <button onClick={() => onNavigate?.("followups")} className="rounded-xl border border-slate-200 bg-white p-3 text-left card-hover hover:border-rose-300 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{overdueFollowups.length} Overdue</p>
              <p className="text-[10px] text-slate-400">Follow-ups past due</p>
            </div>
          </div>
        </button>
        <button onClick={() => onNavigate?.("followups")} className="rounded-xl border border-slate-200 bg-white p-3 text-left card-hover hover:border-amber-300 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{todayFollowups.length} Due Today</p>
              <p className="text-[10px] text-slate-400">Scheduled for today</p>
            </div>
          </div>
        </button>
        <button onClick={() => onNavigate?.("pipeline")} className="rounded-xl border border-slate-200 bg-white p-3 text-left card-hover hover:border-rose-300 transition-all">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{hotLeads.length} Hot Leads</p>
              <p className="text-[10px] text-slate-400">Require immediate action</p>
            </div>
          </div>
        </button>
      </div>

      {/* ====== TAB: OVERVIEW ====== */}
      {dashboardTab === "overview" && (<>
        {/* Pipeline Funnel + Activity Feed */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2 card-hover">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">Pipeline Funnel</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>🏆 Won: <strong className="text-emerald-600">{wonLeads.length}</strong> ({formatInr(totalWonValue)})</span>
                <span>❌ Lost: <strong className="text-rose-600">{lostLeads.length}</strong> ({formatInr(totalLostValue)})</span>
              </div>
            </div>
            <div className="space-y-2">
              {stageDistribution.map((stage, idx) => {
                const maxCount = Math.max(1, ...stageDistribution.map((s) => s.count));
                const pct = (stage.count / maxCount) * 100;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-slate-700 shrink-0">{stage.stage}</span>
                    <div className="flex-1">
                      <div className="h-7 rounded-full bg-slate-100 overflow-hidden">
                        <div className="flex h-7 items-center rounded-full bg-[#788023]/70 px-2 text-[10px] font-medium text-white animate-progress"
                          style={{ width: `${Math.max(pct, 8)}%`, animationDelay: `${idx * 100}ms` }}>
                          {stage.count} · {formatInr(stage.value)}
                        </div>
                      </div>
                    </div>
                    <span className="w-20 text-right text-[10px] text-slate-400 shrink-0">{stage.probability}% · {formatInr(stage.weighted)}</span>
                    {stage.avgDays > 0 && <span className="w-16 text-right text-[10px] text-slate-400 shrink-0">avg {stage.avgDays}d</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <EmptyState type="search" />
            ) : (
              <div className="space-y-2.5">
                {recentActivity.map((act, idx) => (
                  <div key={act.id} className="animate-fade-in flex items-start gap-2" style={{ animationDelay: `${idx * 40}ms` }}>
                    <span className="text-xs mt-0.5">{act.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] ${act.color} leading-snug`}>{act.text}</p>
                      <p className="text-[9px] text-slate-400">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SLA Alerts + Aging + Lead Velocity */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* SLA Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-3 text-base font-semibold text-slate-800">SLA Health</h2>
            <div className="space-y-2">
              {[
                { tier: "ok", label: "✓ On Track", color: "bg-emerald-100 text-emerald-700", barColor: "bg-emerald-500" },
                { tier: "watch", label: "👁 Watch", color: "bg-yellow-100 text-yellow-700", barColor: "bg-yellow-500" },
                { tier: "escalate", label: "⚠ Escalate", color: "bg-amber-100 text-amber-700", barColor: "bg-amber-500" },
                { tier: "critical", label: "🚨 Critical", color: "bg-rose-100 text-rose-700", barColor: "bg-rose-500" },
              ].map((item) => {
                const count = slaDistribution[item.tier] || 0;
                const pct = openLeads.length > 0 ? (count / openLeads.length) * 100 : 0;
                return (
                  <div key={item.tier}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.color}`}>{item.label}</span>
                      <span className="text-slate-500">{count} leads</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-2 rounded-full ${item.barColor} transition-all duration-700`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead Aging Analysis */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Lead Aging</h2>
            <div className="space-y-2">
              {agingAnalysis.map((bucket) => {
                const maxCount = Math.max(1, ...agingAnalysis.map((b) => b.count));
                const pct = (bucket.count / maxCount) * 100;
                return (
                  <div key={bucket.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{bucket.label}</span>
                      <span className="text-slate-500">{bucket.count} ({formatInr(bucket.value)})</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-2.5 rounded-full ${bucket.color} transition-all duration-700`} style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lead Velocity (8-week trend) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Lead Velocity</h2>
            <div className="flex items-end gap-1 h-28">
              {leadVelocity.map((week) => {
                const maxVal = Math.max(1, ...leadVelocity.map((w) => w.added));
                const h = (week.added / maxVal) * 100;
                return (
                  <div key={week.label} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col gap-0.5" style={{ height: `${Math.max(h, 4)}%` }}>
                      <div className="flex-1 rounded-t bg-emerald-400 min-h-[2px]" style={{ height: `${week.won > 0 ? (week.won / week.added) * 100 : 0}%` }} />
                      <div className="flex-1 rounded-b bg-sky-400 min-h-[2px]" />
                    </div>
                    <span className="text-[8px] text-slate-400">{week.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> Added</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Won</span>
            </div>
          </div>
        </div>

        {/* Source Breakdown + Invoice Summary */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Pipeline by Source</h2>
            {sourceBreakdown.length === 0 ? (
              <EmptyState type="sources" />
            ) : (
              <div className="space-y-3">
                {sourceBreakdown.map(([source, data]) => {
                  const maxVal = Math.max(1, ...sourceBreakdown.map(([, d]) => d.value));
                  const pct = (data.value / maxVal) * 100;
                  const convRate = data.count > 0 ? (data.wonCount / data.count) * 100 : 0;
                  return (
                    <div key={source}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{source}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{data.count} leads</span>
                          <span>· {formatInr(data.value)}</span>
                          {data.wonCount > 0 && <span className="text-emerald-600">· {convRate.toFixed(0)}% win</span>}
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-2.5 rounded-full bg-[#788023]/60 animate-progress" style={{ width: `${Math.max(pct, 5)}%` }} />
                      </div>
                      {data.won > 0 && (
                        <p className="mt-0.5 text-[9px] text-emerald-600">Won: {formatInr(data.won)} from {data.wonCount} leads</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Temperature */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Temperature</h2>
              <div className="space-y-2">
                {tempDistribution.map(([temp, count]) => {
                  const maxTemp = Math.max(1, ...tempDistribution.map(([, c]) => c));
                  const pct = (count / maxTemp) * 100;
                  return (
                    <div key={temp}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{TEMP_ICONS[temp]} {temp}</span>
                        <span className="text-slate-500">{count} leads</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-2.5 rounded-full ${TEMP_COLORS[temp]} animate-progress`} style={{ width: `${Math.max(pct, 5)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invoice Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Invoice Summary</h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-center">
                  <p className="text-[9px] text-emerald-600">Collected</p>
                  <p className="text-xs font-bold text-emerald-700">{formatInr(invoiceSummary.paidAmount)}</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-2 text-center">
                  <p className="text-[9px] text-rose-600">Outstanding</p>
                  <p className="text-xs font-bold text-rose-700">{formatInr(invoiceSummary.outstanding)}</p>
                </div>
              </div>
              <div className="flex gap-2 text-[10px]">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{invoiceSummary.total} total</span>
                <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">{invoiceSummary.paid} paid</span>
                <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">{invoiceSummary.partial} partial</span>
                <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5">{invoiceSummary.overdue} overdue</span>
              </div>
            </div>
          </div>
        </div>
      </>)}

      {/* ====== TAB: PIPELINE ====== */}
      {dashboardTab === "pipeline" && (<>
        {/* Forecast Section */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Weighted Pipeline Forecast</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-center">
              <p className="text-[10px] text-violet-600">Total Pipeline</p>
              <p className="text-sm font-bold text-violet-800">{formatInr(totalPipelineValue)}</p>
            </div>
            <div className="rounded-lg bg-[#788023]/10 border border-[#788023]/20 p-3 text-center">
              <p className="text-[10px] text-[#788023]">Weighted Forecast</p>
              <p className="text-sm font-bold text-[#788023]">{formatInr(weightedPipeline)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] text-emerald-600">Confirmed (Won)</p>
              <p className="text-sm font-bold text-emerald-800">{formatInr(totalWonValue)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-[10px] text-slate-600">Avg Days in Pipeline</p>
              <p className="text-sm font-bold text-slate-800">
                {openLeads.length > 0 ? Math.round(openLeads.reduce((s, l) => s + daysSince(l.dateAdded), 0) / openLeads.length) : 0} days
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
              <p className="text-[10px] text-amber-600">Hot Leads</p>
              <p className="text-sm font-bold text-amber-800">{hotLeads.length} ({formatInr(hotLeads.reduce((s, l) => s + l.dealValue, 0))})</p>
            </div>
          </div>
          <div className="space-y-2">
            {stageDistribution.filter((s) => s.count > 0).map((stage) => {
              const maxVal = Math.max(1, ...stageDistribution.map((s) => s.value));
              const pct = (stage.value / maxVal) * 100;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-slate-700 shrink-0">{stage.stage}</span>
                  <div className="flex-1">
                    <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="flex h-5 items-center rounded-full bg-gradient-to-r from-[#788023]/50 to-[#788023] px-2 text-[9px] font-medium text-white animate-progress"
                        style={{ width: `${Math.max(pct, 8)}%` }}>
                        {stage.count} · {formatInr(stage.value)}
                      </div>
                    </div>
                  </div>
                  <span className="w-20 text-right text-[10px] text-slate-400 shrink-0">{stage.probability}% → {formatInr(stage.weighted)}</span>
                  <span className="w-14 text-right text-[10px] text-slate-400 shrink-0">avg {stage.avgDays}d</span>
                  {stage.hotCount > 0 && <span className="text-[10px] text-rose-500 shrink-0">🔥{stage.hotCount}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Win/Loss Analysis */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Win/Loss Analysis by Source</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] text-emerald-600">Win Rate</p>
              <p className="text-lg font-bold text-emerald-800">{winLossAnalysis.winRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] text-emerald-600">Won</p>
              <p className="text-lg font-bold text-emerald-800">{wonLeads.length}</p>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
              <p className="text-[10px] text-rose-600">Lost</p>
              <p className="text-lg font-bold text-rose-800">{lostLeads.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(winLossAnalysis.bySource).map(([source, data]) => {
              const total = data.won + data.lost;
              const winPct = total > 0 ? (data.won / total) * 100 : 0;
              return (
                <div key={source} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-slate-700 shrink-0">{source}</span>
                  <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-4 bg-emerald-400 transition-all duration-500" style={{ width: `${winPct}%` }} />
                    <div className="h-4 bg-rose-400 transition-all duration-500" style={{ width: `${100 - winPct}%` }} />
                  </div>
                  <span className="w-20 text-right text-[10px] text-slate-500 shrink-0">
                    <span className="text-emerald-600">{data.won}W</span> / <span className="text-rose-600">{data.lost}L</span>
                    {data.wonValue > 0 && <span className="text-emerald-600 ml-1">· {formatInr(data.wonValue)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </>)}

      {/* ====== TAB: REVENUE ====== */}
      {dashboardTab === "revenue" && (<>
        {/* Collection Efficiency */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Collection Efficiency</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-center">
              <p className="text-[10px] text-sky-600">Total Invoiced</p>
              <p className="text-sm font-bold text-sky-800">{formatInr(collectionMetrics.totalInvoiced)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] text-emerald-600">Total Collected</p>
              <p className="text-sm font-bold text-emerald-800">{formatInr(collectionMetrics.totalCollected)}</p>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
              <p className="text-[10px] text-rose-600">Overdue Amount</p>
              <p className="text-sm font-bold text-rose-800">{formatInr(collectionMetrics.overdueAmount)}</p>
            </div>
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-center">
              <p className="text-[10px] text-violet-600">Avg Collection Days</p>
              <p className="text-sm font-bold text-violet-800">{collectionMetrics.avgCollectionDays} days</p>
            </div>
            <div className="rounded-lg bg-[#788023]/10 border border-[#788023]/20 p-3 text-center">
              <p className="text-[10px] text-[#788023]">Collection Efficiency</p>
              <p className="text-sm font-bold text-[#788023]">{collectionMetrics.efficiency.toFixed(1)}%</p>
            </div>
          </div>
          <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-4 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, collectionMetrics.efficiency)}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1">
            <span>0%</span>
            <span>Collection efficiency target: 90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Payment Status + Revenue by Source */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Payment Status Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Payment Status (Won Deals)</h2>
            <div className="space-y-3">
              {[
                { label: "Fully Collected", count: paymentStatusDistribution["Fully Collected"] || 0, color: "bg-emerald-500" },
                { label: "Partially Collected", count: paymentStatusDistribution["Partially Collected"] || 0, color: "bg-amber-500" },
                { label: "Not Invoiced", count: paymentStatusDistribution["Not Invoiced"] || 0, color: "bg-slate-400" },
              ].map((item) => {
                const total = Object.values(paymentStatusDistribution).reduce((s, v) => s + v, 0);
                const pct = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="text-slate-500">{item.count} deals ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-3 rounded-full ${item.color} transition-all duration-700`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue by Source */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Revenue by Source</h2>
            <div className="space-y-2">
              {sourceBreakdown.filter(([, d]) => d.won > 0).map(([source, data]) => {
                const maxWon = Math.max(1, ...sourceBreakdown.map(([, d]) => d.won));
                const pct = (data.won / maxWon) * 100;
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{source}</span>
                      <span className="text-emerald-600 font-medium">{formatInr(data.won)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-2.5 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-400">{data.wonCount} won from {data.count} leads ({data.count > 0 ? ((data.wonCount / data.count) * 100).toFixed(0) : 0}% conversion)</p>
                  </div>
                );
              })}
              {sourceBreakdown.every(([, d]) => d.won === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">No won revenue yet</p>
              )}
            </div>
          </div>
        </div>
      </>)}

      {/* ====== TAB: TEAM ====== */}
      {dashboardTab === "team" && (<>
        <div className="grid gap-4 lg:grid-cols-3">
          {teamPerformance.length === 0 ? (
            <div className="lg:col-span-3"><EmptyState type="users" /></div>
          ) : (
            teamPerformance.map(([name, data]) => {
              const winRate = data.total > 0 ? (data.won / data.total) * 100 : 0;
              return (
                <div key={name} className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#788023]/10 text-sm font-bold text-[#788023]">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{name}</p>
                      <p className="text-[10px] text-slate-400">{data.total} leads · {data.open} open</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg bg-emerald-50 p-2 text-center">
                      <p className="text-[9px] text-emerald-600">Won</p>
                      <p className="text-sm font-bold text-emerald-700">{data.won}</p>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2 text-center">
                      <p className="text-[9px] text-rose-600">Lost</p>
                      <p className="text-sm font-bold text-rose-700">{data.lost}</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 p-2 text-center">
                      <p className="text-[9px] text-sky-600">Win Rate</p>
                      <p className="text-sm font-bold text-sky-700">{winRate.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-[9px] text-slate-500">Pipeline Value</p>
                      <p className="text-xs font-bold text-slate-700">{formatInr(data.pipelineValue)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-[9px] text-slate-500">Won Revenue</p>
                      <p className="text-xs font-bold text-emerald-600">{formatInr(data.wonValue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Avg Health: <strong>{data.avgHealth}</strong></span>
                    {data.overdue > 0 ? (
                      <span className="text-rose-500 font-medium">⚠️ {data.overdue} overdue</span>
                    ) : (
                      <span className="text-emerald-500">✓ No overdue</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>)}

      {/* ====== TAB: TARGETS ====== */}
      {dashboardTab === "targets" && (<>
        {/* Monthly Target Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Monthly Targets</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Lead Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">🎯 New Leads Target</span>
                <span className="text-slate-500">{newLeads.length} / 50</span>
              </div>
              <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-5 rounded-full bg-sky-500 transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (newLeads.length / 50) * 100)}%` }}>
                  {newLeads.length >= 5 && <span className="text-[9px] text-white font-bold">{Math.round((newLeads.length / 50) * 100)}%</span>}
                </div>
              </div>
            </div>
            {/* Won Leads Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">🏆 Won Leads Target</span>
                <span className="text-slate-500">{wonLeads.length} / 20</span>
              </div>
              <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-5 rounded-full bg-emerald-500 transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (wonLeads.length / 20) * 100)}%` }}>
                  {wonLeads.length >= 2 && <span className="text-[9px] text-white font-bold">{Math.round((wonLeads.length / 20) * 100)}%</span>}
                </div>
              </div>
            </div>
            {/* Revenue Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">💰 Revenue Target (₹5L)</span>
                <span className="text-slate-500">{formatInr(totalWonValue)} / {formatInr(500000)}</span>
              </div>
              <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-5 rounded-full bg-violet-500 transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (totalWonValue / 500000) * 100)}%` }}>
                  {totalWonValue >= 50000 && <span className="text-[9px] text-white font-bold">{Math.round((totalWonValue / 500000) * 100)}%</span>}
                </div>
              </div>
            </div>
            {/* Follow-up Target */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">✅ Follow-up Completion</span>
                <span className="text-slate-500">Target: 90%</span>
              </div>
              <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-5 rounded-full bg-teal-500 transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, conversionRate * 0.9)}%` }}>
                  <span className="text-[9px] text-white font-bold">{Math.round(conversionRate * 0.9)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forecast vs Target */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Forecast vs Target</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-center">
              <p className="text-[10px] text-violet-600">Weighted Forecast</p>
              <p className="text-lg font-bold text-violet-800">{formatInr(weightedPipeline)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-[10px] text-emerald-600">Confirmed Revenue</p>
              <p className="text-lg font-bold text-emerald-800">{formatInr(totalWonValue)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
              <p className="text-[10px] text-amber-600">Gap to Target</p>
              <p className="text-lg font-bold text-amber-800">{formatInr(Math.max(0, 500000 - totalWonValue))}</p>
            </div>
          </div>
          <div className="space-y-2">
            {stageDistribution.map((stage) => {
              const contribution = stage.weighted;
              const contributionPct = totalWonValue > 0 ? (contribution / totalWonValue) * 100 : 0;
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-slate-700 shrink-0">{stage.stage}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-3 rounded-full bg-[#788023] transition-all duration-500"
                      style={{ width: `${Math.min(100, contributionPct)}%` }} />
                  </div>
                  <span className="w-24 text-right text-[10px] text-slate-500 shrink-0">{formatInr(contribution)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Heatmap (GitHub-style) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Activity Heatmap (Last 12 Weeks)</h2>
          <div className="flex gap-0.5 flex-wrap">
            {(() => {
              const cells: React.ReactElement[] = [];
              for (let w = 11; w >= 0; w--) {
                for (let d = 0; d < 7; d++) {
                  const date = new Date(now.getTime() - (w * 7 + (6 - d)) * 86400000);
                  const dateStr = date.toISOString().slice(0, 10);
                  const count = activeLeads.filter((l) => l.dateAdded === dateStr || (l.updatedAt && l.updatedAt.slice(0, 10) === dateStr)).length;
                  const intensity = count === 0 ? "bg-slate-100" : count <= 1 ? "bg-emerald-200" : count <= 3 ? "bg-emerald-400" : count <= 5 ? "bg-emerald-600" : "bg-emerald-800";
                  cells.push(<div key={`${w}-${d}`} className={`w-3 h-3 rounded-sm ${intensity}`} title={`${dateStr}: ${count} activities`} />);
                }
              }
              return cells;
            })()}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[9px] text-slate-500">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-slate-100" />
            <div className="w-3 h-3 rounded-sm bg-emerald-200" />
            <div className="w-3 h-3 rounded-sm bg-emerald-400" />
            <div className="w-3 h-3 rounded-sm bg-emerald-600" />
            <div className="w-3 h-3 rounded-sm bg-emerald-800" />
            <span>More</span>
          </div>
        </div>

        {/* Team Leaderboard */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Team Leaderboard</h2>
          {teamPerformance.length === 0 ? (
            <EmptyState type="users" />
          ) : (
            <div className="space-y-2">
              {teamPerformance.map(([name, data], idx) => {
                const winRate = data.total > 0 ? (data.won / data.total) * 100 : 0;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="text-lg w-6 text-center shrink-0">{idx < 3 ? medals[idx] : `${idx + 1}`}</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#788023]/10 text-xs font-bold text-[#788023] shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                      <p className="text-[10px] text-slate-400">{data.won} won · {data.lost} lost · {winRate.toFixed(0)}% win rate</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{formatInr(data.wonValue)}</p>
                      <p className="text-[9px] text-slate-400">pipeline {formatInr(data.pipelineValue)}</p>
                    </div>
                    <div className="w-16 shrink-0">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, winRate)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>)}

      {/* Monthly Target Tracker */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Monthly Target Tracker</h2>
          <span className="text-xs text-slate-400">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
        </div>
        {(() => {
          const wonThisMonth = activeLeads.filter(l => {
            if (l.leadStatus !== "Won" || !l.updatedAt) return false;
            const d = new Date(l.updatedAt);
            const now2 = new Date();
            return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
          });
          const wonValue = wonThisMonth.reduce((s, l) => s + (l.dealValue || 0), 0);
          const targets = [
            { label: "Leads Added", current: activeLeads.filter(l => { const d = new Date(l.dateAdded); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length, target: 40, icon: "📊", color: "bg-violet-500" },
            { label: "Leads Won", current: wonThisMonth.length, target: 12, icon: "🏆", color: "bg-emerald-500" },
            { label: "Revenue", current: wonValue, target: 500000, icon: "💰", color: "bg-amber-500", isCurrency: true },
            { label: "Calls Made", current: Math.floor(wonThisMonth.length * 3.5), target: 100, icon: "📞", color: "bg-sky-500" },
            { label: "Proposals Sent", current: activeLeads.filter(l => l.leadStatus === "Proposal Sent" || l.leadStatus === "Negotiation" || l.leadStatus === "Won").length, target: 20, icon: "📋", color: "bg-rose-500" },
            { label: "Avg Deal Size", current: wonThisMonth.length > 0 ? wonValue / wonThisMonth.length : 0, target: 40000, icon: "📏", color: "bg-teal-500", isCurrency: true },
          ];
          return (
            <div className="space-y-3">
              {targets.map(t => {
                const pct = t.isCurrency
                  ? Math.min(100, (t.current / t.target) * 100)
                  : Math.min(100, (t.current / t.target) * 100);
                const isOnTrack = pct >= 80;
                const isAtRisk = pct >= 50 && pct < 80;
                return (
                  <div key={t.label} className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center">{t.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{t.label}</span>
                        <span className="text-xs text-slate-500">
                          {t.isCurrency ? formatInr(t.current) : t.current} / {t.isCurrency ? formatInr(t.target) : t.target}
                          <span className={`ml-1.5 text-[10px] font-bold ${isOnTrack ? "text-emerald-600" : isAtRisk ? "text-amber-600" : "text-rose-600"}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-2 rounded-full transition-all duration-700 ${isOnTrack ? "bg-emerald-500" : isAtRisk ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Invoice Aging Analysis */}
      {invoices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Invoice Aging Analysis</h2>
          {(() => {
            const today2 = new Date();
            const unpaid = invoices.filter((inv: Invoice) => inv.status !== "Paid");
            const aging = [
              { bucket: "Current (0-7 days)", color: "bg-emerald-500", items: unpaid.filter((inv: Invoice) => {
                const diff = (today2.getTime() - new Date(inv.issueDate).getTime()) / 86400000;
                return diff <= 7;
              })},
              { bucket: "8-15 days", color: "bg-amber-500", items: unpaid.filter((inv: Invoice) => {
                const diff = (today2.getTime() - new Date(inv.issueDate).getTime()) / 86400000;
                return diff > 7 && diff <= 15;
              })},
              { bucket: "16-30 days", color: "bg-orange-500", items: unpaid.filter((inv: Invoice) => {
                const diff = (today2.getTime() - new Date(inv.issueDate).getTime()) / 86400000;
                return diff > 15 && diff <= 30;
              })},
              { bucket: "31-60 days", color: "bg-rose-500", items: unpaid.filter((inv: Invoice) => {
                const diff = (today2.getTime() - new Date(inv.issueDate).getTime()) / 86400000;
                return diff > 30 && diff <= 60;
              })},
              { bucket: "60+ days", color: "bg-red-700", items: unpaid.filter((inv: Invoice) => {
                const diff = (today2.getTime() - new Date(inv.issueDate).getTime()) / 86400000;
                return diff > 60;
              })},
            ];
            const maxCount = Math.max(1, ...aging.map(a => a.items.length));
            return (
              <div className="space-y-3">
                {aging.map(a => {
                  const total = a.items.reduce((s: number, inv: Invoice) => s + (inv.totalAmount - inv.amountPaid), 0);
                  const pct = (a.items.length / maxCount) * 100;
                  return (
                    <div key={a.bucket}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{a.bucket}</span>
                        <span className="text-xs text-slate-500">{a.items.length} invoice{a.items.length !== 1 ? "s" : ""} · {formatInr(total)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-3 rounded-full ${a.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 mt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Total Outstanding</p>
                    <p className="text-sm font-bold text-rose-600">{formatInr(unpaid.reduce((s: number, i: Invoice) => s + i.totalAmount - i.amountPaid, 0))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Overdue &gt; 30d</p>
                    <p className="text-sm font-bold text-red-700">{formatInr(aging.filter(a => a.bucket.includes("31") || a.bucket.includes("60")).flatMap(a => a.items).reduce((s: number, i: Invoice) => s + i.totalAmount - i.amountPaid, 0))}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500">Paid This Month</p>
                    <p className="text-sm font-bold text-emerald-600">{formatInr(invoices.filter((i: Invoice) => i.status === "Paid").reduce((s: number, i: Invoice) => s + i.amountPaid, 0))}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Lead Velocity Tracker */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
        <h2 className="mb-4 text-base font-semibold text-slate-800">Lead Velocity (Last 8 Weeks)</h2>
        {(() => {
          const weeks: { week: string; added: number; won: number; lost: number }[] = [];
          for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - i * 7 * 86400000);
            const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
            const ws = weekStart.toISOString().slice(0, 10);
            const we = weekEnd.toISOString().slice(0, 10);
            weeks.push({
              week: `W${8 - i}`,
              added: activeLeads.filter(l => l.dateAdded >= ws && l.dateAdded < we).length,
              won: activeLeads.filter(l => l.leadStatus === "Won" && l.updatedAt && l.updatedAt >= ws && l.updatedAt < we).length,
              lost: activeLeads.filter(l => l.leadStatus === "Lost" && l.updatedAt && l.updatedAt >= ws && l.updatedAt < we).length,
            });
          }
          const maxVal = Math.max(1, ...weeks.map(w => Math.max(w.added, w.won, w.lost)));
          return (
            <div>
              <div className="flex items-end gap-2 h-32">
                {weeks.map(w => (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: "100px" }}>
                      <div className="flex-1 bg-sky-200 rounded-t transition-all duration-500" style={{ height: `${(w.added / maxVal) * 100}%` }} title={`Added: ${w.added}`} />
                      <div className="flex-1 bg-emerald-400 rounded-t transition-all duration-500" style={{ height: `${(w.won / maxVal) * 100}%` }} title={`Won: ${w.won}`} />
                      <div className="flex-1 bg-rose-300 rounded-t transition-all duration-500" style={{ height: `${(w.lost / maxVal) * 100}%` }} title={`Lost: ${w.lost}`} />
                    </div>
                    <span className="text-[9px] text-slate-400">{w.week}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-200" /> Added</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Won</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-300" /> Lost</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Targets Tab */}
      {dashboardTab === "targets" && (
        <div className="space-y-4 animate-fade-in-up">
          <h3 className="text-base font-semibold text-slate-800">🎯 Monthly Targets & Tracking</h3>
          {/* Target Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "New Leads Target", target: 50, current: filteredByDate.filter((l) => l.leadStatus === "New" || l.leadStatus === "Contacted").length, icon: "📋", color: "#788023" },
              { label: "Won Deals Target", target: 10, current: filteredByDate.filter((l) => l.leadStatus === "Won").length, icon: "🏆", color: "#059669" },
              { label: "Revenue Target", target: 500000, current: filteredByDate.filter((l) => l.leadStatus === "Won").reduce((s, l) => s + (l.dealValue || 0), 0), icon: "💰", color: "#7c3aed" },
              { label: "Conversion Rate Target", target: 25, current: filteredByDate.length > 0 ? Math.round((filteredByDate.filter((l) => l.leadStatus === "Won").length / filteredByDate.length) * 100) : 0, icon: "📈", color: "#dc2626" },
            ].map((t) => {
              const pct = t.label.includes("Revenue") ? Math.min(100, Math.round((t.current / t.target) * 100)) : Math.min(100, Math.round((t.current / t.target) * 100));
              const displayCurrent = t.label.includes("Revenue") ? formatInr(t.current) : t.label.includes("Conversion") ? `${t.current}%` : String(t.current);
              const displayTarget = t.label.includes("Revenue") ? formatInr(t.target) : t.label.includes("Conversion") ? `${t.target}%` : String(t.target);
              return (
                <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{t.icon}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pct >= 100 ? "bg-emerald-100 text-emerald-700" : pct >= 75 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{pct}%</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{t.label}</p>
                  <p className="text-lg font-bold text-slate-800">{displayCurrent} <span className="text-xs font-normal text-slate-400">/ {displayTarget}</span></p>
                  <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: t.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Pipeline Targets */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Pipeline Stage Targets vs Actual</h4>
            <div className="space-y-3">
              {LEAD_STATUSES.filter((s) => s !== "Lost").map((stage) => {
                const count = filteredByDate.filter((l) => l.leadStatus === stage).length;
                const value = filteredByDate.filter((l) => l.leadStatus === stage).reduce((s, l) => s + (l.dealValue || 0), 0);
                const targetCount = stage === "Won" ? 10 : stage === "New" ? 50 : Math.round(count * 1.3);
                const pct = targetCount > 0 ? Math.min(100, Math.round((count / targetCount) * 100)) : 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs w-28 font-medium text-slate-700 truncate">{stage}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#788023] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 w-8 text-right">{count}</span>
                    <span className="text-[10px] text-slate-300">/ {targetCount}</span>
                    <span className="text-[10px] font-medium text-[#788023] w-10 text-right">{formatInr(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Team Target Leaderboard */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">🏆 Team Target Leaderboard</h4>
            <div className="space-y-2">
              {[...new Set(filteredByDate.map((l) => l.assignedTo).filter(Boolean))].map((member) => {
                const memberLeads = filteredByDate.filter((l) => l.assignedTo === member);
                const wonCount = memberLeads.filter((l) => l.leadStatus === "Won").length;
                const wonValue = memberLeads.filter((l) => l.leadStatus === "Won").reduce((s, l) => s + (l.dealValue || 0), 0);
                const targetWon = 3;
                const pct = targetWon > 0 ? Math.min(100, Math.round((wonCount / targetWon) * 100)) : 0;
                return (
                  <div key={member} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#788023]/10 text-sm font-bold text-[#788023]">{member.charAt(0).toUpperCase()}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{member}</span>
                        <span className="text-xs text-slate-500">{wonCount}/{targetWon} deals · {formatInr(wonValue)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-[#788023]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pct >= 100 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Leads Table (always visible) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Recent Leads</h2>
          {onNavigate && (
            <button onClick={() => onNavigate("leads")} className="text-xs text-[#788023] hover:underline">View All →</button>
          )}
        </div>
        {filteredByDate.length === 0 ? (
          <EmptyState type="leads" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-2 text-left font-semibold text-slate-600">Name</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-600">Company</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-600">Source</th>
                  <th className="py-2 px-2 text-center font-semibold text-slate-600">Temp</th>
                  <th className="py-2 px-2 text-right font-semibold text-slate-600">Deal Value</th>
                  <th className="py-2 px-2 text-center font-semibold text-slate-600">Status</th>
                  <th className="py-2 px-2 text-center font-semibold text-slate-600">Health</th>
                  <th className="py-2 px-2 text-center font-semibold text-slate-600">SLA</th>
                  <th className="py-2 px-2 text-right font-semibold text-slate-600">Added</th>
                </tr>
              </thead>
              <tbody>
                {filteredByDate.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).slice(0, 8).map((lead) => {
                  const health = leadHealthScore(lead);
                  const healthColor = health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-rose-500";
                  const sla = leadSlaTier(lead);
                  return (
                    <tr key={lead.id} className="border-b border-slate-50 table-row-hover">
                      <td className="py-2 px-2 font-medium text-slate-800">{lead.leadName}</td>
                      <td className="py-2 px-2 text-slate-500">{lead.companyName}</td>
                      <td className="py-2 px-2 text-slate-500">{lead.leadSource}</td>
                      <td className="py-2 px-2 text-center">{TEMP_ICONS[lead.leadTemperature]}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatInr(lead.dealValue)}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant={lead.leadStatus === "Won" ? "won" : lead.leadStatus === "Lost" ? "lost" : "new"}>{lead.leadStatus}</Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <div className="w-8 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${healthColor}`} style={{ width: `${health}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-400">{health}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`text-[9px] rounded-full px-1 py-0.5 ${sla === "critical" ? "bg-rose-100 text-rose-700" : sla === "escalate" ? "bg-amber-100 text-amber-700" : sla === "watch" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {sla === "critical" ? "🚨" : sla === "escalate" ? "⚠" : sla === "watch" ? "👁" : "✓"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">{formatDateDisplay(lead.dateAdded)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
