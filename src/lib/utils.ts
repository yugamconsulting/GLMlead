// =====================================================================
// UTILITY FUNCTIONS — Extracted from App.tsx (18,000+ line monolith)
// =====================================================================

import type {
  AppSettings,
  BillingCycle,
  DateRange,
  DunningStage,
  GstMode,
  Invoice,
  InvoiceAdjustment,
  InvoiceDraft,
  InvoiceLineItem,
  InvoiceStatus,
  Lead,
  LeadSlaTier,
  LeadSource,
  LeadStatus,
  MonthRangePreset,
  NeglectRisk,
  PaymentStatus,
  PlanPresetKey,
  PlanTemplate,
  PipelineWipLimitMap,
  RangeBounds,
  ServiceType,
  Tenant,
  TenantEntitlementDraft,
  TenantLifecycleResult,
  TenantSubscription,
  TrendResult,
} from "../types/index";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_BILLING_CYCLE,
  DEFAULT_GRACE_DAYS,
  DEFAULT_SERVICES,
  DEFAULT_TENANT_ID,
  PIPELINE_WIP_CONFIGURABLE_STATUSES,
  PIPELINE_WIP_LIMITS,
  PLAN_PRICING_MONTHLY_INR,
  SYSTEM_PLAN_TEMPLATES,
} from "../constants/index";

// =====================================================================
// ID & Crypto
// =====================================================================

export const makeId = (): string =>
  Math.random().toString(36).slice(2, 10);

export function generateRecoveryPassword(length = 24): string {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += charset[Math.floor(Math.random() * charset.length)];
  }
  return output;
}

import bcrypt from "bcryptjs";

export async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Check if it's a bcrypt hash (starts with $2)
    if (hash.startsWith('$2')) {
      return bcrypt.compare(password, hash);
    }
    // Legacy SHA-256 support for migration
    const shaHash = await sha256(password);
    return shaHash === hash;
  } catch {
    return false;
  }
}

