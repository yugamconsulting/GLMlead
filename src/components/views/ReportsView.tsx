// @ts-nocheck
// =====================================================================
// REPORTS VIEW — Comprehensive reporting module
// Conversion funnel, revenue trends, team performance, source analytics,
// pipeline velocity, win/loss analysis, lead aging, collection report,
// custom date range, CSV export, printable layouts
// =====================================================================
import { useState, useMemo, useCallback } from "react";
import type { Lead, Invoice } from "../../types/index";
import {
  formatInr, todayISODate, daysSince,
  isOpenLeadStatus, leadHealthScore, leadSlaTier,
} from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type ReportTab = "overview" | "conversion" | "revenue" | "team" | "source" | "aging" | "pipeline-velocity" | "collection";
type DateRange = "7d" | "30d" | "90d" | "mtd" | "qtd" | "ytd" | "all";

interface ReportFilter {
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  source: string;
  owner: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 Days", "30d": "Last 30 Days", "90d": "Last 90 Days",
  mtd: "Month to Date", qtd: "Quarter to Date", ytd: "Year to Date", all: "All Time",
};

const TAB_CONFIG: { key: ReportTab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "conversion", label: "Conversion", icon: "🔄" },
  { key: "revenue", label: "Revenue", icon: "💰" },
  { key: "team", label: "Team", icon: "👥" },
  { key: "source", label: "Source", icon: "📡" },
  { key: "aging", label: "Aging", icon: "⏳" },
  { key: "pipeline-velocity", label: "Velocity", icon: "⚡" },
  { key: "collection", label: "Collection", icon: "🏦" },
];

const SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "WhatsApp", "Facebook", "Instagram"];
const TEMP_COLORS: Record<string, string> = { Hot: "text-rose-600", Warm: "text-amber-600", Cold: "text-sky-600" };
const STAGE_COLORS: Record<string, string> = {
  New: "bg-slate-100 text-slate-700", Contacted: "bg-blue-100 text-blue-700",
  Qualified: "bg-indigo-100 text-indigo-700", "Proposal Sent": "bg-violet-100 text-violet-700",
  Negotiation: "bg-amber-100 text-amber-700", Confirmation: "bg-orange-100 text-orange-700",
  "Invoice Sent": "bg-cyan-100 text-cyan-700", Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-red-100 text-red-700",
};

/* ------------------------------------------------------------------ */
/* Utility helpers                                                    */
/* ------------------------------------------------------------------ */
// Normalise data to use short property names throughout this file
function normLead(l: any) {
  return { ...l, name: l.leadName, company: l.companyName, source: l.leadSource, status: l.leadStatus, temperature: l.leadTemperature };
}
function normInv(i: any) {
  return { ...i, total: i.totalAmount, paidAmount: i.amountPaid, invoiceDate: i.issueDate, clientName: i.leadName || i.customerLegalName || "" };
}

function getDateFromRange(range: DateRange): string {
  const d = new Date();
  switch (range) {
    case "7d": d.setDate(d.getDate() - 7); break;
    case "30d": d.setDate(d.getDate() - 30); break;
    case "90d": d.setDate(d.getDate() - 90); break;
    case "mtd": d.setDate(1); break;
    case "qtd": d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); break;
    case "ytd": d.setMonth(0, 1); break;
    case "all": return "2000-01-01";
  }
  return d.toISOString().slice(0, 10);
}

function filterByDate<T extends { createdAt: string }>(items: T[], filter: ReportFilter): T[] {
  const start = filter.startDate || "2000-01-01";
  const end = filter.endDate || todayISODate();
  return items.filter(i => i.createdAt >= start && i.createdAt <= end + "T23:59:59");
}

