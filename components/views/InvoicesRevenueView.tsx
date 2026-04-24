// =====================================================================
// INVOICES VIEW — Invoice management with GST, payments, dunning
// REVENUE VIEW — Revenue tracking with KPIs and monthly breakdown
// Phase 6 Expansion: Dunning Board, Client Master, Batch Operations,
//   Recurring Invoice Generation, Invoice PDF Preview, Activity Log
// =====================================================================
import { useState, useMemo, useCallback } from "react";
import type {
  Invoice, Lead, InvoiceStatus, GstMode, InvoiceAdjustment,
  InvoiceDraft, MonthRangePreset, InvoiceRecurrence,
} from "../../types/index";
import { DEFAULT_TENANT_ID } from "../../constants/index";
import {
  makeId, todayISODate, formatInr, formatDateDisplay,
  downloadCsv, normalizeInvoiceStatus, invoiceTaxTotal,
  invoiceEffectiveTotal, invoiceOverdueDays,
  dunningStageFromDays, dunningPlaybookForStage, nextInvoiceNumber,
  invoiceAmountsFromDraft, invoiceAdjustmentSummary,
  wonRevenueValue,
  monthKeyFromDate, resolveRangeBounds,
} from "../../lib/utils";

/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */
function emptyDraft(_slug: string, _existingInvoices: Invoice[]): InvoiceDraft {
  void _slug; void _existingInvoices;
  return {
    leadId: "", serviceName: "", description: "", sacCode: "",
    quantity: 1, unitPrice: 0, gstRate: 18, gstMode: "Intra",
    dueDate: "", issueDate: todayISODate(),
    supplierGstin: "", supplierLegalName: "", supplierAddress: "", supplierState: "",
    customerGstin: "", customerLegalName: "", customerAddress: "", customerState: "",
    notes: "", lineItems: [{ id: makeId(), serviceName: "", description: "", sacCode: "", quantity: 1, unitPrice: 0, gstRate: 18 }],
    recurrence: "one-time",
  };
}

const STATUS_COLORS: Record<string, string> = {
  "Draft": "bg-slate-100 text-slate-700",
  "Issued": "bg-sky-100 text-sky-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  "Paid": "bg-emerald-100 text-emerald-700",
  "Overdue": "bg-rose-100 text-rose-700",
  "Cancelled": "bg-slate-200 text-slate-500",
};

const DUNNING_COLORS: Record<string, string> = {
  "On Track": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "D1-D3": "bg-sky-50 text-sky-700 border-sky-200",
  "D4-D7": "bg-amber-50 text-amber-700 border-amber-200",
  "D8-D15": "bg-orange-50 text-orange-700 border-orange-200",
  "D15+": "bg-rose-50 text-rose-700 border-rose-200",
};

/* ================================================================== */
/* INVOICES VIEW                                                      */
/* ================================================================== */
interface InvoicesViewProps {
  invoices: Invoice[];
  leads: Lead[];
  onInvoicesChange: (invoices: Invoice[]) => void;
}

type InvoiceTab = "all" | "dunning" | "clients" | "recurring";

