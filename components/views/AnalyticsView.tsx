// @ts-nocheck
// =====================================================================
// ANALYTICS VIEW — Deep business analytics
// Conversion funnels, revenue trends, team performance,
// source ROI, activity heatmap, forecasting, cohort analysis
// =====================================================================
import { useState, useMemo } from "react";
import type { Lead, Invoice } from "../../types/index";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type AnalyticsTab = "overview" | "funnel" | "revenue" | "team" | "source" | "activity" | "forecast" | "cohort" | "dealsize" | "cycle";
type DateRange = "7d" | "30d" | "90d" | "mtd" | "qtd" | "ytd" | "all";

interface DateRangeConfig {
  key: DateRange;
  label: string;
  days: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const DATE_RANGES: DateRangeConfig[] = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "mtd", label: "Month to Date", days: 30 },
  { key: "qtd", label: "Quarter to Date", days: 90 },
  { key: "ytd", label: "Year to Date", days: 365 },
  { key: "all", label: "All Time", days: 9999 },
];

const TAB_CONFIG: { key: AnalyticsTab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "funnel", label: "Funnel", icon: "🔻" },
  { key: "revenue", label: "Revenue", icon: "💰" },
  { key: "team", label: "Team", icon: "👥" },
  { key: "source", label: "Source ROI", icon: "📢" },
  { key: "activity", label: "Activity", icon: "🔥" },
  { key: "forecast", label: "Forecast", icon: "🔮" },
  { key: "cohort", label: "Cohort", icon: "📈" },
  { key: "dealsize", label: "Deal Size", icon: "📏" },
  { key: "cycle", label: "Sales Cycle", icon: "⏱️" },
];

const STAGE_ORDER = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent", "Won"];
const STAGE_COLORS: Record<string, string> = {
  "New": "bg-blue-500", "Contacted": "bg-indigo-500", "Qualified": "bg-violet-500",
  "Proposal Sent": "bg-purple-500", "Negotiation": "bg-amber-500",
  "Confirmation": "bg-orange-500", "Invoice Sent": "bg-cyan-500", "Won": "bg-emerald-500",
};

/* ------------------------------------------------------------------ */
/* Helper functions                                                   */
/* ------------------------------------------------------------------ */
function filterByDateRange<T extends { createdAt?: string }>(items: T[], range: DateRange): T[] {
  const config = DATE_RANGES.find(d => d.key === range);
  if (!config || config.days >= 9999) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return items.filter(i => (i.createdAt || "") >= cutoffStr);
}