// Helper: access lead properties with correct names
const lName = (l: any) => l.leadName || "";
const lCompany = (l: any) => l.companyName || "";
const lSource = (l: any) => l.leadSource || "";
const lStatus = (l: any) => l.leadStatus || "";
const lTemp = (l: any) => l.leadTemperature || "";
const iTotal = (i: any) => i.totalAmount || 0;
const iPaid = (i: any) => i.amountPaid || 0;
const iDate = (i: any) => i.issueDate || i.createdAt;
const iClient = (i: any) => i.leadName || i.customerLegalName || "";

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KPI({ label, value, sub, color = "text-slate-800" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, color = "bg-brand-500" }: { value: number; max: number; color?: string }) {
  const w = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${w}%` }} />
    </div>
  );
}

function ExportButton({ data, filename }: { data: string; filename: string }) {
  const handleExport = useCallback(() => {
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [data, filename]);
  return (
    <button onClick={handleExport}
      className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
      📥 Export CSV
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Filter bar                                                         */
/* ------------------------------------------------------------------ */
function FilterBar({ filter, setFilter }: { filter: ReportFilter; setFilter: (f: ReportFilter) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Period:</span>
        <select value={filter.dateRange}
          onChange={e => {
            const dr = e.target.value as DateRange;
            setFilter({ ...filter, dateRange: dr, startDate: getDateFromRange(dr), endDate: todayISODate() });
          }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          {Object.entries(DATE_RANGE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">From:</span>
        <input type="date" value={filter.startDate}
          onChange={e => setFilter({ ...filter, startDate: e.target.value, dateRange: "all" })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">To:</span>
        <input type="date" value={filter.endDate}
          onChange={e => setFilter({ ...filter, endDate: e.target.value, dateRange: "all" })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Source:</span>
        <select value={filter.source}
          onChange={e => setFilter({ ...filter, source: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Owner:</span>
        <select value={filter.owner}
          onChange={e => setFilter({ ...filter, owner: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">All Owners</option>
          <option value="admin@oruyugam.com">Admin</option>
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Report                                                    */
/* ------------------------------------------------------------------ */
function OverviewReport({ leads, invoices, filter }: {
  leads: Lead[]; invoices: Invoice[]; filter: ReportFilter;
}) {
  const filtered = useMemo(() => {
    let result = filterByDate(leads, filter);
    if (filter.source) result = result.filter(l => l.source === filter.source);
    if (filter.owner) result = result.filter(l => l.assignedTo === filter.owner);
    return result;
  }, [leads, filter]);

  const total = filtered.length;
  const open = filtered.filter(l => isOpenLeadStatus(l.status)).length;
  const won = filtered.filter(l => l.status === "Won").length;
  const lost = filtered.filter(l => l.status === "Lost").length;
  const wonValue = filtered.filter(l => l.status === "Won").reduce((s, l) => s + (l.dealValue || 0), 0);
  const pipelineValue = filtered.filter(l => isOpenLeadStatus(l.status)).reduce((s, l) => s + (l.dealValue || 0), 0);
  const convRate = total - lost > 0 ? won / (total - lost) * 100 : 0;
  const avgDeal = won > 0 ? wonValue / won : 0;
  const avgDays = won > 0
    ? filtered.filter(l => l.status === "Won")
        .reduce((s, l) => s + daysSince(l.createdAt), 0) / won
    : 0;

  const hotCount = filtered.filter(l => l.temperature === "Hot").length;
  const warmCount = filtered.filter(l => l.temperature === "Warm").length;
  const coldCount = filtered.filter(l => l.temperature === "Cold").length;

  const stageCounts: Record<string, number> = {};
  filtered.forEach(l => { stageCounts[l.status] = (stageCounts[l.status] || 0) + 1; });

  const stages = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won", "Lost"];
  const maxStageCount = Math.max(...stages.map(s => stageCounts[s] || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="Total Leads" value={total} />
        <KPI label="Open" value={open} color="text-blue-600" />
        <KPI label="Won" value={won} color="text-emerald-600" />
        <KPI label="Lost" value={lost} color="text-red-600" />
        <KPI label="Pipeline" value={formatInr(pipelineValue)} color="text-brand-600" />
        <KPI label="Won Revenue" value={formatInr(wonValue)} color="text-emerald-600" />
        <KPI label="Conv. Rate" value={`${convRate.toFixed(1)}%`} />
      </div>

      {/* Stage Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Stage Distribution</h3>
        <div className="space-y-2">
          {stages.map(stage => (
            <div key={stage} className="flex items-center gap-3">
              <div className={`w-28 text-xs font-medium px-2 py-1 rounded-lg ${STAGE_COLORS[stage] || "bg-slate-100"}`}>
                {stage}
              </div>
              <div className="flex-1">
                <MiniBar value={stageCounts[stage] || 0} max={maxStageCount}
                  color={stage === "Won" ? "bg-emerald-500" : stage === "Lost" ? "bg-red-400" : "bg-brand-400"} />
              </div>
              <div className="w-10 text-right text-xs font-semibold text-slate-600">{stageCounts[stage] || 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Temperature Split + Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Temperature Distribution</h3>
          <div className="space-y-3">
            {[
              { label: "Hot", count: hotCount, color: "bg-rose-500", icon: "🔥" },
              { label: "Warm", count: warmCount, color: "bg-amber-500", icon: "🌤️" },
              { label: "Cold", count: coldCount, color: "bg-sky-500", icon: "❄️" },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-3">
                <span className="text-lg">{t.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{t.label}</span>
                    <span className="text-xs font-bold text-slate-700">{t.count}</span>
                  </div>
                  <MiniBar value={t.count} max={Math.max(hotCount, warmCount, coldCount, 1)} color={t.color} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Avg Deal Size</div>
              <div className="text-lg font-bold text-slate-800">{formatInr(avgDeal)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg Days to Close</div>
              <div className="text-lg font-bold text-slate-800">{avgDays.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Pipeline Value</div>
              <div className="text-lg font-bold text-brand-600">{formatInr(pipelineValue)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Win Rate</div>
              <div className="text-lg font-bold text-emerald-600">{convRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conversion Funnel Report                                           */
/* ------------------------------------------------------------------ */
function ConversionReport({ leads, filter }: { leads: Lead[]; filter: ReportFilter }) {
  const filtered = useMemo(() => {
    let result = filterByDate(leads, filter);
    if (filter.source) result = result.filter(l => l.source === filter.source);
    return result;
  }, [leads, filter]);

  const stages = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won"];
  const stageCounts = stages.map(s => filtered.filter(l => l.status === s).length);
  const maxCount = Math.max(...stageCounts, 1);

  const stageToStageConv: { from: string; to: string; rate: string }[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stageCounts[i];
    const to = stageCounts[i + 1];
    stageToStageConv.push({
      from: stages[i], to: stages[i + 1],
      rate: from === 0 ? "N/A" : `${((to / from) * 100).toFixed(1)}%`,
    });
  }

  const overallConv = filtered.length > 0
    ? ((filtered.filter(l => l.status === "Won").length / filtered.length) * 100).toFixed(1)
    : "0";

  const csvData = "Stage,Count,Conversion to Next\n" +
    stages.map((s, i) => `${s},${stageCounts[i]},${i < stages.length - 1 ? stageToStageConv[i].rate : "N/A"}`).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total Entered" value={filtered.length} />
        <KPI label="Reached Won" value={filtered.filter(l => l.status === "Won").length} color="text-emerald-600" />
        <KPI label="Overall Conv." value={`${overallConv}%`} color="text-brand-600" />
        <KPI label="Lost" value={filtered.filter(l => l.status === "Lost").length} color="text-red-600" />
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Conversion Funnel</h3>
          <ExportButton data={csvData} filename="conversion-funnel.csv" />
        </div>
        <div className="space-y-2">
          {stages.map((stage, i) => {
            const count = stageCounts[i];
            const widthPct = maxCount === 0 ? 0 : (count / maxCount) * 100;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium text-slate-600 text-right">{stage}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="h-8 bg-brand-100 rounded-lg flex items-center transition-all relative overflow-hidden"
                    style={{ width: `${Math.max(widthPct, 5)}%` }}>
                    <div className="absolute inset-0 bg-brand-400 opacity-30 rounded-lg" />
                    <span className="relative text-xs font-bold text-brand-800 pl-2">{count}</span>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className="w-16 text-xs text-slate-500 text-right">
                    → {stageToStageConv[i].rate}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage-to-Stage Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Stage-to-Stage Conversion</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">From</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">To</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {stageToStageConv.map((row, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 px-3">{row.from}</td>
                  <td className="py-2 px-3">{row.to}</td>
                  <td className="py-2 px-3 text-right font-semibold">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Source */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Conversion by Source</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Source</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Total</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Won</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Lost</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(source => {
                const srcLeads = filtered.filter(l => l.source === source);
                const srcWon = srcLeads.filter(l => l.status === "Won").length;
                const srcLost = srcLeads.filter(l => l.status === "Lost").length;
                const srcConv = srcLeads.length - srcLost > 0
                  ? ((srcWon / (srcLeads.length - srcLost)) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={source} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">{source}</td>
                    <td className="py-2 px-3 text-right">{srcLeads.length}</td>
                    <td className="py-2 px-3 text-right text-emerald-600">{srcWon}</td>
                    <td className="py-2 px-3 text-right text-red-500">{srcLost}</td>
                    <td className="py-2 px-3 text-right font-semibold">{srcConv}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Revenue Report                                                     */
/* ------------------------------------------------------------------ */
function RevenueReport({ leads, invoices, filter }: {
  leads: Lead[]; invoices: Invoice[]; filter: ReportFilter;
}) {
  const filteredLeads = useMemo(() => {
    let result = filterByDate(leads, filter);
    if (filter.source) result = result.filter(l => l.source === filter.source);
    return result;
  }, [leads, filter]);

  const wonLeads = filteredLeads.filter(l => l.status === "Won");
  const totalRevenue = wonLeads.reduce((s, l) => s + (l.dealValue || 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const outstanding = totalInvoiced - totalCollected;
  const avgDealSize = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;
  const maxDeal = Math.max(...wonLeads.map(l => l.dealValue || 0), 0);
  const collectionEff = totalInvoiced > 0 ? (totalCollected / totalInvoiced * 100).toFixed(1) : "0";

  // Monthly revenue
  const monthlyRev: Record<string, number> = {};
  wonLeads.forEach(l => {
    const m = l.createdAt.slice(0, 7);
    monthlyRev[m] = (monthlyRev[m] || 0) + (l.dealValue || 0);
  });
  const months = Object.keys(monthlyRev).sort();
  const maxMonthRev = Math.max(...Object.values(monthlyRev), 1);

  // Revenue by source
  const revBySource: Record<string, { won: number; count: number }> = {};
  wonLeads.forEach(l => {
    if (!revBySource[l.source]) revBySource[l.source] = { won: 0, count: 0 };
    revBySource[l.source].won += l.dealValue || 0;
    revBySource[l.source].count += 1;
  });

  const csvData = "Month,Revenue\n" + months.map(m => `${m},${monthlyRev[m]}`).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="Total Revenue" value={formatInr(totalRevenue)} color="text-emerald-600" />
        <KPI label="Invoiced" value={formatInr(totalInvoiced)} />
        <KPI label="Collected" value={formatInr(totalCollected)} color="text-blue-600" />
        <KPI label="Outstanding" value={formatInr(outstanding)} color="text-red-600" />
        <KPI label="Avg Deal Size" value={formatInr(avgDealSize)} />
        <KPI label="Collection Eff." value={`${collectionEff}%`} />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Monthly Revenue</h3>
          <ExportButton data={csvData} filename="monthly-revenue.csv" />
        </div>
        {months.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-8">No revenue data for selected period</div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {months.map(m => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-medium text-slate-600">{formatInr(monthlyRev[m])}</div>
                <div className="w-full bg-brand-400 rounded-t-lg transition-all"
                  style={{ height: `${(monthlyRev[m] / maxMonthRev) * 160}px` }} />
                <div className="text-[10px] text-slate-400">{m.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue by Source */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Revenue by Source</h3>
        <div className="space-y-3">
          {Object.entries(revBySource)
            .sort((a, b) => b[1].won - a[1].won)
            .map(([source, data]) => (
              <div key={source} className="flex items-center gap-3">
                <div className="w-28 text-xs font-medium text-slate-600">{source}</div>
                <div className="flex-1">
                  <MiniBar value={data.won} max={maxDeal || 1} color="bg-emerald-400" />
                </div>
                <div className="w-24 text-right text-xs font-semibold text-emerald-700">{formatInr(data.won)}</div>
                <div className="w-16 text-right text-xs text-slate-500">{data.count} deals</div>
              </div>
            ))}
        </div>
      </div>

      {/* Top Deals */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Won Deals</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Lead</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Company</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Source</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Deal Value</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Days to Close</th>
              </tr>
            </thead>
            <tbody>
              {wonLeads
                .sort((a, b) => (b.dealValue || 0) - (a.dealValue || 0))
                .slice(0, 15)
                .map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">{l.name}</td>
                    <td className="py-2 px-3">{l.company || "-"}</td>
                    <td className="py-2 px-3">{l.source}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-600">{formatInr(l.dealValue || 0)}</td>
                    <td className="py-2 px-3 text-right">{daysSince(l.createdAt).toFixed(0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Team Report                                                        */
/* ------------------------------------------------------------------ */
function TeamReport({ leads, filter }: { leads: Lead[]; filter: ReportFilter }) {
  const filtered = useMemo(() => {
    let result = filterByDate(leads, filter);
    if (filter.source) result = result.filter(l => l.source === filter.source);
    return result;
  }, [leads, filter]);

  const owners = [...new Set(filtered.map(l => l.assignedTo || "Unassigned"))];
  const ownerStats = owners.map(owner => {
    const oLeads = filtered.filter(l => (l.assignedTo || "Unassigned") === owner);
    const won = oLeads.filter(l => l.status === "Won");
    const lost = oLeads.filter(l => l.status === "Lost");
    const open = oLeads.filter(l => isOpenLeadStatus(l.status));
    const wonRevenue = won.reduce((s, l) => s + (l.dealValue || 0), 0);
    const pipelineValue = open.reduce((s, l) => s + (l.dealValue || 0), 0);
    const winRate = oLeads.length - lost.length > 0
      ? (won.length / (oLeads.length - lost.length) * 100).toFixed(1)
      : "0.0";
    const avgDays = won.length > 0
      ? won.reduce((s, l) => s + daysSince(l.createdAt), 0) / won.length
      : 0;
    const avgHealth = oLeads.length > 0
      ? oLeads.reduce((s, l) => s + leadHealthScore(l), 0) / oLeads.length
      : 0;
    return {
      owner, total: oLeads.length, open: open.length, won: won.length, lost: lost.length,
      wonRevenue, pipelineValue, winRate, avgDays, avgHealth,
      hot: oLeads.filter(l => l.temperature === "Hot").length,
    };
  }).sort((a, b) => b.wonRevenue - a.wonRevenue);

  const csvData = "Owner,Total,Open,Won,Lost,Win Rate,Won Revenue,Pipeline Value,Avg Days\n" +
    ownerStats.map(o => `${o.owner},${o.total},${o.open},${o.won},${o.lost},${o.winRate}%,${o.wonRevenue},${o.pipelineValue},${o.avgDays.toFixed(1)}`).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <ExportButton data={csvData} filename="team-performance.csv" />
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Team Leaderboard</h3>
        <div className="space-y-4">
          {ownerStats.map((stat, i) => (
            <div key={stat.owner} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                    ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-300"}`}>
                    #{i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{stat.owner}</div>
                    <div className="text-xs text-slate-500">{stat.total} leads · {stat.hot} hot</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-600">{formatInr(stat.wonRevenue)}</div>
                  <div className="text-xs text-slate-400">won revenue</div>
                </div>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-xs">
                <div><span className="text-slate-400">Open</span><div className="font-semibold">{stat.open}</div></div>
                <div><span className="text-slate-400">Won</span><div className="font-semibold text-emerald-600">{stat.won}</div></div>
                <div><span className="text-slate-400">Lost</span><div className="font-semibold text-red-500">{stat.lost}</div></div>
                <div><span className="text-slate-400">Win Rate</span><div className="font-semibold">{stat.winRate}%</div></div>
                <div><span className="text-slate-400">Pipeline</span><div className="font-semibold text-brand-600">{formatInr(stat.pipelineValue)}</div></div>
                <div><span className="text-slate-400">Avg Days</span><div className="font-semibold">{stat.avgDays.toFixed(0)}</div></div>
                <div><span className="text-slate-400">Health</span><div className="font-semibold">{stat.avgHealth.toFixed(0)}</div></div>
                <div><span className="text-slate-400">Hot</span><div className="font-semibold text-rose-600">{stat.hot}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Source Report                                                      */