export function InvoicesView({ invoices, leads, onInvoicesChange }: InvoicesViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft("yugam", invoices));
  const [activeTab, setActiveTab] = useState<InvoiceTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState("");
  const [activityLog, setActivityLog] = useState<Array<{ id: string; text: string; time: string; type: string }>>(
    () => invoices.slice(0, 20).map((inv) => ({
      id: inv.id,
      text: `Invoice ${inv.invoiceNumber} created for ${inv.leadName} — ${formatInr(inv.totalAmount)}`,
      time: inv.createdAt,
      type: "create",
    }))
  );

  const wonLeads = useMemo(() => leads.filter((l) => l.leadStatus === "Won" || l.leadStatus === "Confirmation" || l.leadStatus === "Invoice Sent"), [leads]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== "all") list = list.filter((i) => normalizeInvoiceStatus(i) === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.leadName.toLowerCase().includes(q) || i.invoiceNumber.toLowerCase().includes(q) || i.serviceName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invoices, statusFilter, search]);

  // Dunning-filtered invoices (only overdue/at-risk)
  const dunningInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const status = normalizeInvoiceStatus(inv);
      if (status === "Cancelled" || status === "Paid") return false;
      const effTotal = invoiceEffectiveTotal(inv, inv.adjustments);
      const overDays = invoiceOverdueDays(inv, effTotal);
      const dunning = dunningStageFromDays(overDays);
      return dunning !== "On Track";
    }).sort((a, b) => {
      const daysA = invoiceOverdueDays(a, invoiceEffectiveTotal(a, a.adjustments));
      const daysB = invoiceOverdueDays(b, invoiceEffectiveTotal(b, b.adjustments));
      return daysB - daysA;
    });
  }, [invoices]);

  // Client master — unique clients from invoices
  const clientMaster = useMemo(() => {
    const clients: Record<string, {
      name: string; totalInvoiced: number; totalPaid: number; totalOutstanding: number;
      invoiceCount: number; lastInvoiceDate: string; status: string; leadId: string;
      invoices: Invoice[];
    }> = {};
    for (const inv of invoices) {
      if (!clients[inv.leadName]) {
        clients[inv.leadName] = {
          name: inv.leadName, totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0,
          invoiceCount: 0, lastInvoiceDate: "", status: "Active", leadId: inv.leadId,
          invoices: [],
        };
      }
      const c = clients[inv.leadName];
      c.totalInvoiced += inv.totalAmount;
      c.totalPaid += inv.amountPaid;
      c.invoiceCount++;
      c.invoices.push(inv);
      if (inv.issueDate > c.lastInvoiceDate) c.lastInvoiceDate = inv.issueDate;
    }
    for (const c of Object.values(clients)) {
      c.totalOutstanding = c.totalInvoiced - c.totalPaid;
      if (c.totalOutstanding > 0) c.status = "Outstanding";
      else if (c.totalPaid === c.totalInvoiced && c.totalInvoiced > 0) c.status = "Paid Up";
    }
    return Object.values(clients).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [invoices]);

  // Recurring invoices
  const recurringInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.recurrence && inv.recurrence !== "one-time");
  }, [invoices]);

  // KPIs
  const kpis = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const overdue = invoices.filter((i) => normalizeInvoiceStatus(i) === "Overdue");
    const overdueAmount = overdue.reduce((s, i) => s + invoiceEffectiveTotal(i, i.adjustments) - i.amountPaid, 0);
    const issued = invoices.filter((i) => normalizeInvoiceStatus(i) === "Issued");
    const issuedAmount = issued.reduce((s, i) => s + i.totalAmount, 0);
    const draftCount = invoices.filter((i) => normalizeInvoiceStatus(i) === "Draft").length;
    const partialCount = invoices.filter((i) => normalizeInvoiceStatus(i) === "Partially Paid").length;
    const avgCollectionDays = invoices.length > 0
      ? invoices.filter((i) => normalizeInvoiceStatus(i) === "Paid")
          .reduce((s, i) => s + Math.max(0, (new Date(i.updatedAt).getTime() - new Date(i.issueDate).getTime()) / 86400000), 0)
          / Math.max(1, invoices.filter((i) => normalizeInvoiceStatus(i) === "Paid").length)
      : 0;
    return {
      total, paid, outstanding: total - paid,
      overdueCount: overdue.length, overdueAmount,
      issuedCount: issued.length, issuedAmount,
      draftCount, partialCount, avgCollectionDays: Math.round(avgCollectionDays),
    };
  }, [invoices]);

  // Add to activity log
  const logActivity = useCallback((text: string, type: string) => {
    setActivityLog((prev) => [{ id: makeId(), text, time: new Date().toISOString(), type }, ...prev].slice(0, 50));
  }, []);

  // Save invoice
  const handleSaveInvoice = useCallback(() => {
    const lead = leads.find((l) => l.id === draft.leadId);
    const amounts = invoiceAmountsFromDraft(draft);
    const invoice: Invoice = {
      id: makeId(),
      invoiceNumber: nextInvoiceNumber(invoices, "yugam"),
      leadId: draft.leadId,
      leadName: lead?.leadName ?? draft.customerLegalName ?? "",
      tenantId: DEFAULT_TENANT_ID,
      status: "Issued",
      recurrence: draft.recurrence,
      lineItems: amounts.lineItems,
      serviceName: draft.serviceName,
      description: draft.description,
      sacCode: draft.sacCode,
      quantity: amounts.quantity,
      unitPrice: amounts.unitPrice,
      gstRate: amounts.gstRate,
      gstMode: draft.gstMode,
      subtotal: amounts.subtotal,
      cgstAmount: amounts.cgstAmount,
      sgstAmount: amounts.sgstAmount,
      igstAmount: amounts.igstAmount,
      totalAmount: amounts.totalAmount,
      amountPaid: 0,
      dueDate: draft.dueDate,
      issueDate: draft.issueDate || todayISODate(),
      supplierGstin: draft.supplierGstin,
      supplierLegalName: draft.supplierLegalName,
      supplierAddress: draft.supplierAddress,
      supplierState: draft.supplierState,
      customerGstin: draft.customerGstin,
      customerLegalName: draft.customerLegalName,
      customerAddress: draft.customerAddress,
      customerState: draft.customerState,
      notes: draft.notes,
      adjustments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: null,
    };
    onInvoicesChange([...invoices, invoice]);
    logActivity(`Created invoice ${invoice.invoiceNumber} for ${invoice.leadName} — ${formatInr(invoice.totalAmount)}`, "create");
    setShowCreate(false);
    setDraft(emptyDraft("yugam", invoices));
  }, [draft, invoices, leads, onInvoicesChange, logActivity]);

  // Record payment
  const handlePayment = useCallback((invoiceId: string, amount: number) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    onInvoicesChange(invoices.map((i) => i.id === invoiceId ? { ...i, amountPaid: i.amountPaid + amount, updatedAt: new Date().toISOString() } : i));
    if (inv) logActivity(`Payment of ${formatInr(amount)} recorded for ${inv.invoiceNumber}`, "payment");
  }, [invoices, onInvoicesChange, logActivity]);

  // Change status
  const handleStatusChange = useCallback((invoiceId: string, status: InvoiceStatus) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    onInvoicesChange(invoices.map((i) => i.id === invoiceId ? { ...i, status, updatedAt: new Date().toISOString() } : i));
    if (inv) logActivity(`${inv.invoiceNumber} status changed to ${status}`, "status");
  }, [invoices, onInvoicesChange, logActivity]);

  // Add adjustment
  const handleAdjustment = useCallback((invoiceId: string, kind: "Credit" | "Debit", amount: number, reason: string) => {
    const adj: InvoiceAdjustment = { id: makeId(), invoiceId, kind, amount, reason, createdAt: new Date().toISOString() };
    const inv = invoices.find((i) => i.id === invoiceId);
    onInvoicesChange(invoices.map((i) => i.id === invoiceId ? { ...i, adjustments: [...i.adjustments, adj], updatedAt: new Date().toISOString() } : i));
    if (inv) logActivity(`${kind} of ${formatInr(amount)} added to ${inv.invoiceNumber}: ${reason}`, "adjustment");
  }, [invoices, onInvoicesChange, logActivity]);

  // Delete
  const handleDelete = useCallback((invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    onInvoicesChange(invoices.filter((i) => i.id !== invoiceId));
    setDetailInvoice(null);
    if (inv) logActivity(`Deleted invoice ${inv.invoiceNumber}`, "delete");
  }, [invoices, onInvoicesChange, logActivity]);

  // Batch operations
  const handleBatchAction = useCallback(() => {
    if (!batchAction || selectedIds.size === 0) return;
    let updated = invoices;
    switch (batchAction) {
      case "cancel":
        updated = invoices.map((i) => selectedIds.has(i.id) ? { ...i, status: "Cancelled" as InvoiceStatus, updatedAt: new Date().toISOString() } : i);
        logActivity(`Cancelled ${selectedIds.size} invoices`, "batch");
        break;
      case "mark-paid":
        updated = invoices.map((i) => selectedIds.has(i.id) ? { ...i, amountPaid: invoiceEffectiveTotal(i, i.adjustments), status: "Paid" as InvoiceStatus, updatedAt: new Date().toISOString() } : i);
        logActivity(`Marked ${selectedIds.size} invoices as paid`, "batch");
        break;
      case "delete":
        updated = invoices.filter((i) => !selectedIds.has(i.id));
        logActivity(`Deleted ${selectedIds.size} invoices`, "batch");
        break;
      case "send-reminder": {
        const reminded = invoices.filter((i) => selectedIds.has(i.id));
        reminded.forEach((i) => logActivity(`Payment reminder sent for ${i.invoiceNumber}`, "reminder"));
        break;
      }
    }
    onInvoicesChange(updated);
    setSelectedIds(new Set());
    setBatchAction("");
  }, [batchAction, invoices, selectedIds, onInvoicesChange, logActivity]);

  // Generate recurring invoices
  const handleGenerateRecurring = useCallback(() => {
    const newInvoices: Invoice[] = [];
    for (const inv of recurringInvoices) {
      const lastDate = new Date(inv.issueDate);
      let nextDate: Date;
      if (inv.recurrence === "monthly") nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
      else if (inv.recurrence === "quarterly") nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 3, lastDate.getDate());
      else nextDate = new Date(lastDate.getFullYear() + 1, lastDate.getMonth(), lastDate.getDate());
      const newInv: Invoice = {
        ...inv,
        id: makeId(),
        invoiceNumber: nextInvoiceNumber([...invoices, ...newInvoices], "yugam"),
        issueDate: nextDate.toISOString().slice(0, 10),
        dueDate: new Date(nextDate.getTime() + 15 * 86400000).toISOString().slice(0, 10),
        amountPaid: 0,
        adjustments: [],
        status: "Issued",
        parentId: inv.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newInvoices.push(newInv);
    }
    onInvoicesChange([...invoices, ...newInvoices]);
    logActivity(`Generated ${newInvoices.length} recurring invoices`, "recurring");
  }, [recurringInvoices, invoices, onInvoicesChange, logActivity]);

  // Export CSV
  const exportCsv = useCallback(() => {
    const headers = ["Invoice #", "Lead", "Service", "Status", "Total", "Paid", "Due", "Issue Date", "Due Date", "GST Mode", "Recurrence"];
    const rows = filtered.map((i) => [
      i.invoiceNumber, i.leadName, i.serviceName, normalizeInvoiceStatus(i),
      String(i.totalAmount), String(i.amountPaid), String(i.totalAmount - i.amountPaid),
      i.issueDate, i.dueDate, i.gstMode, i.recurrence || "one-time",
    ]);
    downloadCsv(`invoices-export-${todayISODate()}.csv`, headers, rows);
  }, [filtered]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((i) => i.id)));
  }, [selectedIds, filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
          <p className="text-sm text-slate-500">Create, manage and track invoices with GST compliance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">📤 Export CSV</button>
          {recurringInvoices.length > 0 && (
            <button onClick={handleGenerateRecurring} className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">🔄 Generate Recurring</button>
          )}
          <button onClick={() => { setDraft(emptyDraft("yugam", invoices)); setShowCreate(true); }} className="rounded-lg bg-[#788023] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#646b1d]">+ Create Invoice</button>
        </div>
      </div>

      {/* KPI Strip — expanded to 10 cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {[
          { label: "Total Invoiced", value: formatInr(kpis.total), icon: "🧾", color: "bg-violet-50 border-violet-200" },
          { label: "Total Paid", value: formatInr(kpis.paid), icon: "✅", color: "bg-emerald-50 border-emerald-200" },
          { label: "Outstanding", value: formatInr(kpis.outstanding), icon: "⏳", color: kpis.outstanding > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200" },
          { label: "Overdue Count", value: kpis.overdueCount, icon: "🔴", color: kpis.overdueCount > 0 ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200" },
          { label: "Overdue ₹", value: formatInr(kpis.overdueAmount), icon: "⚠️", color: kpis.overdueAmount > 0 ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200" },
          { label: "Issued", value: kpis.issuedCount, icon: "📤", color: "bg-sky-50 border-sky-200" },
          { label: "Issued ₹", value: formatInr(kpis.issuedAmount), icon: "💰", color: "bg-sky-50 border-sky-200" },
          { label: "Drafts", value: kpis.draftCount, icon: "📝", color: "bg-slate-50 border-slate-200" },
          { label: "Partial Paid", value: kpis.partialCount, icon: "🔄", color: "bg-amber-50 border-amber-200" },
          { label: "Avg Collection Days", value: `${kpis.avgCollectionDays}d`, icon: "⏱️", color: kpis.avgCollectionDays > 30 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.color}`}>
            <div className="flex items-center gap-1"><span className="text-sm">{kpi.icon}</span><span className="text-[10px] font-medium text-slate-600">{kpi.label}</span></div>
            <p className="mt-1 text-lg font-bold text-slate-800">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {([
          { key: "all", label: "All Invoices", icon: "🧾", count: invoices.length },
          { key: "dunning", label: "Dunning Board", icon: "🔔", count: dunningInvoices.length },
          { key: "clients", label: "Client Master", icon: "👥", count: clientMaster.length },
          { key: "recurring", label: "Recurring", icon: "🔄", count: recurringInvoices.length },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key ? "border-b-2 border-[#788023] text-[#788023] bg-[#788023]/5" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}>
            {tab.icon} {tab.label} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab: All Invoices */}
      {activeTab === "all" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices…"
              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "all")}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Issued">Issued</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <span className="text-xs text-slate-500">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
            {filtered.length > 0 && (
              <button onClick={toggleSelectAll}
                className="text-xs text-[#788023] hover:underline">
                {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>

          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#788023]/5 border border-[#788023]/20 p-3">
              <span className="text-sm font-medium text-[#788023]">{selectedIds.size} selected</span>
              <select value={batchAction} onChange={(e) => setBatchAction(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option value="">Choose action…</option>
                <option value="cancel">Cancel Selected</option>
                <option value="mark-paid">Mark as Paid</option>
                <option value="send-reminder">📧 Send Reminders</option>
                <option value="delete">Delete Selected</option>
              </select>
              <button onClick={handleBatchAction} disabled={!batchAction}
                className="rounded-lg bg-[#788023] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#646b1d] disabled:opacity-40">
                Apply
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                Deselect All
              </button>
            </div>
          )}

          {/* Invoice Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left w-10"><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Lead</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Service</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Subtotal</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">GST</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Paid</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Balance</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Due Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Recurrence</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={13} className="px-3 py-12 text-center text-slate-400">
                    <p className="text-lg mb-1">🧾</p><p>No invoices found. Create your first invoice.</p>
                  </td></tr>
                ) : filtered.map((inv) => {
                  const status = normalizeInvoiceStatus(inv);
                  const effTotal = invoiceEffectiveTotal(inv, inv.adjustments);
                  const balance = Math.max(0, effTotal - inv.amountPaid);
                  const overDays = invoiceOverdueDays(inv, effTotal);
                  const dunning = dunningStageFromDays(overDays);
                  return (
                    <tr key={inv.id} className={`border-b border-slate-50 hover:bg-slate-50 ${status === "Overdue" ? "bg-rose-50/20" : ""}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} /></td>
                      <td className="px-3 py-2 font-medium text-slate-800">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{inv.leadName}</td>
                      <td className="px-3 py-2 text-slate-600">{inv.serviceName}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-slate-100"}`}>{status}</span>
                        {dunning !== "On Track" && <p className="mt-0.5 text-[10px] text-rose-600">{dunning}</p>}
                      </td>
                      <td className="px-3 py-2 text-right">{formatInr(inv.subtotal)}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{formatInr(invoiceTaxTotal(inv))}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatInr(effTotal)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatInr(inv.amountPaid)}</td>
                      <td className="px-3 py-2 text-right font-medium text-rose-600">{formatInr(balance)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <p className="text-sm">{formatDateDisplay(inv.dueDate)}</p>
                        {overDays > 0 && <p className="text-[10px] text-rose-600 font-medium">{overDays}d overdue</p>}
                      </td>
                      <td className="px-3 py-2">
                        {inv.recurrence && inv.recurrence !== "one-time" ? (
                          <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-medium">🔄 {inv.recurrence}</span>
                        ) : <span className="text-xs text-slate-400">One-time</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => setDetailInvoice(inv)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Activity Log */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Activity Log</h2>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {activityLog.length === 0 ? (
                <p className="text-sm text-slate-400">No activity yet.</p>
              ) : activityLog.slice(0, 15).map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                    log.type === "create" ? "bg-sky-50 text-sky-700" :
                    log.type === "payment" ? "bg-emerald-50 text-emerald-700" :
                    log.type === "delete" ? "bg-rose-50 text-rose-700" :
                    log.type === "batch" ? "bg-violet-50 text-violet-700" :
                    log.type === "reminder" ? "bg-amber-50 text-amber-700" :
                    "bg-slate-50 text-slate-700"
                  }`}>
                    {log.type === "create" ? "➕" : log.type === "payment" ? "💵" : log.type === "delete" ? "🗑️" : log.type === "batch" ? "📦" : log.type === "reminder" ? "📧" : "📝"}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-700">{log.text}</p>
                    <p className="text-[10px] text-slate-400">{new Date(log.time).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tab: Dunning Board */}
      {activeTab === "dunning" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-rose-700">⚠️ Dunning Board</h3>
                <p className="text-xs text-rose-600">{dunningInvoices.length} invoice{dunningInvoices.length !== 1 ? "s" : ""} require attention</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-rose-700">{formatInr(dunningInvoices.reduce((s, i) => s + Math.max(0, invoiceEffectiveTotal(i, i.adjustments) - i.amountPaid), 0))}</p>
                <p className="text-[10px] text-rose-500">Total outstanding</p>
              </div>
            </div>
          </div>

          {/* Dunning Stage Columns */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(["D1-D3", "D4-D7", "D8-D15", "D15+"] as const).map((stage) => {
              const stageInvoices = dunningInvoices.filter((inv) => {
                const effTotal = invoiceEffectiveTotal(inv, inv.adjustments);
                const overDays = invoiceOverdueDays(inv, effTotal);
                return dunningStageFromDays(overDays) === stage;
              });
              if (stageInvoices.length === 0) return null;
              return (
                <div key={stage} className={`rounded-xl border p-4 ${DUNNING_COLORS[stage] || "bg-slate-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold">{stage}</h4>
                    <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-medium">{stageInvoices.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageInvoices.map((inv) => {
                      const effTotal = invoiceEffectiveTotal(inv, inv.adjustments);
                      const balance = Math.max(0, effTotal - inv.amountPaid);
                      const overDays = invoiceOverdueDays(inv, effTotal);
                      return (
                        <div key={inv.id} className="rounded-lg bg-white/70 border border-current/10 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800">{inv.invoiceNumber}</span>
                            <span className="text-[10px] font-medium">{overDays}d overdue</span>
                          </div>
                          <p className="text-xs text-slate-600">{inv.leadName}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-rose-700">{formatInr(balance)}</span>
                            <div className="flex gap-1">
                              <button onClick={() => { handlePayment(inv.id, balance); }}
                                className="rounded border border-emerald-300 px-1.5 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-50">Mark Paid</button>
                              <button onClick={() => setDetailInvoice(inv)}
                                className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50">View</button>
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500 italic">{dunningPlaybookForStage(stage)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {dunningInvoices.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-lg font-semibold text-emerald-700">All invoices are on track!</p>
              <p className="text-sm text-emerald-600">No overdue invoices require dunning actions.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Client Master */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500">Total Clients</p>
                <p className="text-xl font-bold text-slate-800">{clientMaster.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Active (Outstanding)</p>
                <p className="text-xl font-bold text-amber-600">{clientMaster.filter((c) => c.status === "Outstanding").length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Paid Up</p>
                <p className="text-xl font-bold text-emerald-600">{clientMaster.filter((c) => c.status === "Paid Up").length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Outstanding</p>
                <p className="text-xl font-bold text-rose-600">{formatInr(clientMaster.reduce((s, c) => s + c.totalOutstanding, 0))}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Invoices</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Invoiced</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Paid</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Outstanding</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Last Invoice</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientMaster.map((client) => (
                  <tr key={client.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{client.name}</p>
                      <p className="text-[10px] text-slate-400">{client.leadId ? "Linked lead" : "No linked lead"}</p>
                    </td>
                    <td className="px-3 py-2 text-center">{client.invoiceCount}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatInr(client.totalInvoiced)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{formatInr(client.totalPaid)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={client.totalOutstanding > 0 ? "font-bold text-rose-600" : "text-slate-400"}>
                        {formatInr(client.totalOutstanding)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        client.status === "Paid Up" ? "bg-emerald-100 text-emerald-700" :
                        client.status === "Outstanding" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{client.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDateDisplay(client.lastInvoiceDate)}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setDetailInvoice(client.invoices[0])}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Recurring Invoices */}
      {activeTab === "recurring" && (
        <div className="space-y-4">
          {recurringInvoices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-3xl mb-2">🔄</p>
              <p className="text-lg font-semibold text-slate-700">No recurring invoices</p>
              <p className="text-sm text-slate-500">Create an invoice with monthly, quarterly, or annual recurrence to see it here.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{recurringInvoices.length} recurring invoice templates</p>
                <button onClick={handleGenerateRecurring}
                  className="rounded-lg bg-[#788023] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#646b1d]">
                  🔄 Generate Next Cycle
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recurringInvoices.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4 card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</span>
                      <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-medium">🔄 {inv.recurrence}</span>
                    </div>
                    <p className="text-sm text-slate-600">{inv.leadName}</p>
                    <p className="text-xs text-slate-400">{inv.serviceName}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold">{formatInr(inv.totalAmount)}</span>
                      <button onClick={() => setDetailInvoice(inv)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">View Details</button>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400">
                      Last issued: {formatDateDisplay(inv.issueDate)} · Next: {(() => {
                        const d = new Date(inv.issueDate);
                        if (inv.recurrence === "monthly") d.setMonth(d.getMonth() + 1);
                        else if (inv.recurrence === "quarterly") d.setMonth(d.getMonth() + 3);
                        else d.setFullYear(d.getFullYear() + 1);
                        return formatDateDisplay(d.toISOString().slice(0, 10));
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-slate-800">Create Invoice</h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-700">Lead</label>
                  <select value={draft.leadId} onChange={(e) => {
                    const lead = leads.find((l) => l.id === e.target.value);
                    setDraft({ ...draft, leadId: e.target.value, customerLegalName: lead?.companyName ?? "", customerGstin: "" });
                  }} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="">Select lead…</option>
                    {wonLeads.map((l) => <option key={l.id} value={l.id}>{l.leadName} — {l.companyName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Service</label>
                  <input value={draft.serviceName} onChange={(e) => setDraft({ ...draft, serviceName: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Issue Date</label>
                  <input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Due Date</label>
                  <input type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">GST Mode</label>
                  <select value={draft.gstMode} onChange={(e) => setDraft({ ...draft, gstMode: e.target.value as GstMode })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="Intra">Intra-State (CGST+SGST)</option>
                    <option value="Inter">Inter-State (IGST)</option>
                    <option value="None">No GST</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Recurrence</label>
                  <select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as InvoiceRecurrence })}
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-700">Line Items</label>
                  <button onClick={() => setDraft({ ...draft, lineItems: [...draft.lineItems, { id: makeId(), serviceName: "", description: "", sacCode: "", quantity: 1, unitPrice: 0, gstRate: 18 }] })}
                    className="text-xs text-[#788023] hover:underline">+ Add Line Item</button>
                </div>
                {draft.lineItems.map((item, idx) => (
                  <div key={item.id} className="mb-2 grid gap-2 rounded border border-slate-100 p-2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
                    <input value={item.serviceName} onChange={(e) => {
                      const items = [...draft.lineItems]; items[idx] = { ...items[idx], serviceName: e.target.value }; setDraft({ ...draft, lineItems: items });
                    }} placeholder="Service name" className="rounded border border-slate-200 px-2 py-1 text-sm" />
                    <input type="number" value={item.quantity} onChange={(e) => {
                      const items = [...draft.lineItems]; items[idx] = { ...items[idx], quantity: Number(e.target.value) || 1 }; setDraft({ ...draft, lineItems: items });
                    }} placeholder="Qty" className="rounded border border-slate-200 px-2 py-1 text-sm" />
                    <input type="number" value={item.unitPrice} onChange={(e) => {
                      const items = [...draft.lineItems]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value) || 0 }; setDraft({ ...draft, lineItems: items });
                    }} placeholder="Price" className="rounded border border-slate-200 px-2 py-1 text-sm" />
                    <input type="number" value={item.gstRate} onChange={(e) => {
                      const items = [...draft.lineItems]; items[idx] = { ...items[idx], gstRate: Number(e.target.value) || 0 }; setDraft({ ...draft, lineItems: items });
                    }} placeholder="GST%" className="rounded border border-slate-200 px-2 py-1 text-sm" />
                    {draft.lineItems.length > 1 && (
                      <button onClick={() => setDraft({ ...draft, lineItems: draft.lineItems.filter((_, i) => i !== idx) })} className="text-rose-500 text-xs">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* GST Details */}
              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">GST & Supplier/Customer Details</summary>
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <div><label className="text-xs font-medium text-slate-700">Supplier GSTIN</label><input value={draft.supplierGstin} onChange={(e) => setDraft({ ...draft, supplierGstin: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-700">Supplier Legal Name</label><input value={draft.supplierLegalName} onChange={(e) => setDraft({ ...draft, supplierLegalName: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-700">Supplier State</label><input value={draft.supplierState} onChange={(e) => setDraft({ ...draft, supplierState: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-700">Customer GSTIN</label><input value={draft.customerGstin} onChange={(e) => setDraft({ ...draft, customerGstin: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-700">Customer Legal Name</label><input value={draft.customerLegalName} onChange={(e) => setDraft({ ...draft, customerLegalName: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                  <div><label className="text-xs font-medium text-slate-700">Customer State</label><input value={draft.customerState} onChange={(e) => setDraft({ ...draft, customerState: e.target.value })} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" /></div>
                </div>
              </details>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-700">Notes</label>
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" />
              </div>

              {/* Preview */}
              {(() => {
                const amounts = invoiceAmountsFromDraft(draft);
                return (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div><span className="text-slate-500">Subtotal:</span> <span className="font-medium">{formatInr(amounts.subtotal)}</span></div>
                      <div><span className="text-slate-500">CGST:</span> <span className="font-medium">{formatInr(amounts.cgstAmount)}</span></div>
                      <div><span className="text-slate-500">SGST:</span> <span className="font-medium">{formatInr(amounts.sgstAmount)}</span></div>
                      <div><span className="text-slate-500">IGST:</span> <span className="font-medium">{formatInr(amounts.igstAmount)}</span></div>
                      <div className="col-span-2"><span className="text-slate-500">Total:</span> <span className="text-lg font-bold text-slate-800">{formatInr(amounts.totalAmount)}</span></div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveInvoice} disabled={!draft.leadId && !draft.serviceName}
                  className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-semibold text-white hover:bg-[#646b1d] disabled:opacity-40">Create Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onPayment={handlePayment}
          onStatusChange={handleStatusChange}
          onAdjustment={handleAdjustment}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/* INVOICE DETAIL MODAL                                               */
/* ================================================================== */
function InvoiceDetailModal({ invoice, onClose, onPayment, onStatusChange, onAdjustment, onDelete }: {
  invoice: Invoice;
  onClose: () => void;
  onPayment: (id: string, amount: number) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onAdjustment: (id: string, kind: "Credit" | "Debit", amount: number, reason: string) => void;
  onDelete: (id: string) => void;
}) {
  const [payAmount, setPayAmount] = useState("");
  const [adjKind, setAdjKind] = useState<"Credit" | "Debit">("Credit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [tab, setTab] = useState<"details" | "payments" | "adjustments" | "audit">("details");

  const status = normalizeInvoiceStatus(invoice);
  const effTotal = invoiceEffectiveTotal(invoice, invoice.adjustments);
  const balance = Math.max(0, effTotal - invoice.amountPaid);
  const overDays = invoiceOverdueDays(invoice, effTotal);
  const dunning = dunningStageFromDays(overDays);
  const adjSummary = invoiceAdjustmentSummary(invoice.adjustments);
  const paymentProgress = effTotal > 0 ? Math.min(100, (invoice.amountPaid / effTotal) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{invoice.invoiceNumber}</h3>
            <p className="text-sm text-slate-500">{invoice.leadName} · {invoice.serviceName}</p>
            {invoice.recurrence && invoice.recurrence !== "one-time" && (
              <span className="mt-1 inline-block rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-medium">🔄 {invoice.recurrence}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>{status}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        </div>

        {/* Payment Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Payment Progress</span>
            <span>{paymentProgress.toFixed(0)}% ({formatInr(invoice.amountPaid)} / {formatInr(effTotal)})</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-2 rounded-full transition-all ${paymentProgress >= 100 ? "bg-emerald-500" : paymentProgress >= 50 ? "bg-amber-500" : "bg-sky-500"}`}
              style={{ width: `${paymentProgress}%` }} />
          </div>
        </div>

        {/* Dunning alert */}
        {dunning !== "On Track" && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3">
            <p className="text-sm font-medium text-rose-700">⚠️ {dunning} — {overDays} days overdue</p>
            <p className="text-xs text-rose-600 mt-1">{dunningPlaybookForStage(dunning)}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">🖨️ Print</button>
          <button onClick={() => {
            const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from Yugam Consulting`);
            const body = encodeURIComponent(`Dear ${invoice.leadName},\n\nPlease find below your invoice details:\n\nInvoice: ${invoice.invoiceNumber}\nService: ${invoice.serviceName}\nAmount: ${formatInr(effTotal)}\nDue Date: ${formatDateDisplay(invoice.dueDate)}\n\nThank you for your business.\n\nBest regards,\nYugam Consulting`);
            window.open(`mailto:${invoice.leadName}?subject=${subject}&body=${body}`);
          }} className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50">📧 Email</button>
          <button onClick={() => {
            const text = encodeURIComponent(`Dear ${invoice.leadName}, your invoice ${invoice.invoiceNumber} for ${formatInr(effTotal)} is due on ${formatDateDisplay(invoice.dueDate)}. — Yugam Consulting`);
            window.open(`https://wa.me/?text=${text}`);
          }} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">💬 WhatsApp</button>
          <button onClick={() => {
            const cnNo = `CN-${invoice.invoiceNumber.replace("INV-", "")}-${Date.now().toString(36).toUpperCase()}`;
            const cnAmount = Math.min(balance, effTotal * 0.5);
            const reason = prompt(`Credit Note ${cnNo}\nMax amount: ${formatInr(cnAmount)}\n\nEnter credit note amount:`);
            if (reason && Number(reason) > 0) {
              const noteReason = prompt("Enter reason for credit note:") || "Credit note issued";
              onAdjustment(invoice.id, "Credit", Number(reason), `[CN ${cnNo}] ${noteReason}`);
            }
          }} className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">📝 Credit Note</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-200">
          {(["details", "payments", "adjustments", "audit"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-[#788023] text-[#788023]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Invoice Number" value={invoice.invoiceNumber} />
              <DetailItem label="Lead" value={invoice.leadName} />
              <DetailItem label="Service" value={invoice.serviceName} />
              <DetailItem label="GST Mode" value={invoice.gstMode} />
              <DetailItem label="Issue Date" value={formatDateDisplay(invoice.issueDate)} />
              <DetailItem label="Due Date" value={formatDateDisplay(invoice.dueDate)} />
              <DetailItem label="Supplier GSTIN" value={invoice.supplierGstin || "—"} />
              <DetailItem label="Customer GSTIN" value={invoice.customerGstin || "—"} />
              <DetailItem label="Description" value={invoice.description || "—"} />
              <DetailItem label="SAC Code" value={invoice.sacCode || "—"} />
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Amount Breakdown</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Subtotal:</span> <span className="font-medium">{formatInr(invoice.subtotal)}</span></div>
                <div><span className="text-slate-500">Tax:</span> <span className="font-medium">{formatInr(invoiceTaxTotal(invoice))}</span></div>
                <div><span className="text-slate-500">CGST:</span> <span className="font-medium">{formatInr(invoice.cgstAmount)}</span></div>
                <div><span className="text-slate-500">SGST:</span> <span className="font-medium">{formatInr(invoice.sgstAmount)}</span></div>
                <div><span className="text-slate-500">IGST:</span> <span className="font-medium">{formatInr(invoice.igstAmount)}</span></div>
                <div><span className="text-slate-700 font-bold">Total:</span> <span className="text-lg font-bold">{formatInr(effTotal)}</span></div>
                <div><span className="text-emerald-600">Paid:</span> <span className="font-medium text-emerald-600">{formatInr(invoice.amountPaid)}</span></div>
                <div><span className="text-rose-600">Balance:</span> <span className="font-bold text-rose-600">{formatInr(balance)}</span></div>
              </div>
              {adjSummary.credit > 0 || adjSummary.debit > 0 ? (
                <div className="mt-2 text-xs text-slate-500">
                  Adjustments: Credits ₹{adjSummary.credit} | Debits ₹{adjSummary.debit}
                </div>
              ) : null}
            </div>

            {/* Line Items */}
            {invoice.lineItems.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Line Items</h4>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100"><th className="py-1 text-left">Service</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Price</th><th className="py-1 text-right">GST%</th><th className="py-1 text-right">Tax</th><th className="py-1 text-right">Total</th></tr></thead>
                  <tbody>
                    {invoice.lineItems.map((li) => {
                      const lineSubtotal = li.quantity * li.unitPrice;
                      const lineTax = lineSubtotal * (li.gstRate / 100);
                      return (
                        <tr key={li.id} className="border-b border-slate-50">
                          <td className="py-1">{li.serviceName || "—"}</td>
                          <td className="py-1 text-right">{li.quantity}</td>
                          <td className="py-1 text-right">{formatInr(li.unitPrice)}</td>
                          <td className="py-1 text-right">{li.gstRate}%</td>
                          <td className="py-1 text-right">{formatInr(lineTax)}</td>
                          <td className="py-1 text-right font-medium">{formatInr(lineSubtotal + lineTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="rounded-lg border border-slate-200 p-3">
                <h4 className="mb-1 text-sm font-semibold text-slate-700">Notes</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {/* Status change */}
            <div className="flex gap-2">
              <select onChange={(e) => { if (e.target.value) onStatusChange(invoice.id, e.target.value as InvoiceStatus); e.target.value = ""; }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option value="">Change status…</option>
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <button onClick={() => onDelete(invoice.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">Delete</button>
            </div>
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="grid grid-cols-3 gap-2 text-sm text-center">
                <div><p className="text-xs text-slate-400">Total</p><p className="font-bold">{formatInr(effTotal)}</p></div>
                <div><p className="text-xs text-slate-400">Paid</p><p className="font-bold text-emerald-600">{formatInr(invoice.amountPaid)}</p></div>
                <div><p className="text-xs text-slate-400">Balance</p><p className="font-bold text-rose-600">{formatInr(balance)}</p></div>
              </div>
            </div>

            {/* Quick payment amounts */}
            <div className="flex flex-wrap gap-2">
              {[balance, Math.round(balance / 2), Math.round(balance * 0.25)].filter((v) => v > 0 && v !== balance).map((amt) => (
                <button key={amt} onClick={() => setPayAmount(String(amt))}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${payAmount === String(amt) ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {formatInr(amt)}
                </button>
              ))}
              <button onClick={() => setPayAmount(String(balance))}
                className={`rounded-lg border px-3 py-1.5 text-xs ${payAmount === String(balance) ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                Full ({formatInr(balance)})
              </button>
            </div>

            <div className="flex gap-2">
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Custom amount" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={() => { if (payAmount) { onPayment(invoice.id, Number(payAmount)); setPayAmount(""); } }}
                disabled={!payAmount} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
                Record Payment
              </button>
            </div>
            <div className="text-xs text-slate-400">
              {invoice.amountPaid > 0 ? `₹${invoice.amountPaid} received so far` : "No payments recorded yet"}
            </div>
          </div>
        )}

        {tab === "adjustments" && (
          <div className="space-y-4">
            {invoice.adjustments.length > 0 && (
              <div className="space-y-2">
                {invoice.adjustments.map((adj) => (
                  <div key={adj.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                    <div>
                      <span className={`text-xs font-medium ${adj.kind === "Credit" ? "text-emerald-600" : "text-rose-600"}`}>{adj.kind}</span>
                      <span className="ml-2 text-sm text-slate-700">{adj.reason}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{formatInr(adj.amount)}</span>
                      <p className="text-[10px] text-slate-400">{new Date(adj.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-slate-500">
                  Total Credits: {formatInr(adjSummary.credit)} | Total Debits: {formatInr(adjSummary.debit)}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <select value={adjKind} onChange={(e) => setAdjKind(e.target.value as "Credit" | "Debit")}
                className="rounded border border-slate-200 px-2 py-1.5 text-sm">
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
              </select>
              <input type="number" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="Amount" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Reason" className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm" />
              <button onClick={() => { if (adjAmount && adjReason) { onAdjustment(invoice.id, adjKind, Number(adjAmount), adjReason); setAdjAmount(""); setAdjReason(""); } }}
                disabled={!adjAmount || !adjReason}
                className="rounded-lg bg-[#788023] px-3 py-1.5 text-sm text-white hover:bg-[#646b1d] disabled:opacity-40">Add</button>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Invoice Audit Trail</h4>
            <div className="space-y-2">
              <AuditEntry label="Invoice Created" date={invoice.createdAt} detail={`Status: ${invoice.status}`} />
              <AuditEntry label="Issued" date={invoice.issueDate} detail={`${formatInr(invoice.totalAmount)} to ${invoice.leadName}`} />
              {invoice.amountPaid > 0 && (
                <AuditEntry label="Payment Received" date={invoice.updatedAt} detail={`${formatInr(invoice.amountPaid)} of ${formatInr(effTotal)}`} />
              )}
              {invoice.adjustments.map((adj) => (
                <AuditEntry key={adj.id} label={`${adj.kind} Adjustment`} date={adj.createdAt} detail={`${formatInr(adj.amount)} — ${adj.reason}`} />
              ))}
              <AuditEntry label="Last Updated" date={invoice.updatedAt} detail={`Status: ${status} · Balance: ${formatInr(balance)}`} />
            </div>
          </div>
        )}
      </div>

      {/* Print-ready Invoice Layout */}
      <div className="hidden print:block print:m-8" id={`print-invoice-${invoice.id}`}>
        <div className="border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">YUGAM CONSULTING</h1>
              <p className="text-sm text-slate-500">Tax Invoice</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{invoice.invoiceNumber}</p>
              <p className="text-sm text-slate-500">Date: {formatDateDisplay(invoice.issueDate)}</p>
              <p className="text-sm text-slate-500">Due: {formatDateDisplay(invoice.dueDate)}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">From</h3>
            <p className="font-medium">{invoice.supplierLegalName || "Yugam Consulting"}</p>
            <p className="text-sm text-slate-600">{invoice.supplierAddress || "India"}</p>
            {invoice.supplierGstin && <p className="text-sm text-slate-600">GSTIN: {invoice.supplierGstin}</p>}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-1">Bill To</h3>
            <p className="font-medium">{invoice.customerLegalName || invoice.leadName}</p>
            <p className="text-sm text-slate-600">{invoice.customerAddress || ""}</p>
            {invoice.customerGstin && <p className="text-sm text-slate-600">GSTIN: {invoice.customerGstin}</p>}
          </div>
        </div>
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="py-2 text-left font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-slate-100">
                <td className="py-2">{li.serviceName || invoice.serviceName}</td>
                <td className="py-2 text-right">{li.quantity}</td>
                <td className="py-2 text-right">{formatInr(li.unitPrice)}</td>
                <td className="py-2 text-right">{formatInr(li.quantity * li.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1"><span>Subtotal</span><span>{formatInr(invoice.subtotal)}</span></div>
            {invoice.cgstAmount > 0 && <div className="flex justify-between py-1"><span>CGST ({invoice.gstRate / 2}%)</span><span>{formatInr(invoice.cgstAmount)}</span></div>}
            {invoice.sgstAmount > 0 && <div className="flex justify-between py-1"><span>SGST ({invoice.gstRate / 2}%)</span><span>{formatInr(invoice.sgstAmount)}</span></div>}
            {invoice.igstAmount > 0 && <div className="flex justify-between py-1"><span>IGST ({invoice.gstRate}%)</span><span>{formatInr(invoice.igstAmount)}</span></div>}
            <div className="flex justify-between py-2 border-t-2 border-slate-800 font-bold text-lg"><span>Total</span><span>{formatInr(effTotal)}</span></div>
            {invoice.amountPaid > 0 && <div className="flex justify-between py-1 text-emerald-600"><span>Paid</span><span>{formatInr(invoice.amountPaid)}</span></div>}
            {balance > 0 && <div className="flex justify-between py-1 text-rose-600 font-medium"><span>Balance Due</span><span>{formatInr(balance)}</span></div>}
          </div>
        </div>
        {invoice.notes && <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">{invoice.notes}</div>}
      </div>
    </div>
  );
}

function AuditEntry({ label, date, detail }: { label: string; date: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-[#788023] flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
        <p className="text-[10px] text-slate-400">{new Date(date).toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (<div><p className="text-[10px] font-medium uppercase text-slate-400">{label}</p><p className="text-sm text-slate-800">{value || "—"}</p></div>);
}

/* ================================================================== */
/* REVENUE VIEW                                                       */
/* ================================================================== */
interface RevenueViewProps {
  leads: Lead[];
  invoices: Invoice[];
}

export function RevenueView({ leads, invoices }: RevenueViewProps) {
  const [scope, setScope] = useState<MonthRangePreset>("6");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [revTab, setRevTab] = useState<"overview" | "forecast" | "clients" | "credit" | "aging" | "gst">("overview");

  const activeLeads = useMemo(() => leads.filter((l) => !l.isDeleted), [leads]);
  const activeInvoices = invoices;

  // Monthly revenue data
  const monthlyData = useMemo(() => {
    const months: Record<string, { newLeads: number; wonLeads: number; lostLeads: number; wonValue: number; lostValue: number; pipelineValue: number; collected: number; invoicesTotal: number }> = {};
    const bounds = resolveRangeBounds(scope, customStart, customEnd);

    if (bounds) {
      let current = bounds.start;
      while (current <= bounds.end) {
        months[current] = { newLeads: 0, wonLeads: 0, lostLeads: 0, wonValue: 0, lostValue: 0, pipelineValue: 0, collected: 0, invoicesTotal: 0 };
        const [y, m] = current.split("-").map(Number);
        const next = new Date(y, m, 1);
        current = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    activeLeads.forEach((l) => {
      const mk = monthKeyFromDate(l.dateAdded);
      if (months[mk]) months[mk].newLeads++;
      if (l.leadStatus === "Won") {
        const wonMK = monthKeyFromDate(l.updatedAt?.slice(0, 10) ?? l.dateAdded);
        if (months[wonMK]) { months[wonMK].wonLeads++; months[wonMK].wonValue += wonRevenueValue(l); }
      }
      if (l.leadStatus === "Lost") {
        const lostMK = monthKeyFromDate(l.updatedAt?.slice(0, 10) ?? l.dateAdded);
        if (months[lostMK]) { months[lostMK].lostLeads++; months[lostMK].lostValue += l.dealValue; }
      }
    });

    invoices.forEach((inv) => {
      const mk = monthKeyFromDate(inv.issueDate);
      if (months[mk]) { months[mk].invoicesTotal += inv.totalAmount; months[mk].collected += inv.amountPaid; }
    });

    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, data]) => ({
      monthKey,
      monthLabel: new Date(monthKey + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      ...data,
      outstanding: data.invoicesTotal - data.collected,
    }));
  }, [activeLeads, invoices, scope, customStart, customEnd]);

  // KPIs
  const kpis = useMemo(() => {
    const totalWon = activeLeads.filter((l) => l.leadStatus === "Won").reduce((s, l) => s + wonRevenueValue(l), 0);
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const totalOutstanding = totalInvoiced - totalCollected;
    const wonLeads = activeLeads.filter((l) => l.leadStatus === "Won");
    const avgDeal = wonLeads.length > 0 ? totalWon / wonLeads.length : 0;
    const pipelineValue = activeLeads.filter((l) => !["Won", "Lost"].includes(l.leadStatus)).reduce((s, l) => s + l.dealValue, 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
    // Forecast: weighted pipeline
    const statusWeights: Record<string, number> = { "New": 0.1, "Contacted": 0.2, "Qualified": 0.35, "Proposal Sent": 0.5, "Negotiation": 0.7, "Confirmation": 0.85, "Invoice Sent": 0.95 };
    const weightedPipeline = activeLeads
      .filter((l) => statusWeights[l.leadStatus] !== undefined)
      .reduce((s, l) => s + l.dealValue * (statusWeights[l.leadStatus] || 0), 0);
    return { totalWon, totalInvoiced, totalCollected, totalOutstanding, avgDeal, pipelineValue, collectionRate, wonCount: wonLeads.length, weightedPipeline };
  }, [activeLeads, invoices]);

  const maxWonValue = Math.max(1, ...monthlyData.map((m) => m.wonValue));
  const maxInvoiced = Math.max(1, ...monthlyData.map((m) => m.invoicesTotal));

  // Revenue by client
  const revenueByClient = useMemo(() => {
    const clients: Record<string, { won: number; invoiced: number; collected: number }> = {};
    activeLeads.filter((l) => l.leadStatus === "Won").forEach((l) => {
      const key = l.companyName || l.leadName;
      if (!clients[key]) clients[key] = { won: 0, invoiced: 0, collected: 0 };
      clients[key].won += wonRevenueValue(l);
    });
    invoices.forEach((inv) => {
      const key = inv.leadName;
      if (!clients[key]) clients[key] = { won: 0, invoiced: 0, collected: 0 };
      clients[key].invoiced += inv.totalAmount;
      clients[key].collected += inv.amountPaid;
    });
    return Object.entries(clients).sort(([, a], [, b]) => b.won - a.won);
  }, [activeLeads, invoices]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Revenue</h1>
          <p className="text-sm text-slate-500">Track revenue, collections, and forecast</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <option value="3">Last 3 Months</option>
            <option value="6">Last 6 Months</option>
            <option value="12">Last 12 Months</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {scope === "custom" && (
        <div className="flex gap-2">
          <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded border border-slate-200 px-2 py-1.5 text-sm" />
          <span className="py-1.5 text-sm text-slate-400">to</span>
          <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded border border-slate-200 px-2 py-1.5 text-sm" />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {([
          { key: "overview", label: "Overview", icon: "📊" },
          { key: "forecast", label: "Forecast", icon: "🔮" },
          { key: "clients", label: "By Client", icon: "👥" },
          { key: "credit", label: "Credit Notes", icon: "📋" },
          { key: "aging", label: "Aging", icon: "⏰" },
          { key: "gst", label: "GST Report", icon: "🧾" },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setRevTab(tab.key)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-all ${
              revTab === tab.key ? "border-b-2 border-[#788023] text-[#788023] bg-[#788023]/5" : "text-slate-500 hover:text-slate-700"
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {revTab === "overview" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
            {[
              { label: "Won Revenue", value: formatInr(kpis.totalWon), icon: "🏆", color: "bg-emerald-50 border-emerald-200" },
              { label: "Pipeline", value: formatInr(kpis.pipelineValue), icon: "💰", color: "bg-violet-50 border-violet-200" },
              { label: "Weighted Forecast", value: formatInr(kpis.weightedPipeline), icon: "🔮", color: "bg-indigo-50 border-indigo-200" },
              { label: "Avg Deal", value: formatInr(kpis.avgDeal), icon: "📊", color: "bg-indigo-50 border-indigo-200" },
              { label: "Won Leads", value: kpis.wonCount, icon: "✅", color: "bg-emerald-50 border-emerald-200" },
              { label: "Invoiced", value: formatInr(kpis.totalInvoiced), icon: "🧾", color: "bg-sky-50 border-sky-200" },
              { label: "Collected", value: formatInr(kpis.totalCollected), icon: "💵", color: "bg-emerald-50 border-emerald-200" },
              { label: "Outstanding", value: formatInr(kpis.totalOutstanding), icon: "⏳", color: kpis.totalOutstanding > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200" },
              { label: "Collection %", value: `${kpis.collectionRate.toFixed(1)}%`, icon: "📈", color: kpis.collectionRate >= 80 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200" },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.color}`}>
                <div className="flex items-center gap-1"><span className="text-sm">{kpi.icon}</span><span className="text-[10px] font-medium text-slate-600">{kpi.label}</span></div>
                <p className="mt-1 text-lg font-bold text-slate-800">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Monthly Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Monthly Revenue & Collections</h2>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-slate-400">No data for the selected period.</p>
            ) : (
              <div className="space-y-3">
                {monthlyData.map((m) => (
                  <div key={m.monthKey}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="w-20 text-xs font-medium text-slate-600">{m.monthLabel}</span>
                      <div className="flex-1">
                        {/* Revenue bar */}
                        <div className="h-5 rounded-full bg-slate-100 relative mb-1">
                          <div className="flex h-5 items-center rounded-full bg-[#788023]/70 px-2 text-xs font-medium text-white transition-all"
                            style={{ width: `${Math.max(5, (m.wonValue / maxWonValue) * 100)}%` }}>
                            {m.wonValue > 0 ? formatInr(m.wonValue) : ""}
                          </div>
                        </div>
                        {/* Invoiced bar */}
                        <div className="h-3 rounded-full bg-slate-100 relative">
                          <div className="flex h-3 items-center rounded-full bg-sky-400/60 px-1 text-[10px] text-white transition-all"
                            style={{ width: `${Math.max(3, (m.invoicesTotal / maxInvoiced) * 100)}%` }}>
                            {m.invoicesTotal > 0 ? formatInr(m.invoicesTotal) : ""}
                          </div>
                        </div>
                      </div>
                      <div className="w-32 text-right text-xs text-slate-500">
                        <div><span className="text-emerald-600">{m.wonLeads}W</span> · <span className="text-sky-600">{m.newLeads}N</span> · <span className="text-rose-600">{m.lostLeads}L</span></div>
                        <div className="text-[10px]">Collected: {formatInr(m.collected)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-2">
                  <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-[#788023]/70" /> Won Revenue</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-sky-400/60" /> Invoiced</span>
                </div>
              </div>
            )}
          </div>

          {/* Monthly Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Monthly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Month</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">New</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Won</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Lost</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Won ₹</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Invoiced</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Collected</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Outstanding</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Collection %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m) => (
                    <tr key={m.monthKey} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{m.monthLabel}</td>
                      <td className="px-3 py-2 text-center text-sky-600">{m.newLeads}</td>
                      <td className="px-3 py-2 text-center text-emerald-600">{m.wonLeads}</td>
                      <td className="px-3 py-2 text-center text-rose-600">{m.lostLeads}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatInr(m.wonValue)}</td>
                      <td className="px-3 py-2 text-right">{formatInr(m.invoicesTotal)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatInr(m.collected)}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{formatInr(m.outstanding)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs font-medium ${m.invoicesTotal > 0 && (m.collected / m.invoicesTotal) >= 0.8 ? "text-emerald-600" : m.invoicesTotal > 0 ? "text-amber-600" : "text-slate-400"}`}>
                          {m.invoicesTotal > 0 ? `${((m.collected / m.invoicesTotal) * 100).toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab: Forecast */}
      {revTab === "forecast" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4">
            <h3 className="text-sm font-semibold text-indigo-700">🔮 Weighted Pipeline Forecast</h3>
            <p className="text-xs text-indigo-600 mt-1">Based on stage-wise probability weighting of open pipeline deals</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">✅ Confirmed Revenue</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{formatInr(kpis.totalWon)}</p>
              <p className="text-xs text-emerald-600">{kpis.wonCount} won deals</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-medium text-indigo-700">🔮 Weighted Forecast</p>
              <p className="mt-1 text-2xl font-bold text-indigo-800">{formatInr(kpis.weightedPipeline)}</p>
              <p className="text-xs text-indigo-600">Probability-adjusted pipeline</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-medium text-violet-700">💰 Total Pipeline</p>
              <p className="mt-1 text-2xl font-bold text-violet-800">{formatInr(kpis.pipelineValue)}</p>
              <p className="text-xs text-violet-600">Unweighted open pipeline</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Pipeline by Stage (Weighted)</h3>
            {(() => {
              const stages = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent"];
              const weights: Record<string, number> = { "New": 10, "Contacted": 20, "Qualified": 35, "Proposal Sent": 50, "Negotiation": 70, "Confirmation": 85, "Invoice Sent": 95 };
              const stageData = stages.map((stage) => {
                const stageLeads = activeLeads.filter((l) => l.leadStatus === stage);
                const value = stageLeads.reduce((s, l) => s + l.dealValue, 0);
                const weighted = value * (weights[stage] || 0) / 100;
                return { stage, count: stageLeads.length, value, weighted, probability: weights[stage] };
              });
              const maxVal = Math.max(1, ...stageData.map((s) => s.value));
              return (
                <div className="space-y-2">
                  {stageData.filter((s) => s.count > 0).map((s) => (
                    <div key={s.stage}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{s.stage} <span className="text-slate-400">({s.probability}%)</span></span>
                        <span className="text-slate-500">{s.count} deals · {formatInr(s.value)} → <span className="text-indigo-600 font-medium">{formatInr(s.weighted)}</span></span>
                      </div>
                      <div className="flex h-4 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-4 rounded-full bg-indigo-400/70 transition-all" style={{ width: `${(s.value / maxVal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab: By Client */}
      {revTab === "clients" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Won Revenue</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Invoiced</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Collected</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {revenueByClient.map(([client, data]) => (
                  <tr key={client} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{client}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{formatInr(data.won)}</td>
                    <td className="px-3 py-2 text-right">{formatInr(data.invoiced)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{formatInr(data.collected)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={data.invoiced - data.collected > 0 ? "font-medium text-rose-600" : "text-slate-400"}>
                        {formatInr(data.invoiced - data.collected)}
                      </span>
                    </td>
                  </tr>
                ))}
                {revenueByClient.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No revenue data by client yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Credit Notes */}
      {revTab === "credit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Credit Notes & Adjustments</h3>
              <p className="text-xs text-slate-500">Manage credit notes, refunds, and invoice adjustments</p>
            </div>
            <button type="button" className="rounded-lg bg-[#788023] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#646b1d]">
              + New Credit Note
            </button>
          </div>
          {/* Credit Note KPIs */}
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Total Credit Notes</p>
              <p className="text-2xl font-bold text-slate-800">{activeInvoices.filter((inv) => inv.status === "Cancelled").length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Total Credit Value</p>
              <p className="text-2xl font-bold text-rose-600">{formatInr(activeInvoices.filter((inv) => inv.status === "Cancelled").reduce((s, inv) => s + inv.totalAmount, 0))}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Active Adjustments</p>
              <p className="text-2xl font-bold text-amber-600">{activeInvoices.filter((inv) => inv.adjustments && inv.adjustments.length > 0).length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Refunds Issued</p>
              <p className="text-2xl font-bold text-violet-600">{formatInr(activeInvoices.filter((inv) => inv.amountPaid > inv.totalAmount).reduce((s, inv) => s + (inv.amountPaid - inv.totalAmount), 0))}</p>
            </div>
          </div>
          {/* Credit Notes Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Original</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Adjustment</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Credited</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Reason</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeInvoices.filter((inv) => inv.status === "Cancelled" || (inv.adjustments && inv.adjustments.length > 0)).map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2 text-slate-600">{inv.leadName}</td>
                    <td className="px-3 py-2 text-right">{formatInr(inv.subtotal)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{inv.adjustments?.[0] ? formatInr(inv.adjustments[0].amount) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatInr(inv.totalAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
                        {inv.status === "Cancelled" ? "Cancellation" : "Adjustment"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${inv.status === "Cancelled" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {activeInvoices.filter((inv) => inv.status === "Cancelled" || (inv.adjustments && inv.adjustments.length > 0)).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No credit notes or adjustments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Aging Analysis */}
      {revTab === "aging" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Accounts Receivable Aging</h3>
          <p className="text-xs text-slate-500">Outstanding invoices bucketed by days overdue</p>
          {/* Aging KPIs */}
          {(() => {
            const today = new Date();
            const unpaid = activeInvoices.filter((inv) => inv.status !== "Cancelled" && inv.amountPaid < inv.totalAmount);
            const buckets = [
              { label: "Current (0-7 days)", min: 0, max: 7, color: "bg-emerald-500" },
              { label: "8-15 Days", min: 8, max: 15, color: "bg-sky-500" },
              { label: "16-30 Days", min: 16, max: 30, color: "bg-amber-500" },
              { label: "31-45 Days", min: 31, max: 45, color: "bg-orange-500" },
              { label: "46-60 Days", min: 46, max: 60, color: "bg-rose-500" },
              { label: "60+ Days", min: 61, max: 9999, color: "bg-red-700" },
            ];
            const agingData = buckets.map((b) => {
              const matching = unpaid.filter((inv) => {
                const days = Math.floor((today.getTime() - new Date(inv.issueDate).getTime()) / 86400000);
                return days >= b.min && days <= b.max;
              });
              const total = matching.reduce((s, inv) => s + (inv.totalAmount - inv.amountPaid), 0);
              return { ...b, count: matching.length, total };
            });
            const maxTotal = Math.max(1, ...agingData.map((a) => a.total));
            return (
              <div className="space-y-3">
                {agingData.map((a) => (
                  <div key={a.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${a.color}`} />
                        <span className="text-sm font-medium text-slate-700">{a.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{a.count} invoice{a.count !== 1 ? "s" : ""}</span>
                        <span className="text-sm font-bold text-slate-800">{formatInr(a.total)}</span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-3 rounded-full ${a.color} transition-all`} style={{ width: `${(a.total / maxTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {/* Summary */}
                <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Total Outstanding</span>
                    <span className="text-lg font-bold text-rose-600">{formatInr(agingData.reduce((s, a) => s + a.total, 0))}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">{unpaid.length} unpaid invoices</span>
                    <span className="text-xs text-slate-500">Weighted average: {(() => {
                      const totalOutstanding = agingData.reduce((s, a) => s + a.total, 0);
                      const totalInvoices = agingData.reduce((s, a) => s + a.count, 0);
                      return totalInvoices > 0 ? `${(totalOutstanding / totalInvoices).toFixed(0)} avg per invoice` : "—";
                    })()}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Detailed Outstanding Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Paid</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Outstanding</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Days Overdue</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Dunning Stage</th>
                </tr>
              </thead>
              <tbody>
                {activeInvoices.filter((inv) => inv.status !== "Cancelled" && inv.amountPaid < inv.totalAmount).sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()).map((inv) => {
                  const days = Math.floor((Date.now() - new Date(inv.issueDate).getTime()) / 86400000);
                  const outstanding = inv.totalAmount - inv.amountPaid;
                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{inv.leadName}</td>
                      <td className="px-3 py-2 text-right">{formatInr(inv.totalAmount)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatInr(inv.amountPaid)}</td>
                      <td className="px-3 py-2 text-right font-medium text-rose-600">{formatInr(outstanding)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${days > 60 ? "bg-red-100 text-red-700" : days > 30 ? "bg-orange-100 text-orange-700" : days > 15 ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                          {days}d
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">{days > 60 ? "D15+" : days > 15 ? "D8-D15" : days > 7 ? "D4-D7" : "D1-D3"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: GST Summary */}
      {revTab === "gst" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">GST Report Summary</h3>
          <p className="text-xs text-slate-500">Consolidated GST data for all invoices in the selected period</p>
          {(() => {
            const gstData = activeInvoices.filter((inv) => inv.status !== "Cancelled");
            const totalSubTotal = gstData.reduce((s, inv) => s + inv.subtotal, 0);
            const totalCGST = gstData.reduce((s, inv) => s + (inv.cgstAmount || 0), 0);
            const totalSGST = gstData.reduce((s, inv) => s + (inv.sgstAmount || 0), 0);
            const totalIGST = gstData.reduce((s, inv) => s + (inv.igstAmount || 0), 0);
            const totalTax = totalCGST + totalSGST + totalIGST;
            const totalGrand = gstData.reduce((s, inv) => s + inv.totalAmount, 0);
            return (
              <>
                {/* GST KPIs */}
                <div className="grid gap-3 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Taxable Value</p>
                    <p className="text-xl font-bold text-slate-800">{formatInr(totalSubTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">CGST</p>
                    <p className="text-xl font-bold text-sky-600">{formatInr(totalCGST)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">SGST</p>
                    <p className="text-xl font-bold text-violet-600">{formatInr(totalSGST)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">IGST</p>
                    <p className="text-xl font-bold text-amber-600">{formatInr(totalIGST)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">Total Tax</p>
                    <p className="text-xl font-bold text-rose-600">{formatInr(totalTax)}</p>
                  </div>
                </div>
                {/* Tax breakdown chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4">Tax Composition</h4>
                  <div className="flex items-center gap-6">
                    <div className="space-y-2 flex-1">
                      {totalTax > 0 && (
                        <>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600">CGST ({totalCGST > 0 ? `${((totalCGST / totalTax) * 100).toFixed(1)}%` : "0%"})</span>
                              <span className="font-medium text-sky-600">{formatInr(totalCGST)}</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-3 rounded-full bg-sky-500" style={{ width: `${(totalCGST / totalTax) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600">SGST ({totalSGST > 0 ? `${((totalSGST / totalTax) * 100).toFixed(1)}%` : "0%"})</span>
                              <span className="font-medium text-violet-600">{formatInr(totalSGST)}</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-3 rounded-full bg-violet-500" style={{ width: `${(totalSGST / totalTax) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-600">IGST ({totalIGST > 0 ? `${((totalIGST / totalTax) * 100).toFixed(1)}%` : "0%"})</span>
                              <span className="font-medium text-amber-600">{formatInr(totalIGST)}</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-3 rounded-full bg-amber-500" style={{ width: `${(totalIGST / totalTax) * 100}%` }} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Grand Total</p>
                      <p className="text-2xl font-bold text-slate-800">{formatInr(totalGrand)}</p>
                      <p className="text-[10px] text-slate-400">{gstData.length} invoices</p>
                    </div>
                  </div>
                </div>
                {/* Per-Invoice GST Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Client</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Taxable</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">CGST</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">SGST</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">IGST</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Tax</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstData.map((inv) => (
                        <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2 text-slate-600">{inv.leadName}</td>
                          <td className="px-3 py-2 text-right">{formatInr(inv.subtotal)}</td>
                          <td className="px-3 py-2 text-right text-sky-600">{formatInr(inv.cgstAmount || 0)}</td>
                          <td className="px-3 py-2 text-right text-violet-600">{formatInr(inv.sgstAmount || 0)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{formatInr(inv.igstAmount || 0)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatInr((inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0))}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-800">{formatInr(inv.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
