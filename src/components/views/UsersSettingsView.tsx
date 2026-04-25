// =====================================================================
// USERS, SETTINGS, SOURCES, MY WORK VIEWS
// Phase 7: Massive expansion — Full user management, permissions,
// activity logs, enhanced settings, role management, audit trail
// =====================================================================
import { useState, useMemo, useCallback, useEffect } from "react";
import type { User, Lead, Invoice, AppSettings } from "../../types/index";
import {
  formatInr, formatDateDisplay, dateTag, leadHealthScore, makeId, sha256,
  todayISODate, isOpenLeadStatus, daysSince, hashPassword,
} from "../../lib/utils";
import { DEFAULT_TENANT_ID, LEAD_SOURCES } from "../../constants/index";

// ---------- CONSTANTS ----------
const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 border-amber-200",
  admin: "bg-violet-100 text-violet-700 border-violet-200",
  manager: "bg-sky-100 text-sky-700 border-sky-200",
  user: "bg-slate-100 text-slate-700 border-slate-200",
};
const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full platform access including SuperAdmin, billing, and tenant management",
  admin: "Manage team, settings, all leads, invoices, and revenue data",
  manager: "Manage assigned leads, view all pipeline data, create invoices",
  user: "Access own leads, follow-ups, and basic pipeline view",
};
const ACTIVITY_TYPES: Record<string, { icon: string; color: string; label: string }> = {
  login: { icon: "🔑", color: "text-sky-600", label: "Login" },
  lead_create: { icon: "🆕", color: "text-emerald-600", label: "Lead Created" },
  lead_update: { icon: "📝", color: "text-blue-600", label: "Lead Updated" },
  lead_delete: { icon: "🗑️", color: "text-rose-600", label: "Lead Deleted" },
  lead_win: { icon: "🏆", color: "text-emerald-600", label: "Deal Won" },
  lead_lost: { icon: "❌", color: "text-rose-600", label: "Deal Lost" },
  invoice_create: { icon: "🧾", color: "text-violet-600", label: "Invoice Created" },
  invoice_paid: { icon: "💳", color: "text-emerald-600", label: "Payment Received" },
  followup_done: { icon: "✅", color: "text-sky-600", label: "Follow-up Done" },
  followup_scheduled: { icon: "📅", color: "text-amber-600", label: "Follow-up Scheduled" },
  settings_change: { icon: "⚙️", color: "text-slate-600", label: "Settings Changed" },
  user_add: { icon: "👤", color: "text-indigo-600", label: "User Added" },
  user_deactivate: { icon: "🚫", color: "text-rose-600", label: "User Deactivated" },
  export_data: { icon: "📤", color: "text-teal-600", label: "Data Exported" },
  import_data: { icon: "📥", color: "text-blue-600", label: "Data Imported" },
};