// =====================================================================
// Date Helpers
// =====================================================================

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthKeyFromDate(dateValue: string): string {
  if (!dateValue || dateValue.length < 7) return "";
  return dateValue.slice(0, 7);
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function quarterStartISODate(): string {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), quarterStartMonth, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftISODate(baseISO: string, dayDelta: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return d.toISOString().slice(0, 10);
}

export function shiftISOMonths(baseISO: string, monthDelta: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setMonth(d.getMonth() + monthDelta);
  return d.toISOString().slice(0, 10);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function oneYearFrom(dateISO: string): string {
  const d = new Date(dateISO);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

export function addDaysFrom(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function addMonthsIso(baseIso: string, months: number): string {
  const dt = new Date(baseIso);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString();
}

export function daysSince(dateISO: string): number {
  if (!dateISO) return 0;
  const ts = new Date(dateISO).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

export function daysUntil(dateISO: string): number | null {
  if (!dateISO) return null;
  const end = new Date(dateISO).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

export function stageCadenceDays(status: LeadStatus): number {
  if (status === "New" || status === "Contacted") return 1;
  if (status === "Qualified") return 2;
  if (
    status === "Proposal Sent" ||
    status === "Negotiation" ||
    status === "Confirmation" ||
    status === "Invoice Sent"
  )
    return 1;
  return 0;
}

// =====================================================================
// Dashboard Date Range
// =====================================================================

export function resolveDashboardDateRange(
  scope: string,
  customStart: string,
  customEnd: string
): DateRange {
  const today = todayISODate();
  if (scope === "all") {
    return { start: null, end: null, label: "All-time" };
  }
  if (scope === "today") {
    return { start: today, end: today, label: "Today" };
  }
  if (scope === "yesterday") {
    const yesterday = shiftISODate(today, -1);
    return { start: yesterday, end: yesterday, label: "Yesterday" };
  }
  if (scope === "last7") {
    return { start: shiftISODate(today, -6), end: today, label: "Last 7 days" };
  }
  if (scope === "last30") {
    return { start: shiftISODate(today, -29), end: today, label: "Last 30 days" };
  }
  if (scope === "mtd") {
    return { start: `${currentMonthKey()}-01`, end: today, label: "Month to date" };
  }
  if (scope === "qtd") {
    return { start: quarterStartISODate(), end: today, label: "Quarter to date" };
  }
  if (scope === "lastMonth") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
      label: "Last month",
    };
  }
  if (scope === "custom") {
    if (!customStart || !customEnd) {
      return { start: null, end: null, label: "Custom range (set start and end dates)" };
    }
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { start, end, label: `Custom: ${start} to ${end}` };
  }
  return { start: null, end: null, label: "All-time" };
}

// =====================================================================
// Month Range Helpers
// =====================================================================

export function resolveRangeBounds(
  preset: MonthRangePreset,
  customStart: string,
  customEnd: string
): RangeBounds | null {
  if (preset === "custom") {
    if (!customStart || !customEnd) return null;
    return customStart <= customEnd
      ? { start: customStart, end: customEnd }
      : { start: customEnd, end: customStart };
  }
  const end = currentMonthKey();
  const span = Number(preset);
  const start = shiftMonthKey(end, -(span - 1));
  return { start, end };
}

export function filterRowsByMonthRange<T extends { monthKey: string }>(
  rows: T[],
  preset: MonthRangePreset,
  customStart: string,
  customEnd: string
): T[] {
  const bounds = resolveRangeBounds(preset, customStart, customEnd);
  if (!bounds) return rows;
  return rows.filter((row) => row.monthKey >= bounds.start && row.monthKey <= bounds.end);
}

// =====================================================================
// Lead Scoring & Health
// =====================================================================

export function isOpenLeadStatus(status: LeadStatus): boolean {
  return status !== "Won" && status !== "Lost";
}

export function neglectDays(lead: Lead): number {
  return daysSince(lead.lastContactedDate || lead.dateAdded);
}

export function dateTag(
  lead: Lead
): "Overdue" | "Due Today" | "Upcoming" | "Done" {
  if (lead.followupStatus === "Done") return "Done";
  if (!lead.nextFollowupDate) return "Upcoming";
  const today = todayISODate();
  if (lead.nextFollowupDate < today) return "Overdue";
  if (lead.nextFollowupDate === today) return "Due Today";
  return "Upcoming";
}

export function followupTagClass(
  tag: "Overdue" | "Due Today" | "Upcoming" | "Done"
): string {
  if (tag === "Overdue") return "bg-rose-100 text-rose-700";
  if (tag === "Due Today") return "bg-amber-100 text-amber-700";
  if (tag === "Done") return "bg-emerald-100 text-emerald-700";
  return "bg-sky-100 text-sky-700";
}

export function safeDealValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function sourcePriorityWeight(source: LeadSource): number {
  const weights: Record<string, number> = {
    Referral: 20,
    LinkedIn: 14,
    Website: 12,
    "Meta Ads": 10,
    WhatsApp: 8,
    "Cold Outreach": 6,
    Others: 5,
  };
  return weights[source] ?? 5;
}

export function isValidPhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function contactabilityBadge(lead: Lead): {
  label: string;
  className: string;
} {
  const phoneOk = isValidPhone(lead.phoneNumber);
  const emailOk = isValidEmail(lead.emailId) && !!lead.emailId.trim();
  if (phoneOk && emailOk)
    return { label: "Strong", className: "bg-emerald-100 text-emerald-700" };
  if (phoneOk || emailOk)
    return { label: "Partial", className: "bg-amber-100 text-amber-700" };
  return { label: "Weak", className: "bg-rose-100 text-rose-700" };
}

export function leadHealthScore(lead: Lead): number {
  if (!isOpenLeadStatus(lead.leadStatus)) return 100;
  const tag = dateTag(lead);
  const neglectPenalty = Math.min(35, neglectDays(lead) * 3);
  const followupPenalty =
    lead.followupStatus === "Done"
      ? 0
      : tag === "Overdue"
        ? 28
        : tag === "Due Today"
          ? 14
          : lead.nextFollowupDate
            ? 6
            : 18;
  const contactBoost =
    contactabilityBadge(lead).label === "Strong"
      ? 10
      : contactabilityBadge(lead).label === "Partial"
        ? 4
        : -8;
  const stageBoost =
    lead.leadTemperature === "Hot"
      ? 8
      : lead.leadTemperature === "Warm"
        ? 5
        : 2;
  return Math.max(
    1,
    Math.min(
      100,
      72 + stageBoost + contactBoost - followupPenalty - neglectPenalty
    )
  );
}

export function leadSlaTier(lead: Lead): LeadSlaTier {
  if (!isOpenLeadStatus(lead.leadStatus)) return "ok";
  const days = neglectDays(lead);
  if (days >= 21) return "critical";
  if (days >= 14) return "escalate";
  if (days >= 7) return "watch";
  return "ok";
}

export function pipelinePriorityScore(lead: Lead): number {
  const followupBoost =
    lead.followupStatus === "Pending"
      ? lead.nextFollowupDate && lead.nextFollowupDate < todayISODate()
        ? 24
        : lead.nextFollowupDate === todayISODate()
          ? 16
          : 8
      : 2;
  const tempBoost =
    lead.leadTemperature === "Hot"
      ? 30
      : lead.leadTemperature === "Warm"
        ? 18
        : 8;
  const sourceBoost = sourcePriorityWeight(lead.leadSource);
  const valueBoost = Math.min(
    22,
    Math.floor(safeDealValue(lead.dealValue) / 50000)
  );
  const inactivityPenalty = Math.min(18, neglectDays(lead));
  return Math.max(
    1,
    Math.min(
      100,
      tempBoost + sourceBoost + followupBoost + valueBoost - inactivityPenalty
    )
  );
}

export function urgencyLabel(lead: Lead): string {
  const tag = dateTag(lead);
  return `Urgency: ${tag}`;
}

export function neglectRisk(lead: Lead): NeglectRisk {
  const days = neglectDays(lead);
  if (days >= 10) return "High";
  if (days >= 5) return "Medium";
  return "Low";
}

export function neglectRiskClass(risk: NeglectRisk): string {
  if (risk === "High") return "bg-rose-100 text-rose-700";
  if (risk === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

// =====================================================================
// Follow-up Helpers
// =====================================================================

export function followupQueueKey(
  lead: Lead
): "overdue" | "today" | "upcoming" | "no-date" {
  if (!lead.nextFollowupDate) return "no-date";
  const today = todayISODate();
  if (lead.nextFollowupDate < today) return "overdue";
  if (lead.nextFollowupDate === today) return "today";
  return "upcoming";
}

export function followupDaysDelta(lead: Lead): number | null {
  if (!lead.nextFollowupDate) return null;
  const dueMs = new Date(`${lead.nextFollowupDate}T00:00:00`).getTime();
  if (Number.isNaN(dueMs)) return null;
  const todayMs = new Date(`${todayISODate()}T00:00:00`).getTime();
  return Math.floor((dueMs - todayMs) / (24 * 60 * 60 * 1000));
}

// =====================================================================
// Revenue & Payment Helpers
// =====================================================================

export function wonRevenueValue(lead: Lead): number {
  if (lead.wonDealValue !== null && Number.isFinite(lead.wonDealValue)) {
    return lead.wonDealValue;
  }
  return safeDealValue(lead.dealValue);
}

export function outstandingAmount(lead: Lead): number {
  if (lead.leadStatus !== "Won") return 0;
  return Math.max(
    0,
    wonRevenueValue(lead) - Math.max(0, lead.collectedAmount ?? 0)
  );
}

export function inferPaymentStatus(lead: Lead): PaymentStatus {
  if (lead.leadStatus !== "Won") return "Not Invoiced";
  const wonValue = wonRevenueValue(lead);
  const collected = Math.max(0, lead.collectedAmount ?? 0);
  if (wonValue > 0 && collected >= wonValue) return "Fully Collected";
  if (collected > 0) return "Partially Collected";
  return "Not Invoiced";
}

export function getTrend(current: number, previous: number): TrendResult {
  const delta = current - previous;
  if (previous === 0) {
    if (current === 0)
      return { arrow: "→", className: "text-slate-500", value: "0.0%" };
    return { arrow: "↑", className: "text-emerald-600", value: "100.0%" };
  }
  const pct = (delta / previous) * 100;
  if (Math.abs(pct) < 0.05)
    return { arrow: "→", className: "text-slate-500", value: "0.0%" };
  return pct > 0
    ? {
        arrow: "↑",
        className: "text-emerald-600",
        value: `${Math.abs(pct).toFixed(1)}%`,
      }
    : {
        arrow: "↓",
        className: "text-rose-600",
        value: `${Math.abs(pct).toFixed(1)}%`,
      };
}

// =====================================================================
// Invoice Calculations
// =====================================================================

export function sanitizeInvoiceLineItem(
  item: Partial<InvoiceLineItem>
): InvoiceLineItem {
  return {
    id: item.id ?? makeId(),
    serviceName: (item.serviceName ?? "").trim(),
    description: item.description ?? "",
    sacCode: (item.sacCode ?? "").replace(/\D/g, "").slice(0, 8),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    gstRate: Math.max(0, Number(item.gstRate) || 0),
  };
}

export function invoiceAmountsFromItems(
  items: InvoiceLineItem[],
  gstMode: GstMode
) {
  const normalizedItems = items.map((item) =>
    sanitizeInvoiceLineItem(item)
  );
  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxTotal = normalizedItems.reduce(
    (sum, item) =>
      sum + (item.quantity * item.unitPrice * item.gstRate) / 100,
    0
  );
  const cgstAmount = gstMode === "Intra" ? taxTotal / 2 : 0;
  const sgstAmount = gstMode === "Intra" ? taxTotal / 2 : 0;
  const igstAmount = gstMode === "Inter" ? taxTotal : 0;
  return {
    items: normalizedItems,
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: subtotal + cgstAmount + sgstAmount + igstAmount,
  };
}

export function invoiceAmountsFromDraft(draft: InvoiceDraft) {
  const derivedItems =
    draft.lineItems && draft.lineItems.length > 0
      ? draft.lineItems
      : [
          {
            id: makeId(),
            serviceName: draft.serviceName,
            description: draft.description,
            sacCode: draft.sacCode,
            quantity: draft.quantity,
            unitPrice: draft.unitPrice,
            gstRate: draft.gstRate,
          },
        ];
  const amounts = invoiceAmountsFromItems(derivedItems, draft.gstMode);
  const primary = amounts.items[0] ?? sanitizeInvoiceLineItem({});
  return {
    lineItems: amounts.items,
    quantity: primary.quantity,
    unitPrice: primary.unitPrice,
    gstRate: primary.gstRate,
    subtotal: amounts.subtotal,
    cgstAmount: amounts.cgstAmount,
    sgstAmount: amounts.sgstAmount,
    igstAmount: amounts.igstAmount,
    totalAmount: amounts.totalAmount,
  };
}

export function normalizeInvoiceStatus(
  invoice: Invoice,
  effectiveTotal = invoice.totalAmount
): InvoiceStatus {
  if (invoice.status === "Cancelled") return "Cancelled";
  if (invoice.amountPaid >= effectiveTotal && effectiveTotal > 0)
    return "Paid";
  if (invoice.amountPaid > 0) {
    if (invoice.dueDate && invoice.dueDate < todayISODate()) return "Overdue";
    return "Partially Paid";
  }
  if (invoice.status === "Draft") return "Draft";
  if (invoice.dueDate && invoice.dueDate < todayISODate()) return "Overdue";
  return "Issued";
}

export function isInvoiceSentStatus(status: InvoiceStatus): boolean {
  return (
    status === "Issued" ||
    status === "Partially Paid" ||
    status === "Paid" ||
    status === "Overdue"
  );
}

export function invoiceTaxTotal(invoice: Invoice): number {
  return invoice.cgstAmount + invoice.sgstAmount + invoice.igstAmount;
}

export function invoiceLabelForDoc(
  invoice: Pick<Invoice, "supplierGstin" | "cgstAmount" | "sgstAmount" | "igstAmount">
): string {
  const hasGstSignal =
    Boolean(invoice.supplierGstin?.trim()) ||
    invoice.cgstAmount > 0 ||
    invoice.sgstAmount > 0 ||
    invoice.igstAmount > 0;
  return hasGstSignal ? "GST Invoice" : "Invoice";
}

export function invoiceAdjustmentSummary(adjustments: InvoiceAdjustment[]) {
  return adjustments.reduce(
    (acc, adjustment) => {
      if (adjustment.kind === "Credit") acc.credit += adjustment.amount;
      if (adjustment.kind === "Debit") acc.debit += adjustment.amount;
      return acc;
    },
    { credit: 0, debit: 0 }
  );
}

export function invoiceEffectiveTotal(
  invoice: Invoice,
  adjustments: InvoiceAdjustment[]
): number {
  const summary = invoiceAdjustmentSummary(adjustments);
  return Math.max(0, invoice.totalAmount + summary.debit - summary.credit);
}

export function invoiceOverdueDays(
  invoice: Invoice,
  effectiveTotal: number
): number {
  const status = normalizeInvoiceStatus(invoice, effectiveTotal);
  if (status !== "Overdue") return 0;
  if (!invoice.dueDate) return 0;
  return Math.max(0, daysSince(invoice.dueDate));
}

export function nextInvoiceNumber(
  existingInvoices: Invoice[],
  tenantSlug: string
): string {
  const year = new Date().getFullYear();
  const prefix = `${tenantSlug.toUpperCase()}-${year}-`;
  const maxSeq = existingInvoices
    .filter((invoice) => invoice.invoiceNumber.startsWith(prefix))
    .map((invoice) => Number(invoice.invoiceNumber.slice(prefix.length)))
    .filter((seq) => Number.isFinite(seq))
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

// =====================================================================
// Dunning
// =====================================================================

export function dunningStageFromDays(
  overdueDays: number
): DunningStage {
  if (overdueDays <= 0) return "On Track";
  if (overdueDays <= 3) return "D1-D3";
  if (overdueDays <= 7) return "D4-D7";
  if (overdueDays <= 15) return "D8-D15";
  return "D15+";
}

export function dunningPlaybookForStage(stage: DunningStage): string {
  if (stage === "D1-D3")
    return "Gentle reminder with invoice and due-date context";
  if (stage === "D4-D7")
    return "Follow-up on payment promise and confirm collection timeline";
  if (stage === "D8-D15")
    return "Escalate tone, request committed date, tag collections owner";
  if (stage === "D15+")
    return "Manager escalation with final collection commitment";
  return "Invoice is on track";
}

// =====================================================================
// Tenant / Subscription / Plan Helpers
// =====================================================================

export function tenantLifecycle(
  tenant: Tenant
): TenantLifecycleResult {
  const nowMs = Date.now();
  const endMs = new Date(tenant.licenseEndDate).getTime();
  const daysToExpiry = Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000));
  const daysPastDue = Math.max(
    0,
    Math.ceil((nowMs - endMs) / (24 * 60 * 60 * 1000))
  );
  const inGrace = daysToExpiry < 0 && daysPastDue <= tenant.graceDays;
  let status: "Active" | "Grace" | "Expired" | "Suspended" = "Active";
  if (!tenant.isActive) {
    status = "Suspended";
  } else if (inGrace) {
    status = "Grace";
  } else if (daysToExpiry < 0) {
    status = "Expired";
  }
  return {
    status,
    daysToExpiry,
    daysPastDue,
    inGrace,
    isBlocked: status === "Suspended" || status === "Expired",
  };
}

export function cycleMonths(cycle: BillingCycle): number {
  if (cycle === "monthly") return 1;
  if (cycle === "quarterly") return 3;
  return 12;
}

export function planKeyFromName(planName: string): PlanPresetKey {
  const value = planName.trim().toLowerCase();
  if (value.includes("starter") || value.includes("lite")) return "starter";
  if (value.includes("scale")) return "scale";
  if (value.includes("enterprise")) return "enterprise";
  return "growth";
}

export function planAmountForCycle(
  planName: string,
  cycle: BillingCycle
): number {
  const monthly =
    PLAN_PRICING_MONTHLY_INR[planKeyFromName(planName)] ??
    PLAN_PRICING_MONTHLY_INR.growth;
  return monthly * cycleMonths(cycle);
}

export function buildSubscriptionFromTenant(
  tenant: Tenant
): TenantSubscription {
  const renewalDate =
    tenant.licenseEndDate || oneYearFrom(new Date().toISOString());
  const graceEndsAt = addDaysFrom(
    renewalDate,
    Math.max(0, tenant.graceDays || DEFAULT_GRACE_DAYS)
  );
  return {
    id: `sub-${tenant.id}`,
    tenantId: tenant.id,
    productMode: tenant.productMode,
    planName: tenant.planName,
    planTemplateId: tenant.planTemplateId ?? null,
    billingCycle: DEFAULT_BILLING_CYCLE as BillingCycle,
    autoRenew: tenant.autoRenew,
    renewalDate,
    graceEndsAt,
    status: tenant.isActive ? "active" : "suspended",
    retryCount: 0,
    nextRetryAt: "",
    scheduledDowngradePlanTemplateId: null,
    scheduledDowngradeAt: "",
    createdAt: tenant.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function computeUpgradeProration(
  fromPlan: string,
  toPlan: string,
  cycle: BillingCycle,
  renewalDate: string
): number {
  const currentAmount = planAmountForCycle(fromPlan, cycle);
  const targetAmount = planAmountForCycle(toPlan, cycle);
  const delta = targetAmount - currentAmount;
  if (delta <= 0) return 0;
  const remainingDays = Math.max(
    0,
    Math.ceil(
      (new Date(renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    )
  );
  const cycleDays = cycleMonths(cycle) * 30;
  const fraction = Math.min(1, remainingDays / cycleDays);
  return Math.round(delta * fraction);
}

export function toTenantDraft(tenant: Tenant): TenantEntitlementDraft {
  return {
    name: tenant.name,
    slug: tenant.slug,
    productMode: tenant.productMode,
    planName: tenant.planName,
    maxUsers: tenant.maxUsers,
    maxLeadsPerMonth: tenant.maxLeadsPerMonth,
    graceDays: tenant.graceDays,
    featureExports: tenant.featureExports,
    featureAdvancedForecast: tenant.featureAdvancedForecast,
    featureInvoicing: tenant.featureInvoicing,
    requireGstCompliance: tenant.requireGstCompliance,
    invoiceProfile: tenant.invoiceProfile,
    auditRetentionDays: tenant.auditRetentionDays,
  };
}

export function inferSystemTemplateId(planName: string): string | null {
  const normalized = planName.trim().toLowerCase();
  const found = SYSTEM_PLAN_TEMPLATES.find(
    (template) => template.name.toLowerCase() === normalized
  );
  return found?.id ?? null;
}

export function templateToTenantPatch(
  template: PlanTemplate
): Partial<Tenant> {
  return {
    planName: template.name,
    maxUsers: template.maxUsers,
    maxLeadsPerMonth: template.maxLeadsPerMonth,
    graceDays: template.graceDays,
    featureExports: template.featureExports,
    featureAdvancedForecast: template.featureAdvancedForecast,
    featureInvoicing: template.featureInvoicing,
    requireGstCompliance: template.requireGstCompliance,
    auditRetentionDays: template.auditRetentionDays,
  };
}

export function normalizePlanTemplates(loaded: PlanTemplate[]): PlanTemplate[] {
  const userTemplates = loaded
    .filter((template) => !template.isSystemPreset)
    .map((template) => ({
      ...template,
      description: template.description ?? "",
      monthlyPriceInr: Math.max(0, Number(template.monthlyPriceInr) || 0),
      offerLabel: (template.offerLabel ?? "").trim(),
      maxUsers: Math.max(1, template.maxUsers ?? 1),
      maxLeadsPerMonth: Math.max(1, template.maxLeadsPerMonth ?? 1),
      graceDays: Math.max(0, template.graceDays ?? DEFAULT_GRACE_DAYS),
      featureExports: template.featureExports ?? true,
      featureAdvancedForecast: template.featureAdvancedForecast ?? true,
      featureInvoicing: template.featureInvoicing ?? true,
      requireGstCompliance: template.requireGstCompliance ?? true,
      auditRetentionDays: Math.max(
        30,
        template.auditRetentionDays ?? 365
      ),
      isActive: template.isActive ?? true,
      updatedAt: template.updatedAt ?? new Date().toISOString(),
    }));
  const mergedSystem = SYSTEM_PLAN_TEMPLATES.map((systemTemplate) => {
    const existing = loaded.find(
      (template) => template.id === systemTemplate.id
    );
    return existing
      ? {
          ...existing,
          ...systemTemplate,
          isSystemPreset: true,
          isActive: true,
          updatedAt: existing.updatedAt ?? systemTemplate.updatedAt,
        }
      : systemTemplate;
  });
  return [...mergedSystem, ...userTemplates];
}

// =====================================================================
// CSV / Import-Export Helpers
// =====================================================================

export function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<string[]>
): void {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, payload: unknown): void {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

// =====================================================================
// Formatting
// =====================================================================

export function formatInr(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "₹0";
  const absVal = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absVal >= 10000000) {
    return `${sign}₹${(absVal / 10000000).toFixed(2)} Cr`;
  }
  if (absVal >= 100000) {
    return `${sign}₹${(absVal / 100000).toFixed(2)} L`;
  }

  return `${sign}₹${absVal.toLocaleString("en-IN")}`;
}

export function formatDateDisplay(value: string): string {
  if (!value) return "—";
  try {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTimeDisplay(value: string): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey;
  try {
    const [year, month] = monthKey.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return monthKey;
  }
}

// =====================================================================
// Storage Helpers
// =====================================================================

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or other error — silently ignore
  }
}

// =====================================================================
// Status Parsing
// =====================================================================

export function extractStatusFromChange(change: string): string {
  const match = change.match(/^Lead Status:\s.+->\s(.+)$/);
  return match ? match[1].trim() : "";
}

export function parseLeadStatusTransition(change: string): {
  from: string;
  to: string;
} | null {
  const match = change.match(/^Lead Status:\s(.+)\s->\s(.+)$/);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}

// =====================================================================
// Pipeline WIP Limits
// =====================================================================

export function normalizePipelineWipLimits(
  limitMap?: PipelineWipLimitMap | null
): PipelineWipLimitMap {
  const normalized: PipelineWipLimitMap = {};
  PIPELINE_WIP_CONFIGURABLE_STATUSES.forEach((status) => {
    const fallback = PIPELINE_WIP_LIMITS[status] ?? 0;
    const raw = limitMap?.[status];
    const parsed = Number(raw);
    normalized[status] =
      Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  });
  return normalized;
}

export function loadPipelineWipLimitsByTenant(): Record<
  string,
  PipelineWipLimitMap
> {
  const loaded = loadJson<Record<string, PipelineWipLimitMap>>(
    "lt_pipeline_wip_limits",
    {}
  );
  const normalized: Record<string, PipelineWipLimitMap> = Object.fromEntries(
    Object.entries(loaded).map(([tenantId, limits]) => [
      tenantId,
      normalizePipelineWipLimits(limits),
    ])
  );
  return {
    ...normalized,
    [DEFAULT_TENANT_ID]: normalizePipelineWipLimits(
      normalized[DEFAULT_TENANT_ID]
    ),
  };
}

// =====================================================================
// Settings Normalization
// =====================================================================

export function normalizeAppSettings(
  partial: Partial<AppSettings>
): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...partial,
    sectionVisibility: {
      ...DEFAULT_APP_SETTINGS.sectionVisibility,
      ...(partial.sectionVisibility ?? {}),
    },
    pipelineWipLimits: normalizePipelineWipLimits(
      partial.pipelineWipLimits
    ),
    invoiceProfile: partial.invoiceProfile ?? DEFAULT_APP_SETTINGS.invoiceProfile,
  };
}

export function loadSettingsByTenant(): Record<string, AppSettings> {
  const loaded = loadJson<Record<string, AppSettings> | AppSettings>(
    "lt_settings",
    { [DEFAULT_TENANT_ID]: DEFAULT_APP_SETTINGS }
  );
  if (
    typeof loaded === "object" &&
    loaded !== null &&
    "autoMoveNewToContacted" in loaded
  ) {
    const legacySettings = loaded as Partial<AppSettings>;
    return {
      [DEFAULT_TENANT_ID]: normalizeAppSettings(legacySettings),
    };
  }
  const scoped = loaded as Record<string, AppSettings>;
  return {
    ...Object.fromEntries(
      Object.entries(scoped).map(([tenantId, settings]) => [
        tenantId,
        normalizeAppSettings(settings),
      ])
    ),
    [DEFAULT_TENANT_ID]: normalizeAppSettings(
      scoped[DEFAULT_TENANT_ID] ?? DEFAULT_APP_SETTINGS
    ),
  };
}

export function loadServicesByTenant(): Record<string, ServiceType[]> {
  const loaded = loadJson<ServiceType[] | Record<string, ServiceType[]>>(
    "lt_services",
    { [DEFAULT_TENANT_ID]: DEFAULT_SERVICES }
  );
  if (Array.isArray(loaded)) {
    return {
      [DEFAULT_TENANT_ID]: loaded.length > 0 ? loaded : DEFAULT_SERVICES,
    };
  }
  return {
    ...(loaded as Record<string, ServiceType[]>),
    [DEFAULT_TENANT_ID]:
      (loaded as Record<string, ServiceType[]>)[DEFAULT_TENANT_ID] ??
      DEFAULT_SERVICES,
  };
}

// =====================================================================
// Smart Capture — Text extraction for lead intake
// =====================================================================

export interface CaptureResult {
  phoneNumbers: string[];
  emails: string[];
  names: string[];
  companies: string[];
  websites: string[];
  addresses: string[];
  rawText: string;
}

export function extractContactFromText(text: string): CaptureResult {
  const rawText = text.trim();
  const phoneNumbers: string[] = [];
  const emails: string[] = [];
  const names: string[] = [];
  const companies: string[] = [];
  const websites: string[] = [];
  const addresses: string[] = [];

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let match;
  while ((match = emailRegex.exec(rawText)) !== null) {
    emails.push(match[0].toLowerCase());
  }

  // Extract Indian phone numbers
  const phonePatterns = [
    /(?:\+91[-.\s]?)?([6-9]\d{9})\b/g,
    /(?:\+91[-.\s]?)?([6-9]\d{4}[-.\s]?\d{5})\b/g,
    /(?:\+91[-.\s]?)?(\d{5}[-.\s]\d{5})\b/g,
  ];
  for (const pattern of phonePatterns) {
    while ((match = pattern.exec(rawText)) !== null) {
      const digits = match[1].replace(/[-.\s]/g, "");
      if (digits.length === 10 && !phoneNumbers.includes(digits)) {
        phoneNumbers.push(digits);
      }
    }
  }

  // Extract websites/URLs
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  while ((match = urlRegex.exec(rawText)) !== null) {
    const url = match[0].replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!emails.some((e) => e.includes(url.split("/")[0]))) {
      websites.push(url);
    }
  }

  // Extract lines and try to classify
  const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip if it's a phone, email, or URL line
    if (phonePatterns.some((p) => p.test(line)) || emailRegex.test(line) || urlRegex.test(line)) continue;
    // Skip very short lines
    if (line.length < 2) continue;

    // Company indicators
    if (/\b(inc|llc|ltd|pvt|private|limited|corp|corporation|solutions|technologies|services|consulting|group|industries|systems|tech|software|digital|media|ventures)\b/i.test(line)) {
      companies.push(line.replace(/[,;]+$/, "").trim());
      continue;
    }

    // Address indicators
    if (/\b(street|road|avenue|nagar|colony|sector|phase|area|city|pin|pincode|india|mumbai|delhi|bangalore|chennai|hyderabad|pune|kolkata|ahmedabad)\b/i.test(line)) {
      addresses.push(line.replace(/[,;]+$/, "").trim());
      continue;
    }

    // Person name pattern: 2-4 words, starts with capital, no special chars
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(line) && line.length < 60) {
      names.push(line);
      continue;
    }
  }

  // If no names found, try "Name: Value" patterns
  if (names.length === 0) {
    const nameKV = /(?:name|contact|person|called|caller)\s*[:\-–]\s*(.+)/i;
    const nameMatch = rawText.match(nameKV);
    if (nameMatch) names.push(nameMatch[1].trim().replace(/[,;]+$/, ""));
  }
  if (companies.length === 0) {
    const compKV = /(?:company|org|organization|firm|business|from)\s*[:\-–]\s*(.+)/i;
    const compMatch = rawText.match(compKV);
    if (compMatch) companies.push(compMatch[1].trim().replace(/[,;]+$/, ""));
  }
  if (addresses.length === 0) {
    const addrKV = /(?:address|location|city|based)\s*[:\-–]\s*(.+)/i;
    const addrMatch = rawText.match(addrKV);
    if (addrMatch) addresses.push(addrMatch[1].trim().replace(/[,;]+$/, ""));
  }

  return { phoneNumbers, emails, names, companies, websites, addresses, rawText };
}

// =====================================================================
// Duplicate Detection — Check leads against existing database
// =====================================================================

export interface DuplicateMatch {
  leadId: string;
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  leadStatus: string;
  matchType: "phone" | "email" | "name_company" | "name_fuzzy";
  confidence: "High" | "Medium" | "Low";
  score: number;
}

export function findDuplicateLeads(
  newLead: { phoneNumber: string; emailId: string; leadName: string; companyName: string },
  existingLeads: Lead[],
  currentLeadId?: string
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  for (const lead of existingLeads) {
    if (lead.isDeleted) continue;
    if (currentLeadId && lead.id === currentLeadId) continue;

    let score = 0;
    let matchType: DuplicateMatch["matchType"] = "name_fuzzy";
    let confidence: DuplicateMatch["confidence"] = "Low";

    // Phone exact match (highest priority)
    const newPhone = newLead.phoneNumber.replace(/\D/g, "");
    const existPhone = lead.phoneNumber.replace(/\D/g, "");
    if (newPhone.length >= 10 && existPhone.length >= 10 && newPhone === existPhone) {
      score += 80;
      matchType = "phone";
      confidence = "High";
    }

    // Email exact match
    if (newLead.emailId && lead.emailId && newLead.emailId.toLowerCase() === lead.emailId.toLowerCase()) {
      score += 80;
      if (matchType !== "phone") { matchType = "email"; confidence = "High"; }
      else { score += 10; }
    }

    // Name + Company match
    if (newLead.leadName && lead.leadName) {
      const nameSim = stringSimilarity(newLead.leadName.toLowerCase(), lead.leadName.toLowerCase());
      if (nameSim > 0.8) {
        score += 40;
        if (matchType === "name_fuzzy") { matchType = "name_company"; confidence = "Medium"; }
      } else if (nameSim > 0.5) {
        score += 20;
        if (matchType === "name_fuzzy") { matchType = "name_fuzzy"; confidence = "Low"; }
      }
    }

    // Company match
    if (newLead.companyName && lead.companyName) {
      const compSim = stringSimilarity(newLead.companyName.toLowerCase(), lead.companyName.toLowerCase());
      if (compSim > 0.8) {
        score += 30;
        if (matchType === "name_fuzzy" && confidence === "Low") confidence = "Medium";
      }
    }

    if (score >= 20 && !seen.has(lead.id)) {
      seen.add(lead.id);
      matches.push({
        leadId: lead.id,
        leadName: lead.leadName,
        companyName: lead.companyName,
        phoneNumber: lead.phoneNumber,
        emailId: lead.emailId,
        leadStatus: lead.leadStatus,
        matchType,
        confidence,
        score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Jaro-Winkler-like similarity
  const maxLen = Math.max(a.length, b.length);
  const matchDistance = Math.floor(maxLen / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matchingChars = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matchingChars++;
      break;
    }
  }

  if (matchingChars === 0) return 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (matchingChars / a.length + matchingChars / b.length + (matchingChars - transpositions / 2) / matchingChars) / 3;

  // Winkler boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return Math.min(1, jaro + prefix * 0.1);
}

// =====================================================================
// SLA Display Helpers
// =====================================================================

export function slaTierLabel(tier: LeadSlaTier): {
  label: string;
  className: string;
  managerCue: string;
} {
  switch (tier) {
    case "critical":
      return {
        label: "Critical SLA",
        className: "bg-rose-100 text-rose-700",
        managerCue: "Immediate attention needed",
      };
    case "escalate":
      return {
        label: "Escalate",
        className: "bg-amber-100 text-amber-700",
        managerCue: "Manager review required",
      };
    case "watch":
      return {
        label: "Watch",
        className: "bg-yellow-100 text-yellow-700",
        managerCue: "",
      };
    default:
      return {
        label: "On Track",
        className: "bg-emerald-100 text-emerald-700",
        managerCue: "",
      };
  }
}

// ---------- Number Formatting ----------

export function formatCompactNumber(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ---------- Lead Scoring Weights ----------

export const SCORING_WEIGHTS = {
  temperature: { Hot: 30, Warm: 15, Cold: 5 },
  engagement: { High: 25, Medium: 15, Low: 5 },
  dealSize: { Large: 20, Medium: 10, Small: 5 },
  recency: { "0-3days": 20, "4-7days": 15, "8-14days": 10, "15+days": 5 },
  source: { Referral: 15, "Inbound Query": 12, LinkedIn: 10, "Cold Call": 5, "Trade Show": 8, Website: 10, Other: 3 },
} as const;

export function calculateLeadScore(lead: Lead): number {
  let score = 0;
  const tempScore = SCORING_WEIGHTS.temperature[lead.leadTemperature] ?? 10;
  score += tempScore;
  const daysSinceContact = lead.lastContactedDate
    ? Math.floor((Date.now() - new Date(lead.lastContactedDate).getTime()) / 86400000)
    : 999;
  if (daysSinceContact <= 3) score += 20;
  else if (daysSinceContact <= 7) score += 15;
  else if (daysSinceContact <= 14) score += 10;
  else score += 5;
  const srcScore = SCORING_WEIGHTS.source[lead.leadSource as keyof typeof SCORING_WEIGHTS.source] ?? 5;
  score += srcScore;
  if (lead.dealValue) {
    if (lead.dealValue >= 500000) score += 20;
    else if (lead.dealValue >= 100000) score += 10;
    else score += 5;
  }
  return Math.min(100, score);
}

// ---------- Pipeline Velocity ----------

export function calculatePipelineVelocity(leads: Lead[]): {
  avgDaysInStage: Record<string, number>;
  stageConversionRate: Record<string, number>;
  overallVelocity: number;
} {
  const stages = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Confirmation", "Invoice Sent"];
  const avgDaysInStage: Record<string, number> = {};
  const stageConversionRate: Record<string, number> = {};

  for (const stage of stages) {
    const stageLeads = leads.filter((l) => !l.isDeleted);
    const inStage = stageLeads.filter((l) => l.leadStatus === stage);
    const avgDays = inStage.length > 0
      ? inStage.reduce((sum, l) => {
          const created = new Date(l.createdAt).getTime();
          const updated = new Date(l.updatedAt || l.createdAt).getTime();
          return sum + Math.max(1, Math.floor((updated - created) / 86400000));
        }, 0) / inStage.length
      : 0;
    avgDaysInStage[stage] = Math.round(avgDays);
  }

  const totalActiveLeads = leads.filter((l) => !l.isDeleted && !["Won", "Lost"].includes(l.leadStatus));
  const overallVelocity = totalActiveLeads.length > 0
    ? totalActiveLeads.reduce((sum, l) => {
        const created = new Date(l.createdAt).getTime();
        const days = Math.floor((Date.now() - created) / 86400000);
        return sum + days;
      }, 0) / totalActiveLeads.length
    : 0;

  return { avgDaysInStage, stageConversionRate, overallVelocity: Math.round(overallVelocity) };
}