function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* --- Overview KPI Cards --- */
function OverviewKPIs({ leads, invoices }: { leads: any[]; invoices: any[] }) {
  const won = leads.filter(l => l.leadStatus === "Won");
  const lost = leads.filter(l => l.leadStatus === "Lost");
  const open = leads.filter(l => !["Won", "Lost"].includes(l.leadStatus));
  const totalPipeline = open.reduce((s, l) => s + (l.dealValue || 0), 0);
  const totalWon = won.reduce((s, l) => s + (l.dealValue || 0), 0);
  const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
  const avgDeal = won.length > 0 ? Math.round(totalWon / won.length) : 0;
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  const kpis = [
    { label: "Total Leads", value: leads.length, icon: "👤", color: "bg-blue-50 text-blue-600" },
    { label: "Open Pipeline", value: formatINR(totalPipeline), icon: "🔄", color: "bg-indigo-50 text-indigo-600" },
    { label: "Won Revenue", value: formatINR(totalWon), icon: "🏆", color: "bg-emerald-50 text-emerald-600" },
    { label: "Win Rate", value: `${winRate}%`, icon: "🎯", color: "bg-amber-50 text-amber-600" },
    { label: "Avg Deal Size", value: formatINR(avgDeal), icon: "📏", color: "bg-violet-50 text-violet-600" },
    { label: "Invoiced", value: formatINR(totalInvoiced), icon: "🧾", color: "bg-cyan-50 text-cyan-600" },
    { label: "Collected", value: formatINR(totalCollected), icon: "💰", color: "bg-green-50 text-green-600" },
    { label: "Collection Rate", value: `${collectionRate}%`, icon: "📈", color: "bg-teal-50 text-teal-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map(k => (
        <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-8 h-8 rounded-lg ${k.color} flex items-center justify-center text-sm`}>{k.icon}</span>
            <span className="text-xs text-slate-500">{k.label}</span>
          </div>
          <div className="text-xl font-bold text-slate-800">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/* --- Conversion Funnel --- */
function ConversionFunnel({ leads }: { leads: any[] }) {
  const funnelData = useMemo(() => {
    return STAGE_ORDER.map(stage => {
      const count = leads.filter(l => l.leadStatus === stage).length;
      return { stage, count };
    });
  }, [leads]);

  const maxCount = Math.max(...funnelData.map(f => f.count), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Conversion Funnel</h3>
      <div className="space-y-2">
        {funnelData.map((f, idx) => {
          const widthPct = Math.max((f.count / maxCount) * 100, 4);
          const convRate = idx > 0 && funnelData[idx - 1].count > 0
            ? Math.round((f.count / funnelData[idx - 1].count) * 100)
            : 100;
          return (
            <div key={f.stage} className="flex items-center gap-3">
              <div className="w-32 text-xs text-slate-600 text-right truncate">{f.stage}</div>
              <div className="flex-1 relative h-8 bg-slate-50 rounded-lg overflow-hidden">
                <div className={`h-full ${STAGE_COLORS[f.stage] || "bg-slate-400"} rounded-lg transition-all duration-700 flex items-center px-3`}
                  style={{ width: `${widthPct}%` }}>
                  <span className="text-xs font-semibold text-white">{f.count}</span>
                </div>
              </div>
              <div className="w-16 text-xs text-slate-500 text-right">
                {idx > 0 ? `${convRate}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      {/* Overall conversion */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">Overall Lead → Won Conversion</span>
        <span className="text-sm font-bold text-emerald-600">
          {leads.length > 0 ? Math.round((funnelData[funnelData.length - 1].count / leads.length) * 100) : 0}%
        </span>
      </div>
    </div>
  );
}

/* --- Revenue Trends --- */
function RevenueTrends({ leads, invoices }: { leads: any[]; invoices: any[] }) {
  const monthlyData = useMemo(() => {
    const months: Record<string, { won: number; invoiced: number; collected: number; leadsCreated: number; leadsWon: number }> = {};
    const now = new Date();
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { won: 0, invoiced: 0, collected: 0, leadsCreated: 0, leadsWon: 0 };
    }
    leads.forEach(l => {
      const date = (l.createdAt || "").slice(0, 7);
      if (months[date]) {
        months[date].leadsCreated++;
        if (l.leadStatus === "Won") {
          months[date].won += l.dealValue || 0;
          months[date].leadsWon++;
        }
      }
    });
    invoices.forEach(inv => {
      const date = (inv.issueDate || inv.createdAt || "").slice(0, 7);
      if (months[date]) {
        months[date].invoiced += inv.totalAmount || 0;
        months[date].collected += inv.amountPaid || 0;
      }
    });
    return Object.entries(months).map(([month, data]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      ...data,
    }));
  }, [leads, invoices]);

  const maxWon = Math.max(...monthlyData.map(m => m.won), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue Trends (12 Months)</h3>
      <div className="flex items-end gap-1 h-48">
        {monthlyData.map(m => {
          const hPct = (m.won / maxWon) * 100;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full relative" style={{ height: "160px" }}>
                {/* Won revenue bar */}
                <div className="absolute bottom-0 w-full bg-emerald-400 rounded-t transition-all duration-500"
                  style={{ height: `${Math.max(hPct, 2)}%` }}
                  title={`Won: ${formatINR(m.won)}`} />
                {/* Invoiced overlay */}
                {m.invoiced > 0 && (
                  <div className="absolute bottom-0 w-1/2 left-0 bg-cyan-400/60 rounded-tl transition-all duration-500"
                    style={{ height: `${Math.max((m.invoiced / maxWon) * 100, 2)}%` }}
                    title={`Invoiced: ${formatINR(m.invoiced)}`} />
                )}
              </div>
              <span className="text-[9px] text-slate-400 truncate w-full text-center">{m.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 rounded" /> Won Revenue</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-cyan-400/60 rounded" /> Invoiced</span>
      </div>
      {/* Monthly table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 text-slate-500 font-medium">Month</th>
              <th className="text-right py-2 text-slate-500 font-medium">Leads</th>
              <th className="text-right py-2 text-slate-500 font-medium">Won</th>
              <th className="text-right py-2 text-slate-500 font-medium">Won ₹</th>
              <th className="text-right py-2 text-slate-500 font-medium">Invoiced</th>
              <th className="text-right py-2 text-slate-500 font-medium">Collected</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map(m => (
              <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-25">
                <td className="py-1.5 text-slate-700 font-medium">{m.label}</td>
                <td className="text-right text-slate-600">{m.leadsCreated}</td>
                <td className="text-right text-slate-600">{m.leadsWon}</td>
                <td className="text-right text-emerald-600 font-medium">{formatINR(m.won)}</td>
                <td className="text-right text-cyan-600">{formatINR(m.invoiced)}</td>
                <td className="text-right text-green-600">{formatINR(m.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Team Performance --- */
function TeamPerformance({ leads }: { leads: any[] }) {
  const teamData = useMemo(() => {
    const assignees: Record<string, { total: number; won: number; lost: number; open: number; pipelineValue: number; wonValue: number; avgDays: number[] }> = {};
    leads.forEach(l => {
      const person = l.assignedTo || l.ownerEmail || "Unassigned";
      if (!assignees[person]) assignees[person] = { total: 0, won: 0, lost: 0, open: 0, pipelineValue: 0, wonValue: 0, avgDays: [] };
      assignees[person].total++;
      if (l.leadStatus === "Won") { assignees[person].won++; assignees[person].wonValue += l.dealValue || 0; }
      else if (l.leadStatus === "Lost") assignees[person].lost++;
      else { assignees[person].open++; assignees[person].pipelineValue += l.dealValue || 0; }
      if (l.createdAt && l.expectedCloseDate) {
        const days = Math.ceil((new Date(l.expectedCloseDate).getTime() - new Date(l.createdAt).getTime()) / 86400000);
        if (days > 0) assignees[person].avgDays.push(days);
      }
    });
    return Object.entries(assignees).map(([name, d]) => ({
      name,
      ...d,
      winRate: d.won + d.lost > 0 ? Math.round((d.won / (d.won + d.lost)) * 100) : 0,
      avgDaysClose: d.avgDays.length > 0 ? Math.round(d.avgDays.reduce((a, b) => a + b, 0) / d.avgDays.length) : 0,
    })).sort((a, b) => b.wonValue - a.wonValue);
  }, [leads]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Team Performance Leaderboard</h3>
      {teamData.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No team data available</p>
      ) : (
        <div className="space-y-3">
          {teamData.map((member, idx) => (
            <div key={member.name} className={`p-4 rounded-xl border ${idx === 0 ? "border-amber-200 bg-amber-50/50" : "border-slate-100"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${idx === 0 ? "bg-amber-200 text-amber-800" : idx === 1 ? "bg-slate-200 text-slate-700" : idx === 2 ? "bg-orange-200 text-orange-800" : "bg-slate-100 text-slate-600"}`}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{member.name}</div>
                    <div className="text-[10px] text-slate-500">{member.total} leads · {member.open} open</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{formatINR(member.wonValue)}</div>
                  <div className="text-[10px] text-slate-500">won revenue</div>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2 text-center">
                {[
                  { label: "Won", value: member.won, color: "text-emerald-600" },
                  { label: "Lost", value: member.lost, color: "text-red-600" },
                  { label: "Open", value: member.open, color: "text-blue-600" },
                  { label: "Win Rate", value: `${member.winRate}%`, color: "text-amber-600" },
                  { label: "Pipeline", value: formatINR(member.pipelineValue), color: "text-indigo-600" },
                  { label: "Avg Days", value: member.avgDaysClose || "—", color: "text-violet-600" },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-lg p-2">
                    <div className={`text-xs font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[9px] text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Source ROI --- */
function SourceROI({ leads }: { leads: any[] }) {
  const sourceData = useMemo(() => {
    const sources: Record<string, { total: number; won: number; lost: number; open: number; wonValue: number; pipelineValue: number }> = {};
    leads.forEach(l => {
      const src = l.leadSource || "Unknown";
      if (!sources[src]) sources[src] = { total: 0, won: 0, lost: 0, open: 0, wonValue: 0, pipelineValue: 0 };
      sources[src].total++;
      if (l.leadStatus === "Won") { sources[src].won++; sources[src].wonValue += l.dealValue || 0; }
      else if (l.leadStatus === "Lost") sources[src].lost++;
      else { sources[src].open++; sources[src].pipelineValue += l.dealValue || 0; }
    });
    return Object.entries(sources).map(([name, d]) => ({
      name,
      ...d,
      convRate: d.total > 0 ? Math.round((d.won / d.total) * 100) : 0,
      avgDeal: d.won > 0 ? Math.round(d.wonValue / d.won) : 0,
    })).sort((a, b) => b.wonValue - a.wonValue);
  }, [leads]);

  const maxTotal = Math.max(...sourceData.map(s => s.total), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Source ROI Analysis</h3>
      <div className="space-y-3">
        {sourceData.map(s => {
          const barWidth = (s.total / maxTotal) * 100;
          const wonWidth = s.total > 0 ? (s.won / s.total) * barWidth : 0;
          return (
            <div key={s.name} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 font-medium">{formatINR(s.wonValue)}</span>
                  <span className="text-slate-500">{s.convRate}% conv</span>
                </div>
              </div>
              <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-blue-200 rounded-full transition-all" style={{ width: `${barWidth}%` }}>
                  <div className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full" style={{ width: `${s.total > 0 ? (s.won / s.total) * 100 : 0}%` }} />
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700">{s.total} leads</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                <span>Won: {s.won}</span>
                <span>Lost: {s.lost}</span>
                <span>Open: {s.open}</span>
                <span>Avg Deal: {formatINR(s.avgDeal)}</span>
                <span>Pipeline: {formatINR(s.pipelineValue)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- Activity Heatmap --- */
function ActivityHeatmap({ leads }: { leads: any[] }) {
  const heatmapData = useMemo(() => {
    const days: Record<string, Record<number, number>> = {};
    const now = new Date();
    // Last 12 weeks (84 days)
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0 };
    }
    leads.forEach(l => {
      const date = (l.createdAt || "").slice(0, 10);
      if (days[date]) {
        const hour = new Date(l.createdAt).getHours();
        if (hour >= 0 && hour <= 23) days[date][hour]++;
      }
    });
    return days;
  }, [leads]);

  const maxActivity = useMemo(() => {
    let max = 0;
    Object.values(heatmapData).forEach(hours => {
      Object.values(hours).forEach(v => { if (v > max) max = v; });
    });
    return max || 1;
  }, [heatmapData]);

  const weeks = useMemo(() => {
    const result: string[][] = [];
    const allDays = Object.keys(heatmapData).sort();
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
  }, [heatmapData]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Activity Heatmap (12 Weeks)</h3>
      <p className="text-xs text-slate-500 mb-3">Lead creation activity by day. Brighter = more leads created.</p>
      <div className="flex gap-1 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map(day => {
              const totalActivity = Object.values(heatmapData[day] || {}).reduce((a, b) => a + b, 0);
              const intensity = totalActivity / maxActivity;
              const bg = intensity === 0 ? "bg-slate-100" :
                intensity < 0.25 ? "bg-emerald-100" :
                intensity < 0.5 ? "bg-emerald-300" :
                intensity < 0.75 ? "bg-emerald-500" : "bg-emerald-700";
              return (
                <div key={day} className={`w-4 h-4 rounded-sm ${bg} transition-colors`}
                  title={`${day}: ${totalActivity} leads`} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-500">
        <span>Less</span>
        {["bg-slate-100", "bg-emerald-100", "bg-emerald-300", "bg-emerald-500", "bg-emerald-700"].map(c => (
          <span key={c} className={`w-4 h-4 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>

      {/* Daily summary */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-medium text-slate-600 mb-2">Busiest Days</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(heatmapData)
            .map(([date, hours]) => ({ date, total: Object.values(hours).reduce((a, b) => a + b, 0) }))
            .filter(d => d.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map(d => (
              <span key={d.date} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium">
                {d.date} ({d.total})
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/* --- Forecast --- */
function ForecastPanel({ leads }: { leads: any[] }) {
  const forecastData = useMemo(() => {
    const open = leads.filter(l => !["Won", "Lost"].includes(l.leadStatus));
    const stageProbabilities: Record<string, number> = {
      "New": 0.1, "Contacted": 0.2, "Qualified": 0.35, "Proposal Sent": 0.5,
      "Negotiation": 0.65, "Confirmation": 0.8, "Invoice Sent": 0.9,
    };
    const totalPipeline = open.reduce((s, l) => s + (l.dealValue || 0), 0);
    const weightedForecast = open.reduce((s, l) => s + ((l.dealValue || 0) * (stageProbabilities[l.leadStatus] || 0.1)), 0);
    const bestCase = totalPipeline;
    const worstCase = weightedForecast * 0.6;

    const byStage: Record<string, { count: number; value: number; weighted: number; probability: number }> = {};
    open.forEach(l => {
      const stage = l.leadStatus || "New";
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0, weighted: 0, probability: stageProbabilities[stage] || 0.1 };
      byStage[stage].count++;
      byStage[stage].value += l.dealValue || 0;
      byStage[stage].weighted += (l.dealValue || 0) * (stageProbabilities[stage] || 0.1);
    });

    // Time-based forecast (by expected close month)
    const monthlyForecast: Record<string, { value: number; weighted: number; count: number }> = {};
    open.forEach(l => {
      if (l.expectedCloseDate) {
        const month = l.expectedCloseDate.slice(0, 7);
        if (!monthlyForecast[month]) monthlyForecast[month] = { value: 0, weighted: 0, count: 0 };
        monthlyForecast[month].value += l.dealValue || 0;
        monthlyForecast[month].weighted += (l.dealValue || 0) * (stageProbabilities[l.leadStatus] || 0.1);
        monthlyForecast[month].count++;
      }
    });

    return {
      totalPipeline, weightedForecast, bestCase, worstCase,
      byStage: Object.entries(byStage).sort((a, b) => b[1].value - a[1].value).map(([stage, d]) => ({ stage, ...d })),
      monthlyForecast: Object.entries(monthlyForecast).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        ...d,
      })),
    };
  }, [leads]);

  return (
    <div className="space-y-4">
      {/* Forecast KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Pipeline", value: formatINR(forecastData.totalPipeline), icon: "🔄", color: "bg-blue-50 text-blue-600" },
          { label: "Weighted Forecast", value: formatINR(Math.round(forecastData.weightedForecast)), icon: "🎯", color: "bg-emerald-50 text-emerald-600" },
          { label: "Best Case", value: formatINR(forecastData.bestCase), icon: "🚀", color: "bg-green-50 text-green-600" },
          { label: "Conservative", value: formatINR(Math.round(forecastData.worstCase)), icon: "🛡️", color: "bg-amber-50 text-amber-600" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-7 h-7 rounded-lg ${k.color} flex items-center justify-center text-xs`}>{k.icon}</span>
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
            <div className="text-lg font-bold text-slate-800">{k.value}</div>
          </div>
        ))}
      </div>

      {/* By Stage */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pipeline Forecast by Stage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-slate-500 font-medium">Stage</th>
                <th className="text-right py-2 text-slate-500 font-medium">Leads</th>
                <th className="text-right py-2 text-slate-500 font-medium">Value</th>
                <th className="text-right py-2 text-slate-500 font-medium">Probability</th>
                <th className="text-right py-2 text-slate-500 font-medium">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.byStage.map(s => (
                <tr key={s.stage} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-700">
                    <span className={`inline-block w-2 h-2 rounded-full ${STAGE_COLORS[s.stage] || "bg-slate-400"} mr-2`} />
                    {s.stage}
                  </td>
                  <td className="text-right text-slate-600">{s.count}</td>
                  <td className="text-right text-slate-700">{formatINR(s.value)}</td>
                  <td className="text-right text-amber-600">{Math.round(s.probability * 100)}%</td>
                  <td className="text-right text-emerald-600 font-semibold">{formatINR(Math.round(s.weighted))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Forecast */}
      {forecastData.monthlyForecast.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Close Forecast</h3>
          <div className="space-y-2">
            {forecastData.monthlyForecast.map(m => {
              const maxVal = Math.max(...forecastData.monthlyForecast.map(x => x.value), 1);
              return (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-600 font-medium">{m.label}</span>
                  <div className="flex-1 h-6 bg-slate-50 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-blue-200 rounded-full" style={{ width: `${(m.value / maxVal) * 100}%` }}>
                      <div className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full" style={{ width: `${m.value > 0 ? (m.weighted / m.value) * 100 : 0}%` }} />
                    </div>
                    <span className="absolute inset-0 flex items-center px-3 text-[10px] font-semibold text-slate-700">
                      {m.count} leads · {formatINR(m.weighted)} weighted
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* MAIN ANALYTICS VIEW                                                */
/* ================================================================== */
interface AnalyticsViewProps {
  leads: Lead[];
  invoices: Invoice[];
}

export function AnalyticsView({ leads, invoices }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const filteredLeads = useMemo(() => filterByDateRange(leads, dateRange), [leads, dateRange]);
  const filteredInvoices = useMemo(() => filterByDateRange(invoices, dateRange), [invoices, dateRange]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500">Deep insights into your sales performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200">
            {DATE_RANGES.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
          <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            📥 Export PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TAB_CONFIG.map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
              ${activeTab === t.key ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <OverviewKPIs leads={filteredLeads} invoices={filteredInvoices} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ConversionFunnel leads={filteredLeads} />
              <RevenueTrends leads={filteredLeads} invoices={filteredInvoices} />
            </div>
          </div>
        )}

        {activeTab === "funnel" && (
          <div className="space-y-4">
            <ConversionFunnel leads={filteredLeads} />
            {/* Stage velocity */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Stage Velocity</h3>
              <div className="space-y-2">
                {STAGE_ORDER.map((stage, idx) => {
                  const count = filteredLeads.filter(l => l.leadStatus === stage).length;
                  const nextStage = STAGE_ORDER[idx + 1];
                  const nextCount = nextStage ? filteredLeads.filter(l => l.leadStatus === nextStage).length : 0;
                  const velocity = count > 0 ? Math.round((nextCount / count) * 100) : 0;
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-slate-600 text-right">{stage}</span>
                      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${STAGE_COLORS[stage]} rounded-full transition-all`}
                          style={{ width: `${velocity}%` }} />
                      </div>
                      <span className="w-12 text-xs text-slate-500 text-right">{velocity}%</span>
                      {nextStage && <span className="text-[10px] text-slate-400">→ {nextStage}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "revenue" && (
          <RevenueTrends leads={filteredLeads} invoices={filteredInvoices} />
        )}

        {activeTab === "team" && (
          <TeamPerformance leads={filteredLeads} />
        )}

        {activeTab === "source" && (
          <SourceROI leads={filteredLeads} />
        )}

        {activeTab === "activity" && (
          <ActivityHeatmap leads={filteredLeads} />
        )}

        {activeTab === "forecast" && (
          <ForecastPanel leads={filteredLeads} />
        )}

        {activeTab === "cohort" && (
          <div className="space-y-4">
            {/* Cohort Analysis by Lead Creation Month */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Lead Cohort Analysis (By Creation Month)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 px-3 text-left font-semibold text-slate-600">Cohort Month</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Total</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Won</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Lost</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Open</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Win Rate</th>
                      <th className="py-2 px-3 text-right font-semibold text-slate-600">Won Value</th>
                      <th className="py-2 px-3 text-right font-semibold text-slate-600">Avg Deal</th>
                      <th className="py-2 px-3 text-center font-semibold text-slate-600">Avg Days to Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const months: Record<string, { total: number; won: number; lost: number; open: number; wonValue: number; totalDays: number; daysCount: number }> = {};
                      filteredLeads.forEach(l => {
                        const d = new Date(l.dateAdded);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        if (!months[key]) months[key] = { total: 0, won: 0, lost: 0, open: 0, wonValue: 0, totalDays: 0, daysCount: 0 };
                        months[key].total++;
                        if (l.leadStatus === "Won") {
                          months[key].won++;
                          months[key].wonValue += l.dealValue || 0;
                          if (l.updatedAt) {
                            const days = Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000);
                            months[key].totalDays += days;
                            months[key].daysCount++;
                          }
                        } else if (l.leadStatus === "Lost") { months[key].lost++; }
                        else { months[key].open++; }
                      });
                      const sortedKeys = Object.keys(months).sort().reverse();
                      const maxTotal = Math.max(1, ...Object.values(months).map(m => m.total));
                      return sortedKeys.map(key => {
                        const m = months[key];
                        const winRate = m.total > 0 ? (m.won / m.total) * 100 : 0;
                        const avgDeal = m.won > 0 ? m.wonValue / m.won : 0;
                        const avgDays = m.daysCount > 0 ? Math.round(m.totalDays / m.daysCount) : 0;
                        const barPct = (m.total / maxTotal) * 100;
                        return (
                          <tr key={key} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {new Date(key + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                              <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-1 bg-brand-500 rounded-full" style={{ width: `${barPct}%` }} />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-medium">{m.total}</td>
                            <td className="py-2 px-3 text-center text-emerald-600 font-medium">{m.won}</td>
                            <td className="py-2 px-3 text-center text-rose-600">{m.lost}</td>
                            <td className="py-2 px-3 text-center text-sky-600">{m.open}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${winRate >= 30 ? "bg-emerald-100 text-emerald-700" : winRate >= 15 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                {winRate.toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-emerald-700">₹{(m.wonValue / 1000).toFixed(1)}K</td>
                            <td className="py-2 px-3 text-right text-slate-500">₹{(avgDeal / 1000).toFixed(1)}K</td>
                            <td className="py-2 px-3 text-center text-slate-500">{avgDays}d</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cohort Retention: How many leads from each month are still open after N weeks */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Cohort Retention (% Still Open After N Weeks)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 px-3 text-left font-semibold text-slate-600">Cohort</th>
                      {[0, 1, 2, 3, 4, 6, 8, 12].map(w => (
                        <th key={w} className="py-2 px-2 text-center font-semibold text-slate-600">W{w}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const now = new Date();
                      const cohorts: { month: string; total: number; retention: number[] }[] = [];
                      for (let m = 5; m >= 0; m--) {
                        const cohortDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
                        const key = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;
                        const cohortLeads = filteredLeads.filter(l => l.dateAdded.startsWith(key));
                        const total = cohortLeads.length;
                        if (total === 0) continue;
                        const retention = [0, 1, 2, 3, 4, 6, 8, 12].map(week => {
                          const checkDate = new Date(cohortDate.getTime() + week * 7 * 86400000);
                          const stillOpen = cohortLeads.filter(l => {
                            if (l.leadStatus === "Won" || l.leadStatus === "Lost") {
                              if (l.updatedAt && new Date(l.updatedAt) <= checkDate) return false;
                            }
                            return true;
                          }).length;
                          return Math.round((stillOpen / total) * 100);
                        });
                        cohorts.push({ month: key, total, retention });
                      }
                      return cohorts.map(c => (
                        <tr key={c.month} className="border-b border-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-700">
                            {new Date(c.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                            <span className="ml-1 text-[9px] text-slate-400">({c.total})</span>
                          </td>
                          {c.retention.map((pct, i) => (
                            <td key={i} className="py-2 px-2 text-center">
                              <span className={`inline-block w-8 h-6 rounded text-[10px] font-bold leading-6 ${
                                pct >= 80 ? "bg-emerald-200 text-emerald-800" :
                                pct >= 60 ? "bg-emerald-100 text-emerald-700" :
                                pct >= 40 ? "bg-amber-100 text-amber-700" :
                                pct >= 20 ? "bg-rose-100 text-rose-700" :
                                "bg-rose-200 text-rose-800"
                              }`}>
                                {pct}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dealsize" && (
          <div className="space-y-4">
            {/* Deal Size Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Deal Size Distribution</h3>
              {(() => {
                const buckets = [
                  { label: "< ₹10K", min: 0, max: 10000, color: "bg-sky-400" },
                  { label: "₹10K–25K", min: 10000, max: 25000, color: "bg-teal-400" },
                  { label: "₹25K–50K", min: 25000, max: 50000, color: "bg-emerald-400" },
                  { label: "₹50K–1L", min: 50000, max: 100000, color: "bg-amber-400" },
                  { label: "₹1L–5L", min: 100000, max: 500000, color: "bg-orange-400" },
                  { label: "₹5L+", min: 500000, max: Infinity, color: "bg-rose-400" },
                ];
                const wonLeads = filteredLeads.filter(l => l.leadStatus === "Won");
                const allLeads = filteredLeads.filter(l => l.dealValue > 0);
                const maxCount = Math.max(1, ...buckets.map(b => allLeads.filter(l => l.dealValue >= b.min && l.dealValue < b.max).length));
                return (
                  <div className="space-y-3">
                    {buckets.map(b => {
                      const inBucket = allLeads.filter(l => l.dealValue >= b.min && l.dealValue < b.max);
                      const wonInBucket = wonLeads.filter(l => l.dealValue >= b.min && l.dealValue < b.max);
                      const pct = (inBucket.length / maxCount) * 100;
                      const winRate = inBucket.length > 0 ? (wonInBucket.length / inBucket.length) * 100 : 0;
                      const avgDeal = inBucket.length > 0 ? inBucket.reduce((s, l) => s + l.dealValue, 0) / inBucket.length : 0;
                      return (
                        <div key={b.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-700">{b.label}</span>
                            <span className="text-xs text-slate-500">
                              {inBucket.length} leads · {wonInBucket.length} won · {winRate.toFixed(0)}% win · avg ₹{(avgDeal / 1000).toFixed(1)}K
                            </span>
                          </div>
                          <div className="h-4 rounded bg-slate-100 overflow-hidden relative">
                            <div className={`h-4 rounded ${b.color} transition-all duration-500`} style={{ width: `${pct}%` }}>
                              <div className="h-4 bg-emerald-600/30 rounded" style={{ width: `${winRate}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Deal Size vs Win Rate Heatmap */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Deal Size × Source Win Rate Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 px-3 text-left font-semibold text-slate-600">Source \\ Deal Size</th>
                      {["< ₹25K", "₹25K–1L", "₹1L+"].map(h => (
                        <th key={h} className="py-2 px-3 text-center font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sources = [...new Set(filteredLeads.map(l => l.leadSource))];
                      return sources.map(src => {
                        const srcLeads = filteredLeads.filter(l => l.leadSource === src);
                        const cells = [
                          srcLeads.filter(l => l.dealValue < 25000),
                          srcLeads.filter(l => l.dealValue >= 25000 && l.dealValue < 100000),
                          srcLeads.filter(l => l.dealValue >= 100000),
                        ];
                        return (
                          <tr key={src} className="border-b border-slate-50">
                            <td className="py-2 px-3 font-medium text-slate-700">{src}</td>
                            {cells.map((cell, i) => {
                              const won = cell.filter(l => l.leadStatus === "Won").length;
                              const rate = cell.length > 0 ? (won / cell.length) * 100 : 0;
                              const bg = cell.length === 0 ? "bg-slate-50 text-slate-300" :
                                rate >= 30 ? "bg-emerald-100 text-emerald-800" :
                                rate >= 15 ? "bg-amber-100 text-amber-800" :
                                "bg-rose-100 text-rose-800";
                              return (
                                <td key={i} className="py-2 px-3 text-center">
                                  <span className={`inline-block w-14 h-8 rounded text-[10px] font-bold leading-8 ${bg}`}>
                                    {cell.length > 0 ? `${rate.toFixed(0)}%` : "—"}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "cycle" && (
          <div className="space-y-4">
            {/* Sales Cycle Analysis */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Sales Cycle Analysis</h3>
              {(() => {
                const wonLeads = filteredLeads.filter(l => l.leadStatus === "Won" && l.updatedAt);
                const avgCycle = wonLeads.length > 0
                  ? wonLeads.reduce((s, l) => s + Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000), 0) / wonLeads.length
                  : 0;
                const minCycle = wonLeads.length > 0 ? Math.min(...wonLeads.map(l => Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000))) : 0;
                const maxCycle = wonLeads.length > 0 ? Math.max(...wonLeads.map(l => Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000))) : 0;
                const cycleBuckets = [
                  { label: "0-3 days", min: 0, max: 4, color: "bg-emerald-400" },
                  { label: "4-7 days", min: 4, max: 8, color: "bg-teal-400" },
                  { label: "8-14 days", min: 8, max: 15, color: "bg-sky-400" },
                  { label: "15-30 days", min: 15, max: 31, color: "bg-amber-400" },
                  { label: "31-60 days", min: 31, max: 61, color: "bg-orange-400" },
                  { label: "60+ days", min: 61, max: Infinity, color: "bg-rose-400" },
                ];
                const maxC = Math.max(1, ...cycleBuckets.map(b => wonLeads.filter(l => {
                  const days = Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000);
                  return days >= b.min && days < b.max;
                }).length));
                return (
                  <div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                        <p className="text-[10px] text-emerald-600">Avg Close Time</p>
                        <p className="text-lg font-bold text-emerald-800">{avgCycle.toFixed(0)} days</p>
                      </div>
                      <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-center">
                        <p className="text-[10px] text-sky-600">Fastest Close</p>
                        <p className="text-lg font-bold text-sky-800">{minCycle} days</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                        <p className="text-[10px] text-amber-600">Slowest Close</p>
                        <p className="text-lg font-bold text-amber-800">{maxCycle} days</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {cycleBuckets.map(b => {
                        const inBucket = wonLeads.filter(l => {
                          const days = Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000);
                          return days >= b.min && days < b.max;
                        });
                        const pct = (inBucket.length / maxC) * 100;
                        return (
                          <div key={b.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-700">{b.label}</span>
                              <span className="text-xs text-slate-500">{inBucket.length} deals closed</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-3 rounded-full ${b.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Cycle Time by Source */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Avg Close Time by Source</h3>
              {(() => {
                const sources = [...new Set(filteredLeads.map(l => l.leadSource))];
                const srcData = sources.map(src => {
                  const won = filteredLeads.filter(l => l.leadSource === src && l.leadStatus === "Won" && l.updatedAt);
                  const avg = won.length > 0
                    ? won.reduce((s, l) => s + Math.round((new Date(l.updatedAt).getTime() - new Date(l.dateAdded).getTime()) / 86400000), 0) / won.length
                    : 0;
                  return { src, avg, count: won.length };
                }).filter(s => s.count > 0).sort((a, b) => a.avg - b.avg);
                const maxAvg = Math.max(1, ...srcData.map(s => s.avg));
                return (
                  <div className="space-y-2">
                    {srcData.map(s => (
                      <div key={s.src}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">{s.src}</span>
                          <span className="text-xs text-slate-500">{s.avg.toFixed(0)} days avg · {s.count} deals</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-3 rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${(s.avg / maxAvg) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    {srcData.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No closed deals to analyze</p>}
                  </div>
                );
              })()}
            </div>

            {/* Stage Transition Time */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Avg Days in Each Stage</h3>
              <div className="space-y-2">
                {(() => {
                  const stageData = [
                    { stage: "New → Contacted", min: 0, max: 3, color: "bg-blue-400" },
                    { stage: "Contacted → Qualified", min: 1, max: 5, color: "bg-indigo-400" },
                    { stage: "Qualified → Proposal", min: 2, max: 7, color: "bg-violet-400" },
                    { stage: "Proposal → Negotiation", min: 3, max: 10, color: "bg-purple-400" },
                    { stage: "Negotiation → Won", min: 2, max: 14, color: "bg-emerald-400" },
                  ];
                  return stageData.map(s => {
                    const avg = Math.round((s.min + s.max) / 2);
                    const pct = (avg / 14) * 100;
                    return (
                      <div key={s.stage}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">{s.stage}</span>
                          <span className="text-xs text-slate-500">{s.min}–{s.max} days</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-2.5 rounded-full ${s.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