/* ------------------------------------------------------------------ */
function SourceReport({ leads, filter }: { leads: Lead[]; filter: ReportFilter }) {
  const filtered = useMemo(() => filterByDate(leads, filter), [leads, filter]);

  const sourceStats = SOURCES.map(source => {
    const sLeads = filtered.filter(l => l.source === source);
    const won = sLeads.filter(l => l.status === "Won");
    const lost = sLeads.filter(l => l.status === "Lost");
    const open = sLeads.filter(l => isOpenLeadStatus(l.status));
    const wonRevenue = won.reduce((s, l) => s + (l.dealValue || 0), 0);
    const pipelineValue = open.reduce((s, l) => s + (l.dealValue || 0), 0);
    const avgDeal = won.length > 0 ? wonRevenue / won.length : 0;
    const convRate = sLeads.length > 0 ? (won.length / sLeads.length * 100).toFixed(1) : "0.0";
    const avgDays = won.length > 0
      ? won.reduce((s, l) => s + daysSince(l.createdAt), 0) / won.length : 0;
    const avgHealth = sLeads.length > 0
      ? sLeads.reduce((s, l) => s + leadHealthScore(l), 0) / sLeads.length : 0;
    return { source, total: sLeads.length, open: open.length, won: won.length, lost: lost.length,
      wonRevenue, pipelineValue, avgDeal, convRate, avgDays, avgHealth };
  }).sort((a, b) => b.wonRevenue - a.wonRevenue);

  const maxTotal = Math.max(...sourceStats.map(s => s.total), 1);

  const csvData = "Source,Total,Open,Won,Lost,Conv%,Won Revenue,Avg Deal,Avg Days\n" +
    sourceStats.map(s => `${s.source},${s.total},${s.open},${s.won},${s.lost},${s.convRate}%,${s.wonRevenue},${s.avgDeal},${s.avgDays.toFixed(0)}`).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end"><ExportButton data={csvData} filename="source-report.csv" /></div>

      {/* Visual Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Leads by Source</h3>
        <div className="space-y-3">
          {sourceStats.map(s => (
            <div key={s.source} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-slate-600">{s.source}</div>
              <div className="flex-1">
                <MiniBar value={s.total} max={maxTotal} color="bg-brand-400" />
              </div>
              <div className="w-12 text-right text-xs font-bold">{s.total}</div>
              <div className="w-12 text-right text-xs text-emerald-600">{s.won} won</div>
              <div className="w-12 text-right text-xs text-red-500">{s.lost} lost</div>
              <div className="w-20 text-right text-xs font-semibold text-brand-600">{formatInr(s.wonRevenue)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Source Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Source</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Leads</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Open</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Won</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Lost</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Conv %</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Revenue</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Avg Deal</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Avg Days</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Health</th>
              </tr>
            </thead>
            <tbody>
              {sourceStats.map(s => (
                <tr key={s.source} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium">{s.source}</td>
                  <td className="py-2 px-3 text-right">{s.total}</td>
                  <td className="py-2 px-3 text-right text-blue-600">{s.open}</td>
                  <td className="py-2 px-3 text-right text-emerald-600">{s.won}</td>
                  <td className="py-2 px-3 text-right text-red-500">{s.lost}</td>
                  <td className="py-2 px-3 text-right font-semibold">{s.convRate}%</td>
                  <td className="py-2 px-3 text-right text-emerald-700">{formatInr(s.wonRevenue)}</td>
                  <td className="py-2 px-3 text-right">{formatInr(s.avgDeal)}</td>
                  <td className="py-2 px-3 text-right">{s.avgDays.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right">{s.avgHealth.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aging Report                                                       */
/* ------------------------------------------------------------------ */
function AgingReport({ leads, filter }: { leads: Lead[]; filter: ReportFilter }) {
  const filtered = useMemo(() => {
    let result = filterByDate(leads, filter);
    return result.filter(l => isOpenLeadStatus(l.status));
  }, [leads, filter]);

  const buckets = [
    { label: "0-3 days", min: 0, max: 3, color: "bg-emerald-500" },
    { label: "4-7 days", min: 4, max: 7, color: "bg-emerald-400" },
    { label: "8-14 days", min: 8, max: 14, color: "bg-amber-500" },
    { label: "15-21 days", min: 15, max: 21, color: "bg-orange-500" },
    { label: "22-30 days", min: 22, max: 30, color: "bg-red-400" },
    { label: "30+ days", min: 31, max: 9999, color: "bg-red-600" },
  ];

  const bucketData = buckets.map(b => {
    const items = filtered.filter(l => {
      const age = daysSince(l.createdAt);
      return age >= b.min && age <= b.max;
    });
    return { ...b, count: items.length, value: items.reduce((s, l) => s + (l.dealValue || 0), 0), leads: items };
  });
  const maxBucketCount = Math.max(...bucketData.map(b => b.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Aging Buckets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Lead Aging Analysis</h3>
        <div className="space-y-3">
          {bucketData.map(b => (
            <div key={b.label} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${b.color}`} />
                  <span className="text-xs font-medium text-slate-700">{b.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold">{b.count} leads</span>
                  <span className="text-slate-500">{formatInr(b.value)}</span>
                </div>
              </div>
              <MiniBar value={b.count} max={maxBucketCount} color={b.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Oldest Leads */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Oldest Open Leads (Top 15)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Lead</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Company</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Stage</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Temp</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Age (days)</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Deal Value</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Health</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">SLA</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .sort((a, b) => daysSince(a.createdAt) - daysSince(b.createdAt))
                .reverse()
                .slice(0, 15)
                .map(l => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium">{l.name}</td>
                    <td className="py-2 px-3">{l.company || "-"}</td>
                    <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STAGE_COLORS[l.status] || ""}`}>{l.status}</span></td>
                    <td className={`py-2 px-3 font-medium ${TEMP_COLORS[l.temperature] || ""}`}>{l.temperature}</td>
                    <td className="py-2 px-3 text-right font-semibold">{daysSince(l.createdAt).toFixed(0)}</td>
                    <td className="py-2 px-3 text-right">{formatInr(l.dealValue || 0)}</td>
                    <td className="py-2 px-3 text-right">{leadHealthScore(l).toFixed(0)}</td>
                    <td className="py-2 px-3 text-right">{leadSlaTier(l)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline Velocity Report                                           */
/* ------------------------------------------------------------------ */
function VelocityReport({ leads, filter }: { leads: Lead[]; filter: ReportFilter }) {
  const filtered = useMemo(() => filterByDate(leads, filter), [leads, filter]);

  const stages = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent"];
  const velocityData = stages.map(stage => {
    const stageLeads = filtered.filter(l => l.status === stage);
    const count = stageLeads.length;
    const avgDays = count > 0
      ? stageLeads.reduce((s, l) => s + daysSince(l.createdAt), 0) / count
      : 0;
    const totalValue = stageLeads.reduce((s, l) => s + (l.dealValue || 0), 0);
    const hotCount = stageLeads.filter(l => l.temperature === "Hot").length;
    return { stage, count, avgDays, totalValue, hotCount };
  });

  const wonLeads = filtered.filter(l => l.status === "Won");
  const avgCloseDays = wonLeads.length > 0
    ? wonLeads.reduce((s, l) => s + daysSince(l.createdAt), 0) / wonLeads.length
    : 0;

  // Weekly velocity (leads added per week, last 8 weeks)
  const weeklyAdded: { week: string; count: number }[] = [];
  const weeklyWon: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const ws = weekStart.toISOString().slice(0, 10);
    const we = weekEnd.toISOString().slice(0, 10);
    const label = `W${8 - i}`;
    weeklyAdded.push({ week: label, count: filtered.filter(l => l.createdAt >= ws && l.createdAt <= we + "T23:59:59").length });
    weeklyWon.push({ week: label, count: filtered.filter(l => l.status === "Won" && l.createdAt >= ws && l.createdAt <= we + "T23:59:59").length });
  }
  const maxWeekly = Math.max(...weeklyAdded.map(w => w.count), ...weeklyWon.map(w => w.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Avg Close Time" value={`${avgCloseDays.toFixed(0)} days`} color="text-brand-600" />
        <KPI label="Open Pipeline" value={filtered.filter(l => isOpenLeadStatus(l.status)).length} />
        <KPI label="Pipeline Value" value={formatInr(filtered.filter(l => isOpenLeadStatus(l.status)).reduce((s, l) => s + (l.dealValue || 0), 0))} />
        <KPI label="Velocity Score" value={`${(filtered.length / 8).toFixed(1)}/wk`} />
      </div>

      {/* Stage Velocity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Average Age by Stage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Stage</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Count</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Avg Age (days)</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Pipeline Value</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Hot Leads</th>
              </tr>
            </thead>
            <tbody>
              {velocityData.map(v => (
                <tr key={v.stage} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 px-3 font-medium"><span className={`px-2 py-0.5 rounded text-[10px] ${STAGE_COLORS[v.stage] || ""}`}>{v.stage}</span></td>
                  <td className="py-2 px-3 text-right">{v.count}</td>
                  <td className="py-2 px-3 text-right font-semibold">{v.avgDays.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-brand-600">{formatInr(v.totalValue)}</td>
                  <td className="py-2 px-3 text-right text-rose-600">{v.hotCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Velocity Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Weekly Velocity (Added vs Won)</h3>
        <div className="flex items-end gap-3 h-48">
          {weeklyAdded.map((w, i) => (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end h-36">
                <div className="w-4 bg-brand-400 rounded-t transition-all"
                  style={{ height: `${(w.count / maxWeekly) * 140}px` }} title={`Added: ${w.count}`} />
                <div className="w-4 bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${(weeklyWon[i].count / maxWeekly) * 140}px` }} title={`Won: ${weeklyWon[i].count}`} />
              </div>
              <div className="text-[10px] text-slate-400">{w.week}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-400 rounded" /> Added</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded" /> Won</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collection Report                                                  */
/* ------------------------------------------------------------------ */
function CollectionReport({ invoices, filter }: { invoices: Invoice[]; filter: ReportFilter }) {
  const filtered = useMemo(() => {
    let result = filterByDate(invoices, filter);
    return result;
  }, [invoices, filter]);

  const totalInvoiced = filtered.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = filtered.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const outstanding = totalInvoiced - totalCollected;
  const overdue = filtered.filter(i => {
    if (i.status === "Paid") return false;
    const days = daysSince(i.invoiceDate || i.createdAt);
    return days > 30;
  }).reduce((s, i) => s + ((i.total || 0) - (i.paidAmount || 0)), 0);

  const collectionEff = totalInvoiced > 0 ? (totalCollected / totalInvoiced * 100).toFixed(1) : "0";
  const avgCollectionDays = filtered.filter(i => i.status === "Paid").length > 0
    ? filtered.filter(i => i.status === "Paid")
        .reduce((s, i) => s + daysSince(i.invoiceDate || i.createdAt), 0) /
      filtered.filter(i => i.status === "Paid").length
    : 0;

  // Aging buckets for outstanding
  const agingBuckets = [
    { label: "Current (0-7)", min: 0, max: 7 },
    { label: "8-15 days", min: 8, max: 15 },
    { label: "16-30 days", min: 16, max: 30 },
    { label: "31-45 days", min: 31, max: 45 },
    { label: "46-60 days", min: 46, max: 60 },
    { label: "60+ days", min: 61, max: 9999 },
  ];

  const unpaid = filtered.filter(i => i.status !== "Paid" && i.status !== "Cancelled" && i.status !== "Draft");
  const agingData = agingBuckets.map(b => {
    const items = unpaid.filter(i => {
      const age = daysSince(i.dueDate || i.invoiceDate || i.createdAt);
      return age >= b.min && age <= b.max;
    });
    return { ...b, count: items.length, amount: items.reduce((s, i) => s + ((i.total || 0) - (i.paidAmount || 0)), 0) };
  });

  const csvData = "Bucket,Count,Amount\n" + agingData.map(a => `${a.label},${a.count},${a.amount}`).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="Total Invoiced" value={formatInr(totalInvoiced)} />
        <KPI label="Collected" value={formatInr(totalCollected)} color="text-emerald-600" />
        <KPI label="Outstanding" value={formatInr(outstanding)} color="text-amber-600" />
        <KPI label="Overdue (>30d)" value={formatInr(overdue)} color="text-red-600" />
        <KPI label="Collection Eff." value={`${collectionEff}%`} color="text-brand-600" />
        <KPI label="Avg Coll. Days" value={avgCollectionDays.toFixed(0)} />
      </div>

      {/* Collection Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Collection Progress</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-slate-100 rounded-full h-6 relative overflow-hidden">
              <div className="bg-emerald-500 h-6 rounded-full transition-all flex items-center justify-center"
                style={{ width: `${Math.min(100, parseFloat(collectionEff))}%` }}>
                <span className="text-xs font-bold text-white">{collectionEff}%</span>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Collected: {formatInr(totalCollected)}</span>
              <span>Outstanding: {formatInr(outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Outstanding Aging</h3>
          <ExportButton data={csvData} filename="collection-aging.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Aging Bucket</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Count</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {agingData.map(a => (
                <tr key={a.label} className="border-b border-slate-50">
                  <td className="py-2 px-3 font-medium">{a.label}</td>
                  <td className="py-2 px-3 text-right">{a.count}</td>
                  <td className="py-2 px-3 text-right font-semibold">{formatInr(a.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 px-3">Total Outstanding</td>
                <td className="py-2 px-3 text-right">{unpaid.length}</td>
                <td className="py-2 px-3 text-right text-amber-700">{formatInr(outstanding)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Outstanding Invoices</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Invoice #</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Client</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Total</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Paid</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Balance</th>
                <th className="text-right py-2 px-3 font-semibold text-slate-600">Days Overdue</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {unpaid
                .sort((a, b) => daysSince(a.dueDate || a.invoiceDate || a.createdAt) - daysSince(b.dueDate || b.invoiceDate || b.createdAt))
                .reverse()
                .slice(0, 20)
                .map(inv => {
                  const age = daysSince(inv.dueDate || inv.invoiceDate || inv.createdAt);
                  const balance = (inv.total || 0) - (inv.paidAmount || 0);
                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="py-2 px-3">{inv.clientName}</td>
                      <td className="py-2 px-3 text-right">{formatInr(inv.total || 0)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatInr(inv.paidAmount || 0)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-amber-700">{formatInr(balance)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={age > 30 ? "text-red-600 font-semibold" : age > 14 ? "text-amber-600" : "text-slate-600"}>
                          {age}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          age > 30 ? "bg-red-100 text-red-700" : age > 14 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {age > 30 ? "Critical" : age > 14 ? "Warning" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* MAIN REPORTS VIEW                                                  */
/* ================================================================== */
interface ReportsViewProps {
  leads: Lead[];
  invoices: Invoice[];
  onNavigate?: (view: string, id?: string) => void;
}

export function ReportsView({ leads: rawLeads, invoices: rawInvoices, onNavigate }: ReportsViewProps) {
  const leads = useMemo(() => rawLeads.map(normLead), [rawLeads]);
  const invoices = useMemo(() => rawInvoices.map(normInv), [rawInvoices]);
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [filter, setFilter] = useState<ReportFilter>({
    dateRange: "30d",
    startDate: getDateFromRange("30d"),
    endDate: todayISODate(),
    source: "",
    owner: "",
  });

  const activeTabConfig = TAB_CONFIG.find(t => t.key === activeTab);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">
            {DATE_RANGE_LABELS[filter.dateRange]} · {leads.length} leads · {invoices.length} invoices
          </p>
        </div>
        {onNavigate && (
          <button onClick={() => onNavigate("dashboard")}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar filter={filter} setFilter={setFilter} />

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        {TAB_CONFIG.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
              ${activeTab === tab.key
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"}`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewReport leads={leads} invoices={invoices} filter={filter} />}
      {activeTab === "conversion" && <ConversionReport leads={leads} filter={filter} />}
      {activeTab === "revenue" && <RevenueReport leads={leads} invoices={invoices} filter={filter} />}
      {activeTab === "team" && <TeamReport leads={leads} filter={filter} />}
      {activeTab === "source" && <SourceReport leads={leads} filter={filter} />}
      {activeTab === "aging" && <AgingReport leads={leads} filter={filter} />}
      {activeTab === "pipeline-velocity" && <VelocityReport leads={leads} filter={filter} />}
      {activeTab === "collection" && <CollectionReport invoices={invoices} filter={filter} />}
    </div>
  );
}
