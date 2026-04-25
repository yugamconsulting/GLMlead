// =====================================================================
// TYPES & INTERFACES — Extracted from App.tsx (18,000+ line monolith)
// Yugam Consulting Lead Tracker CRM
// =====================================================================

// ---------- Enum-like union types ----------

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Proposal Sent"
  | "Negotiation"
  | "Confirmation"
  | "Invoice Sent"
  | "Won"
  | "Lost";

export type LeadSource =
  | "Referral"
  | "LinkedIn"
  | "Website"
  | "Meta Ads"
  | "WhatsApp"
  | "Cold Outreach"
  | "Others";

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export type FollowupStatus = "Pending" | "Done";

export type FollowupQueue = "overdue" | "today" | "upcoming" | "no-date";

export type GstMode = "Intra" | "Inter" | "None";

export type InvoiceStatus =
  | "Draft"
  | "Issued"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export type InvoiceRecurrence = "monthly" | "quarterly" | "annually" | "one-time";

export type BillingCycle = "monthly" | "quarterly" | "annually";

export type PlanPresetKey = "starter" | "growth" | "scale" | "enterprise";

export type PaymentStatus =
  | "Not Invoiced"
  | "Partially Collected"
  | "Fully Collected";

export type DashboardDateScope =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "mtd"
  | "qtd"
  | "lastMonth"
  | "custom";

export type MonthRangePreset = string; // "3" | "6" | "12" | "custom"

export type LeadOptionalColumn =
  | "source"
  | "service"
  | "temperature"
  | "deal"
  | "expected"
  | "invoice"
  | "tag";

export type LeadSlaTier = "ok" | "watch" | "escalate" | "critical";

export type NeglectRisk = "Low" | "Medium" | "High";

export type DunningStage =
  | "On Track"
  | "D1-D3"
  | "D4-D7"
  | "D8-D15"
  | "D15+";

export type ProductMode = "crm" | "field" | "agency";

export type UserRole = "owner" | "admin" | "manager" | "user";

// ---------- Core data interfaces ----------

export interface Lead {
  id: string;
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  website: string;
  address: string;
  assignedTo: string;
  leadSource: LeadSource;
  serviceInterested: string;
  leadStatus: LeadStatus;
  leadTemperature: LeadTemperature;
  dealValue: number;
  wonDealValue: number | null;
  collectedAmount: number | null;
  dateAdded: string;
  nextFollowupDate: string;
  lastContactedDate: string;
  followupStatus: FollowupStatus;
  expectedClosingDate: string;
  notes: string;
  invoiceFlowStatus: string;
  invoiceSentDate: string;
  isDeleted: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  duplicateOf: string | null;
  tags: string[];
  customFields: Record<string, string>;
}

export interface LeadChangeLog {
  id: string;
  leadId: string;
  changedBy: string;
  changeType: string;
  change: string;
  createdAt: string;
  tenantId: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  performedBy: string;
  createdAt: string;
  tenantId: string;
}

// ---------- Invoice types ----------

export interface InvoiceLineItem {
  id: string;
  serviceName: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface InvoiceAdjustment {
  id: string;
  invoiceId: string;
  kind: "Credit" | "Debit";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  leadId: string;
  leadName: string;
  tenantId: string;
  status: InvoiceStatus;
  recurrence: InvoiceRecurrence;
  lineItems: InvoiceLineItem[];
  serviceName: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstMode: GstMode;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  amountPaid: number;
  dueDate: string;
  issueDate: string;
  supplierGstin: string;
  supplierLegalName: string;
  supplierAddress: string;
  supplierState: string;
  customerGstin: string;
  customerLegalName: string;
  customerAddress: string;
  customerState: string;
  notes: string;
  adjustments: InvoiceAdjustment[];
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
}

export interface InvoiceDraft {
  leadId: string;
  serviceName: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  gstMode: GstMode;
  dueDate: string;
  issueDate: string;
  supplierGstin: string;
  supplierLegalName: string;
  supplierAddress: string;
  supplierState: string;
  customerGstin: string;
  customerLegalName: string;
  customerAddress: string;
  customerState: string;
  notes: string;
  lineItems: InvoiceLineItem[];
  recurrence: InvoiceRecurrence;
}

// ---------- Tenant / Plan / Subscription ----------

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  productMode: ProductMode;
  planName: string;
  planTemplateId: string | null;
  maxUsers: number;
  maxLeadsPerMonth: number;
  graceDays: number;
  isActive: boolean;
  autoRenew: boolean;
  licenseStartDate: string;
  licenseEndDate: string;
  createdAt: string;
  updatedAt: string;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  invoiceProfile: InvoiceProfile | null;
  auditRetentionDays: number;
  recoveryPassword: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
}

export interface InvoiceProfile {
  legalName: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  stateCode: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  logoUrl: string;
  signatureUrl: string;
  templateType: string;
}

export interface TenantEntitlementDraft {
  name: string;
  slug: string;
  productMode: ProductMode;
  planName: string;
  maxUsers: number;
  maxLeadsPerMonth: number;
  graceDays: number;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  invoiceProfile: InvoiceProfile | null;
  auditRetentionDays: number;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  productMode: ProductMode;
  planName: string;
  planTemplateId: string | null;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  renewalDate: string;
  graceEndsAt: string;
  status: "active" | "suspended";
  retryCount: number;
  nextRetryAt: string;
  scheduledDowngradePlanTemplateId: string | null;
  scheduledDowngradeAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  monthlyPriceInr: number;
  offerLabel: string;
  maxUsers: number;
  maxLeadsPerMonth: number;
  graceDays: number;
  featureExports: boolean;
  featureAdvancedForecast: boolean;
  featureInvoicing: boolean;
  requireGstCompliance: boolean;
  auditRetentionDays: number;
  isSystemPreset: boolean;
  isActive: boolean;
  updatedAt: string;
}