// ---------- MY WORK VIEW ----------
export function MyWorkView({ leads, invoices, currentUser }: { leads: Lead[]; invoices: Invoice[]; currentUser: { name: string; role: string } }) {
  const [workTab, setWorkTab] = useState<"overview" | "overdue" | "today" | "pipeline" | "won" | "activity">("overview");

  const myLeads = useMemo(
    () => leads.filter((l) => !l.isDeleted && l.assignedTo === currentUser.name),
    [leads, currentUser.name]
  );
  const myOpenLeads = myLeads.filter((l) => l.leadStatus !== "Won" && l.leadStatus !== "Lost");
  const myWonLeads = myLeads.filter((l) => l.leadStatus === "Won");
  const overdueFollowups = myOpenLeads.filter((l) => dateTag(l) === "Overdue");
  const todayFollowups = myOpenLeads.filter((l) => dateTag(l) === "Due Today");
  const hotLeads = myOpenLeads.filter((l) => l.leadTemperature === "Hot");
  const warmLeads = myOpenLeads.filter((l) => l.leadTemperature === "Warm");
  const coldLeads = myOpenLeads.filter((l) => l.leadTemperature === "Cold");

  const totalPipelineValue = myOpenLeads.reduce((s, l) => s + l.dealValue, 0);
  const totalWonValue = myWonLeads.reduce((s, l) => s + (l.wonDealValue ?? l.dealValue), 0);
  const myInvoices = invoices.filter((i) => {
    const lead = leads.find((l) => l.id === i.leadId);
    return lead && lead.assignedTo === currentUser.name;
  });
  const _myInvoiceTotal = myInvoices.reduce((s, i) => s + i.totalAmount, 0);
  void _myInvoiceTotal;

  // Performance metrics
  const winRate = myLeads.length > 0 ? (myWonLeads.length / myLeads.length) * 100 : 0;
  const avgDealSize = myWonLeads.length > 0 ? totalWonValue / myWonLeads.length : 0;
  const avgDaysToClose = myWonLeads.length > 0
    ? myWonLeads.reduce((s, l) => s + daysSince(l.createdAt), 0) / myWonLeads.length
    : 0;

  // Lead by source
  const sourceBreakdown = useMemo(() => {
    const sources: Record<string, { count: number; value: number; won: number }> = {};
    for (const l of myOpenLeads) {
      if (!sources[l.leadSource]) sources[l.leadSource] = { count: 0, value: 0, won: 0 };
      sources[l.leadSource].count++;
      sources[l.leadSource].value += l.dealValue;
    }
    for (const l of myWonLeads) {
      if (!sources[l.leadSource]) sources[l.leadSource] = { count: 0, value: 0, won: 0 };
      sources[l.leadSource].won += l.wonDealValue ?? l.dealValue;
    }
    return Object.entries(sources).sort((a, b) => b[1].value - a[1].value);
  }, [myOpenLeads, myWonLeads]);

  // Stage distribution
  const stageBreakdown = useMemo(() => {
    const stages: Record<string, number> = {};
    for (const l of myOpenLeads) {
      stages[l.leadStatus] = (stages[l.leadStatus] || 0) + 1;
    }
    return Object.entries(stages).sort((a, b) => b[1] - a[1]);
  }, [myOpenLeads]);

  const displayedLeads = workTab === "overdue" ? overdueFollowups
    : workTab === "today" ? todayFollowups
    : workTab === "pipeline" ? myOpenLeads
    : workTab === "won" ? myWonLeads
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Work</h1>
          <p className="text-sm text-slate-500">Welcome back, {currentUser.name}! Here's your work summary.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{myOpenLeads.length} open leads</span>
          {overdueFollowups.length > 0 && (
            <span className="animate-bounce-in rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              ⚠️ {overdueFollowups.length} overdue
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Open Leads", value: myOpenLeads.length, icon: "🔄", color: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Pipeline Value", value: formatInr(totalPipelineValue), icon: "💰", color: "bg-violet-50 text-violet-700 border-violet-200" },
          { label: "Won Revenue", value: formatInr(totalWonValue), icon: "🏆", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Win Rate", value: `${winRate.toFixed(0)}%`, icon: "📈", color: "bg-teal-50 text-teal-700 border-teal-200" },
          { label: "Avg Deal Size", value: formatInr(avgDealSize), icon: "📊", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
          { label: "Avg Days to Close", value: `${avgDaysToClose.toFixed(0)}d`, icon: "⏱️", color: "bg-amber-50 text-amber-700 border-amber-200" },
        ].map((stat) => (
          <div key={stat.label} className={`card-hover rounded-xl border p-3 ${stat.color}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{stat.icon}</span>
              <span className="text-[10px] font-medium opacity-80">{stat.label}</span>
            </div>
            <p className="mt-1 text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Alert Cards */}
      {(overdueFollowups.length > 0 || todayFollowups.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {overdueFollowups.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-rose-700">⚠️ Overdue Follow-ups ({overdueFollowups.length})</h3>
                <button onClick={() => setWorkTab(workTab === "overdue" ? "overview" : "overdue")}
                  className="text-xs font-medium text-rose-600 hover:text-rose-800">
                  {workTab === "overdue" ? "Hide" : "View All"}
                </button>
              </div>
              <div className="space-y-1.5">
                {overdueFollowups.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{lead.leadName}</p>
                      <p className="text-[10px] text-slate-400">{lead.companyName} · Due: {formatDateDisplay(lead.nextFollowupDate)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {lead.leadTemperature}
                      </span>
                      <span className="text-[10px] font-medium text-rose-600">{leadHealthScore(lead)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {todayFollowups.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-amber-700">📅 Due Today ({todayFollowups.length})</h3>
                <button onClick={() => setWorkTab(workTab === "today" ? "overview" : "today")}
                  className="text-xs font-medium text-amber-600 hover:text-amber-800">
                  {workTab === "today" ? "Hide" : "View All"}
                </button>
              </div>
              <div className="space-y-1.5">
                {todayFollowups.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{lead.leadName}</p>
                      <p className="text-[10px] text-slate-400">{lead.companyName} · {lead.leadSource}</p>
                    </div>
                    <span className="text-[10px] font-medium text-amber-700">{formatInr(lead.dealValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "overview", label: "Overview", icon: "📊" },
          { key: "overdue", label: `Overdue (${overdueFollowups.length})`, icon: "⚠️" },
          { key: "today", label: `Today (${todayFollowups.length})`, icon: "📅" },
          { key: "pipeline", label: `Pipeline (${myOpenLeads.length})`, icon: "🔄" },
          { key: "won", label: `Won (${myWonLeads.length})`, icon: "🏆" },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setWorkTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${workTab === tab.key ? "bg-[#788023] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {workTab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Temperature Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">🌡️ Temperature</h3>
            <div className="space-y-2">
              {[
                { temp: "Hot", count: hotLeads.length, color: "bg-rose-500", icon: "🔥" },
                { temp: "Warm", count: warmLeads.length, color: "bg-amber-500", icon: "🌤️" },
                { temp: "Cold", count: coldLeads.length, color: "bg-sky-500", icon: "❄️" },
              ].map((t) => {
                const maxT = Math.max(1, hotLeads.length, warmLeads.length, coldLeads.length);
                return (
                  <div key={t.temp} className="flex items-center gap-2">
                    <span className="w-16 text-xs font-medium text-slate-700">{t.icon} {t.temp}</span>
                    <div className="flex-1 h-6 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`flex h-6 items-center rounded-full ${t.color} px-2 text-[10px] font-medium text-white`}
                        style={{ width: `${Math.max((t.count / maxT) * 100, 8)}%` }}>
                        {t.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📊 By Stage</h3>
            <div className="space-y-1.5">
              {stageBreakdown.map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5">
                  <span className="text-xs text-slate-700">{stage}</span>
                  <span className="text-xs font-bold text-slate-800">{count}</span>
                </div>
              ))}
              {stageBreakdown.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No open leads</p>}
            </div>
          </div>

          {/* Source Performance */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📡 By Source</h3>
            <div className="space-y-1.5">
              {sourceBreakdown.slice(0, 6).map(([source, data]) => (
                <div key={source} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{source}</p>
                    <p className="text-[9px] text-slate-400">{data.count} leads · Won: {formatInr(data.won)}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{formatInr(data.value)}</span>
                </div>
              ))}
              {sourceBreakdown.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data</p>}
            </div>
          </div>
        </div>
      )}

      {(workTab === "overdue" || workTab === "today" || workTab === "pipeline" || workTab === "won") && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {workTab === "overdue" ? "⚠️ Overdue Follow-ups" : workTab === "today" ? "📅 Due Today" : workTab === "pipeline" ? "🔄 Open Pipeline" : "🏆 Won Deals"}
              <span className="ml-2 text-xs text-slate-400">({displayedLeads.length})</span>
            </h3>
          </div>
          {displayedLeads.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">{workTab === "overdue" ? "🎉" : workTab === "today" ? "📅" : workTab === "pipeline" ? "📭" : "🏆"}</p>
              <p className="text-sm text-slate-500">{workTab === "overdue" ? "No overdue follow-ups!" : workTab === "today" ? "No follow-ups due today" : workTab === "pipeline" ? "No open leads" : "No won deals yet"}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {displayedLeads.slice(0, 25).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      lead.leadTemperature === "Hot" ? "bg-rose-100 text-rose-700" :
                      lead.leadTemperature === "Warm" ? "bg-amber-100 text-amber-700" :
                      "bg-sky-100 text-sky-700"
                    }`}>
                      {lead.leadName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 truncate">{lead.leadName}</p>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          lead.leadStatus === "Won" ? "bg-emerald-100 text-emerald-700" :
                          lead.leadStatus === "Lost" ? "bg-rose-100 text-rose-700" :
                          "bg-sky-100 text-sky-700"
                        }`}>{lead.leadStatus}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {lead.companyName} · {lead.leadSource} · {lead.serviceInterested}
                        {lead.nextFollowupDate && ` · FU: ${formatDateDisplay(lead.nextFollowupDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">{formatInr(lead.wonDealValue ?? lead.dealValue)}</p>
                      <p className="text-[9px] text-slate-400">Added {formatDateDisplay(lead.dateAdded)}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-slate-400">Health</span>
                      <span className={`text-xs font-bold ${leadHealthScore(lead) >= 70 ? "text-emerald-600" : leadHealthScore(lead) >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                        {leadHealthScore(lead)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- SOURCES VIEW ----------
export function SourcesView({ leads }: { leads: Lead[] }) {
  const [sourceView, setSourceView] = useState<"overview" | "detail">("overview");

  const sourceStats = useMemo(() => {
    return LEAD_SOURCES.map((source) => {
      const sourceLeads = leads.filter((l) => !l.isDeleted && l.leadSource === source);
      const wonLeads = sourceLeads.filter((l) => l.leadStatus === "Won");
      const lostLeads = sourceLeads.filter((l) => l.leadStatus === "Lost");
      const openLeads = sourceLeads.filter((l) => isOpenLeadStatus(l.leadStatus));
      const wonValue = wonLeads.reduce((s, l) => s + (l.wonDealValue ?? l.dealValue), 0);
      const pipelineValue = openLeads.reduce((s, l) => s + l.dealValue, 0);
      const convRate = sourceLeads.length > 0 ? (wonLeads.length / sourceLeads.length) * 100 : 0;
      const avgDealSize = wonLeads.length > 0 ? wonValue / wonLeads.length : 0;
      const avgDaysToConvert = wonLeads.length > 0
        ? wonLeads.reduce((s, l) => s + daysSince(l.createdAt), 0) / wonLeads.length
        : 0;
      // Temperature split
      const hot = openLeads.filter((l) => l.leadTemperature === "Hot").length;
      const warm = openLeads.filter((l) => l.leadTemperature === "Warm").length;
      const cold = openLeads.filter((l) => l.leadTemperature === "Cold").length;
      return {
        source, total: sourceLeads.length, open: openLeads.length, won: wonLeads.length, lost: lostLeads.length,
        wonValue, pipelineValue, convRate, avgDealSize, avgDaysToConvert,
        hot, warm, cold,
      };
    }).filter((s) => s.total > 0).sort((a, b) => b.wonValue - a.wonValue);
  }, [leads]);

  const maxLeads = Math.max(1, ...sourceStats.map((s) => s.total));
  const totalWonValue = sourceStats.reduce((s, st) => s + st.wonValue, 0);
  const totalPipelineValue = sourceStats.reduce((s, st) => s + st.pipelineValue, 0);
  const avgConvRate = sourceStats.length > 0 ? sourceStats.reduce((s, st) => s + st.convRate, 0) / sourceStats.length : 0;

  // Monthly trend per source
  const monthlyTrend = useMemo(() => {
    const months: Record<string, Record<string, { count: number; won: number }>> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = {};
    }
    for (const l of leads.filter((l) => !l.isDeleted)) {
      const month = l.dateAdded.slice(0, 7);
      if (months[month]) {
        if (!months[month][l.leadSource]) months[month][l.leadSource] = { count: 0, won: 0 };
        months[month][l.leadSource].count++;
        if (l.leadStatus === "Won") months[month][l.leadSource].won++;
      }
    }
    return months;
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lead Sources</h1>
          <p className="text-sm text-slate-500">Source-wise analytics with conversion rates, revenue, and quality metrics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSourceView("overview")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sourceView === "overview" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600"}`}>Overview</button>
          <button onClick={() => setSourceView("detail")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sourceView === "detail" ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600"}`}>Detail</button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Leads</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{leads.filter((l) => !l.isDeleted).length}</p>
          <p className="text-[10px] text-slate-400">{sourceStats.length} active sources</p>
        </div>
        <div className="card-hover rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">Won Revenue</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatInr(totalWonValue)}</p>
        </div>
        <div className="card-hover rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs text-violet-700">Pipeline Value</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">{formatInr(totalPipelineValue)}</p>
        </div>
        <div className="card-hover rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs text-sky-700">Avg Conversion</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{avgConvRate.toFixed(1)}%</p>
        </div>
      </div>

      {sourceView === "overview" ? (
        /* Visual Bar Chart */
        <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Source Performance</h3>
          <div className="space-y-3">
            {sourceStats.map((stat) => {
              const convColor = stat.convRate >= 30 ? "text-emerald-600" : stat.convRate >= 15 ? "text-amber-600" : "text-rose-600";
              return (
                <div key={stat.source} className="group">
                  <div className="flex items-center gap-4">
                    <span className="w-32 text-sm font-medium text-slate-700 shrink-0">{stat.source}</span>
                    <div className="flex-1">
                      <div className="h-8 rounded-full bg-slate-100 overflow-hidden relative">
                        <div className="flex h-8 items-center rounded-full bg-[#788023]/60 px-3 text-xs font-medium text-white transition-all duration-500"
                          style={{ width: `${Math.max((stat.total / maxLeads) * 100, 6)}%` }}>
                          {stat.total} leads
                        </div>
                        {/* Won overlay */}
                        {stat.won > 0 && (
                          <div className="absolute top-0 left-0 h-8 rounded-full bg-emerald-400/30 flex items-center px-3 text-[9px] font-medium text-emerald-800"
                            style={{ width: `${Math.max((stat.won / maxLeads) * 100, 3)}%` }}>
                            {stat.won} won
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-40 text-right shrink-0 space-y-0.5">
                      <p className="text-xs font-medium text-emerald-600">{formatInr(stat.wonValue)} won</p>
                      <p className={`text-[10px] ${convColor}`}>{stat.won}/{stat.total} · {stat.convRate.toFixed(0)}% conv</p>
                    </div>
                  </div>
                  {/* Expanded details on hover */}
                  <div className="ml-32 mt-1 flex items-center gap-3 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Open: {stat.open}</span>
                    <span>Lost: {stat.lost}</span>
                    <span>Pipeline: {formatInr(stat.pipelineValue)}</span>
                    <span>Avg Deal: {formatInr(stat.avgDealSize)}</span>
                    <span>Avg Days: {stat.avgDaysToConvert.toFixed(0)}d</span>
                    <span>🔥{stat.hot} 🌤️{stat.warm} ❄️{stat.cold}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detail Table */
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden card-hover">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Source</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Total</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Open</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Won</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Lost</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Pipeline</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Won Revenue</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Conv %</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Avg Deal</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Avg Days</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Quality</th>
                </tr>
              </thead>
              <tbody>
                {sourceStats.map((stat) => {
                  const quality = stat.convRate >= 25 ? "⭐⭐⭐" : stat.convRate >= 15 ? "⭐⭐" : stat.convRate >= 5 ? "⭐" : "—";
                  return (
                    <tr key={stat.source} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{stat.source}</td>
                      <td className="px-3 py-2.5 text-center font-bold">{stat.total}</td>
                      <td className="px-3 py-2.5 text-center text-sky-600">{stat.open}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 font-medium">{stat.won}</td>
                      <td className="px-3 py-2.5 text-center text-rose-600">{stat.lost}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatInr(stat.pipelineValue)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">{formatInr(stat.wonValue)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          stat.convRate >= 25 ? "bg-emerald-100 text-emerald-700" :
                          stat.convRate >= 15 ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>{stat.convRate.toFixed(0)}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatInr(stat.avgDealSize)}</td>
                      <td className="px-3 py-2.5 text-center">{stat.avgDaysToConvert.toFixed(0)}d</td>
                      <td className="px-3 py-2.5 text-center text-xs">{quality}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-800">Total</td>
                  <td className="px-3 py-2.5 text-center">{sourceStats.reduce((s, st) => s + st.total, 0)}</td>
                  <td className="px-3 py-2.5 text-center text-sky-600">{sourceStats.reduce((s, st) => s + st.open, 0)}</td>
                  <td className="px-3 py-2.5 text-center text-emerald-600">{sourceStats.reduce((s, st) => s + st.won, 0)}</td>
                  <td className="px-3 py-2.5 text-center text-rose-600">{sourceStats.reduce((s, st) => s + st.lost, 0)}</td>
                  <td className="px-3 py-2.5 text-right">{formatInr(totalPipelineValue)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">{formatInr(totalWonValue)}</td>
                  <td className="px-3 py-2.5 text-center">{avgConvRate.toFixed(0)}%</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">📈 6-Month Source Trend</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Source</th>
                {Object.keys(monthlyTrend).map((month) => (
                  <th key={month} className="px-3 py-2 text-center font-semibold text-slate-600">{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceStats.slice(0, 8).map(({ source }) => (
                <tr key={source} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{source}</td>
                  {Object.entries(monthlyTrend).map(([month, data]) => {
                    const d = data[source];
                    return (
                      <td key={month} className="px-3 py-2 text-center">
                        {d ? (
                          <div>
                            <span className="font-medium">{d.count}</span>
                            {d.won > 0 && <span className="text-emerald-600 ml-1">({d.won}🏆)</span>}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- USERS VIEW ----------
export function UsersView({ users, leads, onUsersChange, currentUser }: {
  users: User[];
  leads: Lead[];
  onUsersChange: (users: User[]) => void;
  currentUser: { name: string; role: string };
}) {
  const [usersTab, setUsersTab] = useState<"team" | "roles" | "activity">("team");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newPhone, setNewPhone] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddUser = useCallback(async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const hash = await hashPassword("Welcome@123");
    const newUser: User = {
      id: makeId(), name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim(),
      role: newRole as User["role"], isActive: true, tenantId: DEFAULT_TENANT_ID,
      createdAt: new Date().toISOString(), passwordHash: hash, profilePicture: "", lastLoginAt: "",
    };
    onUsersChange([...users, newUser]);
    setShowAddUser(false);
    setNewName(""); setNewEmail(""); setNewRole("user"); setNewPhone("");
  }, [newName, newEmail, newRole, newPhone, users, onUsersChange]);

  const handleToggleUser = useCallback((userId: string) => {
    onUsersChange(users.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
  }, [users, onUsersChange]);

  const handleRoleChange = useCallback((userId: string, newRole: User["role"]) => {
    onUsersChange(users.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    setShowRoleModal(false); setEditingUser(null);
  }, [users, onUsersChange]);

  const handleDeleteUser = useCallback((userId: string) => {
    if (users.filter((u) => u.isActive && u.role === "owner").length <= 1 &&
        users.find((u) => u.id === userId)?.role === "owner") return;
    onUsersChange(users.filter((u) => u.id !== userId));
  }, [users, onUsersChange]);

  const activeUsers = users.filter((u) => u.isActive);
  const filteredUsers = searchQuery
    ? activeUsers.filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeUsers;

  const assigneeStats = useMemo(() => {
    return filteredUsers.map((user) => {
      const userLeads = leads.filter((l) => l.assignedTo === user.name && !l.isDeleted);
      const openLeads = userLeads.filter((l) => l.leadStatus !== "Won" && l.leadStatus !== "Lost");
      const wonLeads = userLeads.filter((l) => l.leadStatus === "Won");
      const lostLeads = userLeads.filter((l) => l.leadStatus === "Lost");
      const totalPipelineValue = openLeads.reduce((s, l) => s + l.dealValue, 0);
      const totalWonValue = wonLeads.reduce((s, l) => s + (l.wonDealValue ?? l.dealValue), 0);
      const overdueCount = openLeads.filter((l) => l.nextFollowupDate && l.nextFollowupDate < todayISODate() && l.followupStatus !== "Done").length;
      const hotCount = openLeads.filter((l) => l.leadTemperature === "Hot").length;
      const winRate = userLeads.length > 0 ? (wonLeads.length / userLeads.length) * 100 : 0;
      const avgDealSize = wonLeads.length > 0 ? totalWonValue / wonLeads.length : 0;
      return {
        user, openLeads: openLeads.length, wonLeads: wonLeads.length, lostLeads: lostLeads.length,
        totalPipelineValue, totalWonValue, overdueCount, hotCount, winRate, avgDealSize,
      };
    }).sort((a, b) => b.totalWonValue - a.totalWonValue);
  }, [filteredUsers, leads]);

  // Activity log (generated from lead data)
  const activityLog = useMemo(() => {
    const activities: Array<{ id: string; user: string; type: string; detail: string; time: string }> = [];
    for (const lead of leads.filter((l) => !l.isDeleted).slice(0, 50)) {
      if (lead.assignedTo) {
        activities.push({ id: lead.id + "-create", user: lead.assignedTo, type: "lead_create", detail: `Created lead: ${lead.leadName} (${lead.companyName})`, time: lead.createdAt });
        if (lead.leadStatus === "Won") activities.push({ id: lead.id + "-won", user: lead.assignedTo, type: "lead_win", detail: `Won deal: ${lead.leadName} — ${formatInr(lead.wonDealValue ?? lead.dealValue)}`, time: lead.updatedAt });
        if (lead.leadStatus === "Lost") activities.push({ id: lead.id + "-lost", user: lead.assignedTo, type: "lead_lost", detail: `Lost deal: ${lead.leadName}`, time: lead.updatedAt });
        if (lead.followupStatus === "Done") activities.push({ id: lead.id + "-fu", user: lead.assignedTo, type: "followup_done", detail: `Completed follow-up for ${lead.leadName}`, time: lead.lastContactedDate });
      }
    }
    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30);
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Team & Users</h1>
          <p className="text-sm text-slate-500">Manage team members, roles, permissions, and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Search team..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all w-48" />
          {currentUser.role === "owner" || currentUser.role === "admin" ? (
            <button onClick={() => setShowAddUser(true)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm text-white hover:bg-[#646b1d] transition-colors">
              + Add Member
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] text-slate-500">Total Members</p>
          <p className="text-lg font-bold text-slate-800">{users.length}</p>
        </div>
        <div className="card-hover rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] text-emerald-700">Active</p>
          <p className="text-lg font-bold text-emerald-600">{activeUsers.length}</p>
        </div>
        <div className="card-hover rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] text-slate-500">Admins/Managers</p>
          <p className="text-lg font-bold text-slate-800">{activeUsers.filter((u) => u.role === "admin" || u.role === "manager").length}</p>
        </div>
        <div className="card-hover rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] text-rose-700">Inactive</p>
          <p className="text-lg font-bold text-rose-600">{users.filter((u) => !u.isActive).length}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {([
          { key: "team", label: "Team Members", icon: "👥" },
          { key: "roles", label: "Roles & Permissions", icon: "🛡️" },
          { key: "activity", label: "Activity Log", icon: "📋" },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setUsersTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${usersTab === tab.key ? "bg-[#788023] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Team Members Tab */}
      {usersTab === "team" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assigneeStats.map(({ user, openLeads, wonLeads, lostLeads, totalPipelineValue, totalWonValue, overdueCount, hotCount, winRate, avgDealSize }) => (
            <div key={user.id} className="card-hover rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* User Header */}
              <div className="bg-gradient-to-r from-slate-50 to-white p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#788023]/10 text-sm font-bold text-[#788023]">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                      <p className="text-[10px] text-slate-400">{user.email}</p>
                      {user.lastLoginAt && <p className="text-[9px] text-slate-300">Last login: {formatDateDisplay(user.lastLoginAt.slice(0, 10))}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="p-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-sky-50 p-2">
                    <p className="text-sm font-bold text-sky-700">{openLeads}</p>
                    <p className="text-[9px] text-sky-500">Open</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <p className="text-sm font-bold text-emerald-700">{wonLeads}</p>
                    <p className="text-[9px] text-emerald-500">Won</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-2">
                    <p className="text-sm font-bold text-rose-700">{lostLeads}</p>
                    <p className="text-[9px] text-rose-500">Lost</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 p-2">
                    <p className="text-xs font-bold text-violet-700">{winRate.toFixed(0)}%</p>
                    <p className="text-[9px] text-violet-500">Win Rate</p>
                  </div>
                </div>

                {/* Secondary Stats */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                    <span className="text-slate-500">Pipeline</span>
                    <span className="font-semibold text-slate-700">{formatInr(totalPipelineValue)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                    <span className="text-slate-500">Won Revenue</span>
                    <span className="font-semibold text-emerald-600">{formatInr(totalWonValue)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                    <span className="text-slate-500">Avg Deal</span>
                    <span className="font-semibold text-slate-700">{formatInr(avgDealSize)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                    <span className="text-slate-500">🔥 Hot</span>
                    <span className="font-semibold text-rose-600">{hotCount}</span>
                  </div>
                </div>

                {/* Alerts */}
                {overdueCount > 0 && (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-700">
                    ⚠️ {overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}
                  </div>
                )}

                {/* Actions */}
                {user.role !== "owner" && (currentUser.role === "owner" || currentUser.role === "admin") && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setEditingUser(user); setShowRoleModal(true); }}
                      className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      Change Role
                    </button>
                    <button onClick={() => handleToggleUser(user.id)}
                      className={`flex-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
                        user.isActive ? "border border-rose-200 text-rose-600 hover:bg-rose-50" : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      }`}>
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {!user.isActive && (
                      <button onClick={() => handleDeleteUser(user.id)}
                        className="rounded-lg border border-rose-300 px-2 py-1.5 text-[10px] text-rose-600 hover:bg-rose-50">
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roles & Permissions Tab */}
      {usersTab === "roles" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(["owner", "admin", "manager", "user"] as const).map((role) => {
              const roleUsers = users.filter((u) => u.role === role && u.isActive);
              const roleLeads = leads.filter((l) => !l.isDeleted && roleUsers.some((u) => u.name === l.assignedTo));
              const roleWon = roleLeads.filter((l) => l.leadStatus === "Won");
              const roleWonValue = roleWon.reduce((s, l) => s + (l.wonDealValue ?? l.dealValue), 0);
              return (
                <div key={role} className="card-hover rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_COLORS[role]}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <span className="text-xs text-slate-400">{roleUsers.length} member{roleUsers.length !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{ROLE_DESCRIPTIONS[role]}</p>
                  <div className="space-y-1.5">
                    {roleUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                        <div className="h-6 w-6 flex items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-700">{u.name}</p>
                          <p className="text-[9px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {roleLeads.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{roleWon.length}</p>
                        <p className="text-[9px] text-slate-400">Won Deals</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-600">{formatInr(roleWonValue)}</p>
                        <p className="text-[9px] text-slate-400">Won Revenue</p>
                      </div>
                    </div>
                  )}

                  {/* Permissions Table */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-600 mb-2">Permissions</p>
                    <div className="space-y-1">
                      {[
                        { perm: "View all leads", owner: true, admin: true, manager: true, user: false },
                        { perm: "Create/edit leads", owner: true, admin: true, manager: true, user: true },
                        { perm: "Delete leads", owner: true, admin: true, manager: false, user: false },
                        { perm: "Manage invoices", owner: true, admin: true, manager: true, user: false },
                        { perm: "View revenue", owner: true, admin: true, manager: true, user: false },
                        { perm: "Manage team", owner: true, admin: true, manager: false, user: false },
                        { perm: "Settings", owner: true, admin: true, manager: false, user: false },
                        { perm: "SuperAdmin", owner: true, admin: false, manager: false, user: false },
                      ].map((p) => (
                        <div key={p.perm} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">{p.perm}</span>
                          <span className={p[role] ? "text-emerald-600" : "text-slate-300"}>
                            {p[role] ? "✓" : "✗"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {usersTab === "activity" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden card-hover">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">Team Activity Log</h3>
            <p className="text-[10px] text-slate-400">Recent actions by all team members</p>
          </div>
          {activityLog.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-slate-500">No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {activityLog.map((entry) => {
                const typeInfo = ACTIVITY_TYPES[entry.type] || ACTIVITY_TYPES.lead_update;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className="text-sm">{typeInfo.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{entry.user}</span>
                        <span className={`text-[10px] ${typeInfo.color}`}>{typeInfo.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{entry.detail}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatDateDisplay(entry.time.slice(0, 10))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 modal-backdrop">
          <div className="animate-scale-in w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Add Team Member</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Full Name *</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
                <input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john@company.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="user">User — Own leads only</option>
                  <option value="manager">Manager — Team leads + invoices</option>
                  <option value="admin">Admin — Full access</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[newRole]}</p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">
                🔑 Default password: <span className="font-mono font-medium">Welcome@123</span>
                <br />User will be prompted to change on first login.
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddUser(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleAddUser} disabled={!newName.trim() || !newEmail.trim()}
                  className="flex-1 rounded-lg bg-[#788023] py-2 text-sm text-white hover:bg-[#646b1d] disabled:opacity-40 transition-colors">Add Member</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 modal-backdrop">
          <div className="animate-scale-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-slate-800">Change Role</h2>
            <p className="mb-4 text-sm text-slate-500">{editingUser.name} ({editingUser.email})</p>
            <div className="space-y-2">
              {(["user", "manager", "admin"] as const).map((role) => (
                <button key={role} onClick={() => handleRoleChange(editingUser.id, role)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    editingUser.role === role ? "border-[#788023] bg-[#788023]/10" : "border-slate-200 hover:border-slate-300"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[role]}`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    {editingUser.role === role && <span className="text-[10px] text-[#788023]">Current</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowRoleModal(false); setEditingUser(null); }}
              className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- ARCHIVED LEADS SECTION ----------
function ArchivedLeadsSection({ leads, onRestore, onPermanentDelete }: { 
  leads: Lead[]; 
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}) {
  const archivedLeads = useMemo(() => leads.filter((l) => l.isArchived && !l.isDeleted), [leads]);
  
  if (archivedLeads.length === 0) {
    return <p className="text-sm text-slate-500 italic">No archived leads.</p>;
  }

  return (
    <div className="space-y-2">
      {archivedLeads.map((lead) => (
        <div key={lead.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{lead.leadName}</p>
            <p className="text-xs text-slate-500">{lead.companyName} • {lead.phoneNumber}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onRestore(lead.id)} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">
              Restore
            </button>
            <button onClick={() => onPermanentDelete(lead.id)} className="rounded bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-700">
              Delete Forever
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- SETTINGS VIEW ----------
export function SettingsView({ settings, onSettingsChange, leads, invoices, onResetData }: {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  leads: Lead[];
  invoices: Invoice[];
  onResetData: () => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"general" | "automation" | "company" | "invoicing" | "templates" | "visibility" | "data">("general");
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: val });
    setSaved(true);
  };

  useEffect(() => {
    if (saved) { const t = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(t); }
  }, [saved]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500">App configuration, automation, and data management</p>
        </div>
        {saved && <span className="animate-fade-in rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">✓ Saved</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { key: "general", label: "General", icon: "⚙️" },
          { key: "automation", label: "Automation", icon: "🤖" },
          { key: "company", label: "Company", icon: "🏢" },
          { key: "invoicing", label: "Invoicing", icon: "🧾" },
          { key: "templates", label: "Templates", icon: "📝" },
          { key: "visibility", label: "Visibility", icon: "👁️" },
          { key: "data", label: "Data", icon: "💾" },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setSettingsTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${settingsTab === tab.key ? "bg-[#788023] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ---- GENERAL ---- */}
      {settingsTab === "general" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Lead Defaults</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Default Lead Source</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.defaultLeadSource} onChange={(e) => update("defaultLeadSource", e.target.value as AppSettings["defaultLeadSource"])}>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Default Temperature</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.defaultTemperature} onChange={(e) => update("defaultTemperature", e.target.value as AppSettings["defaultTemperature"])}>
                  <option value="Hot">Hot 🔥</option><option value="Warm">Warm 🌤️</option><option value="Cold">Cold ❄️</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Default Service</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.defaultService} onChange={(e) => update("defaultService", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Currency</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.currency} onChange={(e) => update("currency", e.target.value)}>
                  <option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Date Format</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.dateFormat} onChange={(e) => update("dateFormat", e.target.value)}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Company Logo URL</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyLogoUrl} onChange={(e) => update("companyLogoUrl", e.target.value)} placeholder="/images/logo.png" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Display Preferences</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Default View on Login</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.defaultView || "dashboard"} onChange={(e) => update("defaultView", e.target.value as AppSettings["defaultView"])}>
                  <option value="dashboard">Dashboard</option><option value="mywork">My Work</option><option value="leads">Leads</option><option value="pipeline">Pipeline</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Lead Page Size</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.leadPageSize || 25} onChange={(e) => update("leadPageSize", Number(e.target.value) as AppSettings["leadPageSize"])}>
                  <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- AUTOMATION ---- */}
      {settingsTab === "automation" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Automation Rules</h3>
            <div className="space-y-3">
              {([
                { key: "autoMoveNewToContacted" as const, label: "Auto-move new leads to Contacted", desc: "Automatically change status from New to Contacted after first interaction" },
                { key: "enableSlaAlerts" as const, label: "Enable SLA alerts", desc: "Show warnings when leads exceed expected response times per stage" },
                { key: "enableDuplicateDetection" as const, label: "Enable duplicate detection", desc: "Show warnings when adding leads with matching phone, email, or name" },
                { key: "enableNeglectAlerts" as const, label: "Enable neglect alerts", desc: "Flag leads that haven't been contacted in too long" },
              ] as const).map((rule) => (
                <label key={rule.key} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#788023] focus:ring-[#788023]"
                    checked={settings[rule.key]} onChange={(e) => update(rule.key, e.target.checked)} />
                  <div>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{rule.label}</span>
                    <p className="text-[10px] text-slate-400">{rule.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Pipeline WIP Limits</h3>
            <p className="mb-3 text-xs text-slate-500">Set maximum leads per pipeline stage. Set 0 for unlimited.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(settings.pipelineWipLimits).map(([status, limit]) => (
                <div key={status}>
                  <label className="mb-1 block text-[10px] font-medium text-slate-600">{status}</label>
                  <input type="number" min={0} value={limit}
                    onChange={(e) => {
                      const newLimits = { ...settings.pipelineWipLimits, [status]: Number(e.target.value) || 0 };
                      update("pipelineWipLimits", newLimits);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="mb-2 text-sm font-semibold text-amber-700">⏱️ SLA Thresholds (per stage)</h3>
            <p className="mb-3 text-xs text-amber-600">Configure expected response times for each pipeline stage</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(settings.slaThresholds || {}).map(([stage, days]) => (
                <div key={stage}>
                  <label className="mb-1 block text-[10px] font-medium text-amber-700">{stage}</label>
                  <input type="number" min={0} value={days}
                    onChange={(e) => {
                      const newThresholds = { ...(settings.slaThresholds || {}), [stage]: Number(e.target.value) || 0 };
                      update("slaThresholds", newThresholds);
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm" />
                  <span className="text-[9px] text-amber-500">days</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- COMPANY ---- */}
      {settingsTab === "company" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Company Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Company Name</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyName} onChange={(e) => update("companyName", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Email</label><input type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyEmail} onChange={(e) => update("companyEmail", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Phone</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyPhone} onChange={(e) => update("companyPhone", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">GSTIN</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyGstin} onChange={(e) => update("companyGstin", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">PAN</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyPan} onChange={(e) => update("companyPan", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Website</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyWebsite || ""} onChange={(e) => update("companyWebsite", e.target.value)} placeholder="https://..." /></div>
              <div className="col-span-2"><label className="mb-1 block text-xs font-medium text-slate-600">Address</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyAddress} onChange={(e) => update("companyAddress", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Logo URL</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyLogoUrl} onChange={(e) => update("companyLogoUrl", e.target.value)} /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Industry</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.companyIndustry || ""} onChange={(e) => update("companyIndustry", e.target.value)} placeholder="Consulting, Technology, etc." /></div>
            </div>
          </div>
        </div>
      )}

      {/* ---- INVOICING ---- */}
      {settingsTab === "invoicing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Invoice Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Invoice Prefix</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.invoicePrefix} onChange={(e) => update("invoicePrefix", e.target.value)} placeholder="INV-" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Default GST Rate (%)</label>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={18} disabled />
                <p className="mt-1 text-[9px] text-slate-400">GST rate is 18% for services (CGST 9% + SGST 9%)</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payment Terms</label>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.paymentTerms || "Net 30"} onChange={(e) => update("paymentTerms", e.target.value)}>
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Invoice Notes</label>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={settings.invoiceNotes || ""} onChange={(e) => update("invoiceNotes", e.target.value)} placeholder="Thank you for your business!" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">GST / Supplier Profile</h3>
            <p className="mb-3 text-xs text-slate-400">Pre-fill these details when creating invoices</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Legal Name</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.legalName ?? settings.companyName} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">GSTIN</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.gstin ?? settings.companyGstin} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">State</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.state ?? ""} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">State Code</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.stateCode ?? ""} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Bank Name</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.bankName ?? ""} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">Bank Account</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.bankAccount ?? ""} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">IFSC</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.bankIfsc ?? ""} disabled /></div>
              <div><label className="mb-1 block text-xs font-medium text-slate-600">UPI ID</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50" value={settings.invoiceProfile?.upiId ?? ""} disabled /></div>
            </div>
            <p className="mt-3 text-[10px] text-slate-400 italic">Invoice profile is managed through SuperAdmin → Tenant settings. Company profile fields auto-populate.</p>
          </div>
        </div>
      )}

      {/* ---- TEMPLATES ---- */}
      {settingsTab === "templates" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">💬 WhatsApp Message Template</h3>
            <p className="mb-2 text-xs text-slate-400">Available variables: {"{{name}}"}, {"{{company}}"}, {"{{service}}"}, {"{{status}}"}, {"{{dealValue}}"}, {"{{date}}"}</p>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" rows={5}
              value={settings.whatsappTemplate} onChange={(e) => update("whatsappTemplate", e.target.value)}
              placeholder={`Hi {{name}},\nThank you for your interest in our {{service}} services.\n\nYour current status: {{status}}\nDeal Value: {{dealValue}}\n\nBest regards,\nYugam Consulting`} />
            <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <p className="font-medium mb-1">Preview:</p>
              <p className="font-mono text-[11px] whitespace-pre-line">
                {settings.whatsappTemplate
                  .replace(/\{\{name\}\}/g, "Priya Sharma")
                  .replace(/\{\{company\}\}/g, "TechVision India")
                  .replace(/\{\{service\}\}/g, "Digital Marketing")
                  .replace(/\{\{status\}\}/g, "Qualified")
                  .replace(/\{\{dealValue\}\}/g, "₹2,50,000")
                  .replace(/\{\{date\}\}/g, formatDateDisplay(todayISODate()))}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📧 Email Template</h3>
            <p className="mb-2 text-xs text-slate-400">Available variables: {"{{name}}"}, {"{{company}}"}, {"{{service}}"}, {"{{status}}"}, {"{{dealValue}}"}, {"{{date}}"}</p>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40" rows={7}
              value={settings.emailTemplate} onChange={(e) => update("emailTemplate", e.target.value)}
              placeholder={`Subject: Follow-up on {{service}} enquiry\n\nDear {{name}},\n\nThank you for your interest in our {{service}} services.\nCurrent status: {{status}}\n\nBest regards,\nYugam Consulting`} />
            <div className="mt-2 rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-700">
              <p className="font-medium mb-1">Preview:</p>
              <p className="font-mono text-[11px] whitespace-pre-line">
                {settings.emailTemplate
                  .replace(/\{\{name\}\}/g, "Priya Sharma")
                  .replace(/\{\{company\}\}/g, "TechVision India")
                  .replace(/\{\{service\}\}/g, "Digital Marketing")
                  .replace(/\{\{status\}\}/g, "Qualified")
                  .replace(/\{\{dealValue\}\}/g, "₹2,50,000")
                  .replace(/\{\{date\}\}/g, formatDateDisplay(todayISODate()))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- VISIBILITY ---- */}
      {settingsTab === "visibility" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Section Visibility</h3>
            <p className="mb-3 text-xs text-slate-400">Control which sections appear in the sidebar and their detail level</p>
            <div className="space-y-2">
              {(["mywork", "dashboard", "leads", "pipeline", "followups", "revenue", "invoices", "sources", "users"] as const).map((section) => (
                <div key={section} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-sm text-slate-700 capitalize">
                    {section === "mywork" ? "📋 My Work" : section === "followups" ? "📅 Follow-ups" : section === "dashboard" ? "📊 Dashboard" :
                     section === "leads" ? "👥 Leads" : section === "pipeline" ? "🔄 Pipeline" : section === "revenue" ? "💰 Revenue" :
                     section === "invoices" ? "🧾 Invoices" : section === "sources" ? "📡 Sources" : "🏢 Team & Users"}
                  </span>
                  <select value={settings.sectionVisibility[section]} onChange={(e) => {
                    const vis = { ...settings.sectionVisibility, [section]: e.target.value as "basic" | "advanced" | "hidden" };
                    update("sectionVisibility", vis);
                  }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#788023]">
                    <option value="basic">Basic</option>
                    <option value="advanced">Advanced</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Lead Table Columns</h3>
            <p className="mb-3 text-xs text-slate-400">Choose which optional columns to show in the leads table</p>
            <div className="flex flex-wrap gap-2">
              {(["source", "service", "temperature", "deal", "expected", "invoice", "tag"] as const).map((col) => (
                <button key={col} onClick={() => {
                  const cols = settings.leadOptionalColumns.includes(col)
                    ? settings.leadOptionalColumns.filter((c) => c !== col)
                    : [...settings.leadOptionalColumns, col];
                  update("leadOptionalColumns", cols);
                }} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  settings.leadOptionalColumns.includes(col) ? "border-[#788023] bg-[#788023]/10 text-[#788023] shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>
                  {col === "source" ? "📡 Source" : col === "service" ? "🔧 Service" : col === "temperature" ? "🌡️ Temperature" : col === "deal" ? "💰 Deal Value" : col === "expected" ? "📅 Expected Close" : col === "invoice" ? "🧾 Invoice Flow" : "🏷️ Follow-up Tag"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- DATA MANAGEMENT ---- */}
      {settingsTab === "data" && (
        <div className="space-y-4">
          {/* Archived Leads Section */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">🗄️ Archived Leads</h3>
            <p className="mb-3 text-xs text-slate-600">Manage soft-deleted leads. Restore or permanently delete.</p>
            <ArchivedLeadsSection leads={leads} onRestore={(id) => {
              const updated = leads.map(l => l.id === id ? { ...l, isArchived: false } : l);
              localStorage.setItem("lt_leads", JSON.stringify(updated));
              window.location.reload();
            }} onPermanentDelete={(id) => {
              const updated = leads.filter(l => l.id !== id);
              localStorage.setItem("lt_leads", JSON.stringify(updated));
              window.location.reload();
            }} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 card-hover">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">📊 Data Summary</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-sky-50 p-3 text-center">
                <p className="text-2xl font-bold text-sky-700">{leads.filter((l) => !l.isDeleted).length}</p>
                <p className="text-[10px] text-sky-500">Active Leads</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{leads.filter((l) => l.leadStatus === "Won" && !l.isDeleted).length}</p>
                <p className="text-[10px] text-emerald-500">Won</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-center">
                <p className="text-2xl font-bold text-rose-600">{leads.filter((l) => l.leadStatus === "Lost" && !l.isDeleted).length}</p>
                <p className="text-[10px] text-rose-500">Lost</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-3 text-center">
                <p className="text-2xl font-bold text-violet-700">{invoices.length}</p>
                <p className="text-[10px] text-violet-500">Invoices</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{formatInr(leads.filter((l) => !l.isDeleted).reduce((s, l) => s + l.dealValue, 0))}</p>
                <p className="text-[10px] text-amber-500">Pipeline Value</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{leads.filter((l) => l.isDeleted).length}</p>
                <p className="text-[10px] text-slate-400">Deleted</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 card-hover">
            <h3 className="mb-2 text-sm font-semibold text-amber-700">📦 Export Data</h3>
            <p className="mb-3 text-xs text-amber-600">Download all your data for backup or migration</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => {
                const data = { leads: leads.filter((l) => !l.isDeleted), invoices, settings, exportedAt: new Date().toISOString(), version: "2.0" };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leadtracker-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
              }} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 transition-colors">
                📦 Export All Data (JSON)
              </button>
              <button onClick={() => {
                const csvHeader = "Name,Company,Phone,Email,Source,Service,Status,Temperature,Deal Value,Added Date\n";
                const csvRows = leads.filter((l) => !l.isDeleted).map((l) =>
                  `"${l.leadName}","${l.companyName}","${l.phoneNumber}","${l.emailId}","${l.leadSource}","${l.serviceInterested}","${l.leadStatus}","${l.leadTemperature}",${l.dealValue},"${l.dateAdded}"`
                ).join("\n");
                const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                📊 Export Leads (CSV)
              </button>
              <button onClick={() => {
                const csvHeader = "Invoice #,Client,Amount,Status,Paid,Due Date\n";
                const csvRows = invoices.map((i) =>
                  `"${i.invoiceNumber}","${i.leadName}",${i.totalAmount},"${i.status}",${i.amountPaid || 0},"${i.dueDate || ""}"`
                ).join("\n");
                const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                🧾 Export Invoices (CSV)
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 card-hover">
            <h3 className="mb-2 text-sm font-semibold text-sky-700">📥 Import Data</h3>
            <p className="mb-3 text-xs text-sky-600">Import leads or invoices from CSV files</p>
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700 transition-colors">
                📥 Import Leads (CSV)
                <input type="file" accept=".csv" className="hidden" />
              </label>
              <label className="cursor-pointer rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm text-sky-700 hover:bg-sky-50 transition-colors">
                📥 Import Invoices (CSV)
                <input type="file" accept=".csv" className="hidden" />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 card-hover">
            <h3 className="mb-2 text-sm font-semibold text-rose-700">⚠️ Danger Zone</h3>
            <p className="mb-3 text-xs text-rose-600">These actions are irreversible. Please make sure you have a backup before proceeding.</p>
            <div className="flex gap-2 flex-wrap">
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 transition-colors">
                  ⚠️ Reset All Data
                </button>
              ) : (
                <>
                  <button onClick={() => { onResetData(); setConfirmReset(false); }} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 animate-pulse">
                    ⚠️ Confirm Reset — Delete Everything
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm text-rose-700 hover:bg-rose-50">
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