// ---------- User ----------

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  passwordHash: string;
  profilePicture: string;
  lastLoginAt: string;
}

// ---------- Settings ----------

export type VisibilityLevel = "basic" | "advanced" | "hidden";

export interface SectionVisibility {
  mywork: VisibilityLevel;
  dashboard: VisibilityLevel;
  leads: VisibilityLevel;
  pipeline: VisibilityLevel;
  followups: VisibilityLevel;
  revenue: VisibilityLevel;
  invoices: VisibilityLevel;
  sources: VisibilityLevel;
  users: VisibilityLevel;
}

export interface PipelineWipLimitMap {
  [status: string]: number;
}

export interface AppSettings {
  autoMoveNewToContacted: boolean;
  defaultLeadSource: LeadSource;
  defaultService: string;
  defaultTemperature: LeadTemperature;
  currency: string;
  dateFormat: string;
  sectionVisibility: SectionVisibility;
  leadOptionalColumns: LeadOptionalColumn[];
  pipelineWipLimits: PipelineWipLimitMap;
  enableSlaAlerts: boolean;
  enableDuplicateDetection: boolean;
  enableNeglectAlerts: boolean;
  companyLogoUrl: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  companyGstin: string;
  companyPan: string;
  whatsappTemplate: string;
  emailTemplate: string;
  invoicePrefix: string;
  invoiceProfile: InvoiceProfile | null;
  defaultView: string;
  leadPageSize: number;
  slaThresholds: Record<string, number>;
  companyWebsite: string;
  companyIndustry: string;
  paymentTerms: string;
  invoiceNotes: string;
}

// ---------- Service ----------

export interface ServiceType {
  id: string;
  name: string;
  isActive: boolean;
  tenantId: string;
}

// ---------- Dashboard / Analytics ----------

export interface DashboardKpi {
  label: string;
  value: number;
  formatted: string;
  trend: {
    arrow: string;
    value: string;
    className: string;
  } | null;
  icon: string;
  color: string;
}

export interface RevenueRow {
  monthKey: string;
  monthLabel: string;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
  pipelineValue: number;
  wonValue: number;
  lostValue: number;
  collected: number;
  outstanding: number;
  conversionRate: number;
  avgDealSize: number;
  avgCloseDays: number;
}

export interface SourceRow {
  source: LeadSource;
  count: number;
  wonCount: number;
  wonValue: number;
  conversionRate: number;
}

export interface PipelineColumn {
  status: LeadStatus;
  leads: Lead[];
  count: number;
  totalValue: number;
  overdue: number;
  avgAgeDays: number;
  wipLimit: number | null;
  dailyCount: number;
  overLimit: boolean;
}

// ---------- Auth ----------

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  currentTenant: Tenant | null;
  loginEmail: string;
}

export interface GoogleJwtPayload {
  email?: string;
  name?: string;
  sub?: string;
  picture?: string;
}

// ---------- View / Navigation ----------

export type ViewKey =
  | "dashboard"
  | "leads"
  | "pipeline"
  | "followups"
  | "revenue"
  | "invoices"
  | "users"
  | "settings"
  | "mywork"
  | "sources"
  | "superadmin"
  | "tenant-detail"
  | "plan-templates"
  | "billing"
  | "reports"
  | "analytics"
  | "notifications"
  | "help"
  | "data-export";

export type MobileTabKey = "today" | "leads" | "pipeline" | "followups" | "more";

export interface ViewState {
  currentView: ViewKey;
  selectedLeadId: string | null;
  selectedInvoiceId: string | null;
  selectedTenantId: string | null;
}

// ---------- Lead Intake ----------

export interface LeadIntakeForm {
  leadName: string;
  companyName: string;
  phoneNumber: string;
  emailId: string;
  website: string;
  address: string;
  assignedTo: string;
  leadSource: LeadSource;
  serviceInterested: string;
  leadTemperature: LeadTemperature;
  dealValue: number;
  dateAdded: string;
  nextFollowupDate: string;
  lastContactedDate: string;
  notes: string;
}

export interface CaptureSummaryItem {
  field: string;
  value: string;
  confidence: "High" | "Review";
}

// ---------- Misc ----------

export interface ModalState {
  showLeadIntake: boolean;
  showLeadImport: boolean;
  showInvoiceCreate: boolean;
  showInvoiceDetail: boolean;
  showLeadDetail: boolean;
  showTenantEditor: boolean;
  showPlanEditor: boolean;
}

export interface TenantLifecycleResult {
  status: "Active" | "Grace" | "Expired" | "Suspended";
  daysToExpiry: number;
  daysPastDue: number;
  inGrace: boolean;
  isBlocked: boolean;
}

export interface TrendResult {
  arrow: string;
  className: string;
  value: string;
}

export interface DateRange {
  start: string | null;
  end: string | null;
  label: string;
}

export interface RangeBounds {
  start: string;
  end: string;
}
