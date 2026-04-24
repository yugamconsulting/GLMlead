// =====================================================================
// CONSTANTS & DEFAULTS — Extracted from App.tsx
// =====================================================================

import type {
  AppSettings,
  BillingCycle,
  LeadOptionalColumn,
  LeadSource,
  LeadStatus,
  PlanPresetKey,
  PlanTemplate,
  SectionVisibility,
  ServiceType,
} from "../types/index";

// ---------- Storage Keys ----------

export const STORAGE_LEADS = "lt_leads";
export const STORAGE_INVOICES = "lt_invoices";
export const STORAGE_USERS = "lt_users";
export const STORAGE_TENANT = "lt_tenant";
export const STORAGE_SETTINGS = "lt_settings";
export const STORAGE_SERVICES = "lt_services";
export const STORAGE_CHANGELOG = "lt_changelog";
export const STORAGE_ACTIVITIES = "lt_activities";
export const STORAGE_PLAN_TEMPLATES = "lt_plan_templates";
export const STORAGE_PIPELINE_WIP_LIMITS = "lt_pipeline_wip_limits";
export const STORAGE_ADJUSTMENTS = "lt_invoice_adjustments";
export const STORAGE_AUTH = "lt_auth";
export const STORAGE_SESSION = "lt_session";

// ---------- Default Tenant ----------

export const DEFAULT_TENANT_ID = "tenant-default";
export const DEFAULT_GRACE_DAYS = 7;
export const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";

// ---------- Lead Statuses & Sources ----------

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Confirmation",
  "Invoice Sent",
  "Won",
  "Lost",
];

export const PIPELINE_STATUSES: LeadStatus[] = LEAD_STATUSES.filter(
  (s) => s !== "Won" && s !== "Lost"
);

export const OPEN_LEAD_STATUSES: LeadStatus[] = LEAD_STATUSES.filter(
  (s) => s !== "Won" && s !== "Lost"
);

export const CLOSED_WON: LeadStatus = "Won";
export const CLOSED_LOST: LeadStatus = "Lost";

export const LEAD_SOURCES: LeadSource[] = [
  "Referral",
  "LinkedIn",
  "Website",
  "Meta Ads",
  "WhatsApp",
  "Cold Outreach",
  "Others",
];

export const LEAD_TEMPERATURES = ["Hot", "Warm", "Cold"] as const;

export const INVOICE_ELIGIBLE_STATUSES: LeadStatus[] = [
  "Proposal Sent",
  "Negotiation",
  "Confirmation",
  "Invoice Sent",
  "Won",
];

// ---------- Optional Columns ----------

export const LEAD_OPTIONAL_COLUMNS: Array<{
  key: LeadOptionalColumn;
  label: string;
}> = [
  { key: "source", label: "Source" },
  { key: "service", label: "Service" },
  { key: "temperature", label: "Temperature" },
  { key: "deal", label: "Deal Value" },
  { key: "expected", label: "Expected Close" },
  { key: "invoice", label: "Invoice Flow" },
  { key: "tag", label: "Follow-up Tag" },
];

// ---------- Section Visibility ----------

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  mywork: "basic",
  dashboard: "basic",
  leads: "basic",
  pipeline: "basic",
  followups: "basic",
  revenue: "basic",
  invoices: "basic",
  sources: "basic",
  users: "basic",
};

// ---------- App Settings ----------

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoMoveNewToContacted: false,
  defaultLeadSource: "Others",
  defaultService: "",
  defaultTemperature: "Warm",
  currency: "INR",
  dateFormat: "dd-MM-yyyy",
  sectionVisibility: DEFAULT_SECTION_VISIBILITY,
  leadOptionalColumns: ["source", "deal", "tag"],
  pipelineWipLimits: {},
  enableSlaAlerts: true,
  enableDuplicateDetection: true,
  enableNeglectAlerts: true,
  companyLogoUrl: "",
  companyName: "Yugam Consulting",
  companyPhone: "",
  companyEmail: "",
  companyAddress: "",
  companyGstin: "",
  companyPan: "",
  whatsappTemplate: "",
  emailTemplate: "",
  invoicePrefix: "",
  invoiceProfile: null,
  defaultView: "dashboard",
  leadPageSize: 25,
  slaThresholds: {},
  companyWebsite: "",
  companyIndustry: "",
  paymentTerms: "Net 30",
  invoiceNotes: "",
};

// ---------- Default Services ----------

export const DEFAULT_SERVICES: ServiceType[] = [
  { id: "svc-1", name: "Digital Marketing", isActive: true, tenantId: DEFAULT_TENANT_ID },
  { id: "svc-2", name: "SEO", isActive: true, tenantId: DEFAULT_TENANT_ID },
  { id: "svc-3", name: "Social Media Management", isActive: true, tenantId: DEFAULT_TENANT_ID },
  { id: "svc-4", name: "Web Development", isActive: true, tenantId: DEFAULT_TENANT_ID },
  { id: "svc-5", name: "Branding", isActive: true, tenantId: DEFAULT_TENANT_ID },
  { id: "svc-6", name: "Consulting", isActive: true, tenantId: DEFAULT_TENANT_ID },
];

// ---------- Pipeline WIP Limits ----------

export const PIPELINE_WIP_LIMITS: Record<string, number> = {
  New: 0,
  Contacted: 0,
  Qualified: 0,
  "Proposal Sent": 0,
  Negotiation: 0,
  Confirmation: 0,
  "Invoice Sent": 0,
};

export const PIPELINE_WIP_CONFIGURABLE_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Confirmation",
  "Invoice Sent",
];

// ---------- Plan Pricing ----------

export const PLAN_PRICING_MONTHLY_INR: Record<PlanPresetKey, number> = {
  starter: 499,
  growth: 1499,
  scale: 3999,
  enterprise: 9999,
};

// ---------- Plan Presets ----------

export const PLAN_PRESETS: Record<
  PlanPresetKey,
  Omit<
    PlanTemplate,
    | "id"
    | "name"
    | "description"
    | "monthlyPriceInr"
    | "offerLabel"
    | "isSystemPreset"
    | "isActive"
    | "updatedAt"
  >
> = {
  starter: {
    maxUsers: 1,
    maxLeadsPerMonth: 100,
    graceDays: 3,
    featureExports: false,
    featureAdvancedForecast: false,
    featureInvoicing: false,
    requireGstCompliance: false,
    auditRetentionDays: 90,
  },
  growth: {
    maxUsers: 5,
    maxLeadsPerMonth: 500,
    graceDays: 7,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    auditRetentionDays: 365,
  },
  scale: {
    maxUsers: 20,
    maxLeadsPerMonth: 2000,
    graceDays: 7,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    auditRetentionDays: 730,
  },
  enterprise: {
    maxUsers: 100,
    maxLeadsPerMonth: 10000,
    graceDays: 14,
    featureExports: true,
    featureAdvancedForecast: true,
    featureInvoicing: true,
    requireGstCompliance: true,
    auditRetentionDays: 1825,
  },
};

// ---------- System Plan Templates ----------

export const SYSTEM_PLAN_TEMPLATE_PREFIX = "sys-plan-";

export const SYSTEM_PLAN_TEMPLATE_IDS: Record<PlanPresetKey, string> = {
  starter: `${SYSTEM_PLAN_TEMPLATE_PREFIX}starter`,
  growth: `${SYSTEM_PLAN_TEMPLATE_PREFIX}growth`,
  scale: `${SYSTEM_PLAN_TEMPLATE_PREFIX}scale`,
  enterprise: `${SYSTEM_PLAN_TEMPLATE_PREFIX}enterprise`,
};

export const DEFAULT_PLAN_TEMPLATE_ID = SYSTEM_PLAN_TEMPLATE_IDS.growth;

export const SYSTEM_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.starter,
    name: "Starter",
    description: "Small teams getting started with lead management.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.starter,
    offerLabel: "Best for solo founders",
    ...PLAN_PRESETS.starter,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.growth,
    name: "Growth",
    description: "Balanced package for growing sales teams.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.growth,
    offerLabel: "Most popular for agencies",
    ...PLAN_PRESETS.growth,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.scale,
    name: "Scale",
    description: "High throughput plan for larger teams.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.scale,
    offerLabel: "Built for multi-team ops",
    ...PLAN_PRESETS.scale,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: SYSTEM_PLAN_TEMPLATE_IDS.enterprise,
    name: "Enterprise",
    description: "Custom-grade limits with long retention windows.",
    monthlyPriceInr: PLAN_PRICING_MONTHLY_INR.enterprise,
    offerLabel: "Custom onboarding and governance",
    ...PLAN_PRESETS.enterprise,
    isSystemPreset: true,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
];

// ---------- Invoice Status Colors ----------

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Issued: "bg-blue-100 text-blue-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Overdue: "bg-rose-100 text-rose-700",
  Cancelled: "bg-slate-100 text-slate-500 line-through",
};

// ---------- Lead Status Colors ----------

export const LEAD_STATUS_COLORS: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  Contacted: "bg-blue-100 text-blue-700",
  Qualified: "bg-indigo-100 text-indigo-700",
  "Proposal Sent": "bg-violet-100 text-violet-700",
  Negotiation: "bg-amber-100 text-amber-700",
  Confirmation: "bg-teal-100 text-teal-700",
  "Invoice Sent": "bg-purple-100 text-purple-700",
  Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-rose-100 text-rose-700",
};

// ---------- Default Admin Credentials ----------

export const DEFAULT_ADMIN_EMAIL = "admin@oruyugam.com";
export const DEFAULT_ADMIN_PASSWORD = "Admin@123";
export const DEFAULT_ADMIN_NAME = "Admin";

// ---------- Brand Colors ----------

export const BRAND_PRIMARY = "#788023";
export const BRAND_PRIMARY_DARK = "#646b1d";
export const BRAND_PRIMARY_LIGHT = "#78802340";

// ---------- Follow-up Templates ----------

export interface FollowupTemplate {
  id: string;
  name: string;
  description: string;
  daysOffset: number;
  channel: "call" | "email" | "whatsapp" | "meeting";
  noteTemplate: string;
  category: "initial" | "proposal" | "negotiation" | "checkin" | "reengagement";
}

export const FOLLOWUP_TEMPLATES: FollowupTemplate[] = [
  {
    id: "tpl-initial-call",
    name: "Initial Contact Call",
    description: "First phone call to introduce services and qualify the lead",
    daysOffset: 0,
    channel: "call",
    noteTemplate: "Called {company} regarding {service}. Spoke with {leadName}. Discussed initial requirements and interest level. Next step: Send proposal.",
    category: "initial",
  },
  {
    id: "tpl-post-proposal",
    name: "Post-Proposal Follow-up",
    description: "Follow up after sending a proposal to address questions",
    daysOffset: 3,
    channel: "email",
    noteTemplate: "Sent follow-up email to {leadName} at {company} regarding the proposal shared on {date}. Waiting for feedback on pricing and scope.",
    category: "proposal",
  },
  {
    id: "tpl-negotiation-nudge",
    name: "Negotiation Nudge",
    description: "Gentle push during negotiation phase",
    daysOffset: 2,
    channel: "whatsapp",
    noteTemplate: "Hi {leadName}, just checking in on the negotiation points we discussed. Happy to address any remaining concerns. Let me know a good time to connect.",
    category: "negotiation",
  },
  {
    id: "tpl-weekly-checkin",
    name: "Weekly Check-in",
    description: "Regular weekly touchpoint with warm leads",
    daysOffset: 7,
    channel: "call",
    noteTemplate: "Weekly check-in with {leadName} at {company}. Discussed progress on their decision timeline. No blockers identified.",
    category: "checkin",
  },
  {
    id: "tpl-reengagement",
    name: "Re-engagement Attempt",
    description: "Try to reconnect with cold/quiet leads",
    daysOffset: 14,
    channel: "email",
    noteTemplate: "Hi {leadName}, it's been a while since we connected. I wanted to share an update on {service} that might be relevant to {company}. Would love to reconnect.",
    category: "reengagement",
  },
  {
    id: "tpl-meeting-followup",
    name: "Post-Meeting Summary",
    description: "Send a summary email after a meeting",
    daysOffset: 1,
    channel: "email",
    noteTemplate: "Thank you for the meeting, {leadName}. Summary of discussion: [topics]. Action items: [items]. Next meeting scheduled for [date].",
    category: "proposal",
  },
  {
    id: "tpl-invoice-reminder",
    name: "Invoice Payment Reminder",
    description: "Friendly reminder for pending invoice payments",
    daysOffset: 3,
    channel: "whatsapp",
    noteTemplate: "Hi {leadName}, this is a friendly reminder that invoice #{invoiceNumber} for ₹{amount} is due on {dueDate}. Please let us know if you have any questions.",
    category: "checkin",
  },
  {
    id: "tpl-milestone-check",
    name: "Project Milestone Check",
    description: "Check in on project milestones for active clients",
    daysOffset: 7,
    channel: "call",
    noteTemplate: "Milestone check with {company}. Reviewed progress on {service}. Client satisfaction: [rating]. Upcoming deliverables: [items].",
    category: "checkin",
  },
];

// ---------- Email Templates (see new EMAIL_TEMPLATES below) ----------

// ---------- WhatsApp Templates ----------

export interface WhatsAppTemplate {
  id: string;
  name: string;
  message: string;
  category: "intro" | "followup" | "reminder" | "thankyou";
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "wa-intro",
    name: "Quick Introduction",
    message: "Hi {leadName}! 👋 This is {senderName} from Yugam Consulting. We spoke about {service}. Would love to schedule a quick call to discuss further. What time works best for you?",
    category: "intro",
  },
  {
    id: "wa-followup",
    name: "Warm Follow-up",
    message: "Hi {leadName}! Just circling back on our conversation about {service} for {company}. Any updates on your end? Happy to jump on a call whenever convenient. 😊",
    category: "followup",
  },
  {
    id: "wa-reminder",
    name: "Payment Reminder",
    message: "Hi {leadName}, gentle reminder that invoice #{invoiceNumber} for ₹{amount} is due on {dueDate}. Let us know if you need anything! 🙏",
    category: "reminder",
  },
  {
    id: "wa-thankyou",
    name: "Thank You Message",
    message: "Thank you for choosing Yugam Consulting, {leadName}! 🎉 We're excited to work with {company}. Will share the next steps shortly.",
    category: "thankyou",
  },
];

// ---------- Pipeline Stage Config ----------

export const PIPELINE_STAGES = [
  { key: "New", label: "New", color: "bg-blue-500", probability: 5 },
  { key: "Contacted", label: "Contacted", color: "bg-cyan-500", probability: 15 },
  { key: "Qualified", label: "Qualified", color: "bg-yellow-500", probability: 30 },
  { key: "Proposal Sent", label: "Proposal Sent", color: "bg-violet-500", probability: 50 },
  { key: "Negotiation", label: "Negotiation", color: "bg-orange-500", probability: 70 },
  { key: "Confirmation", label: "Confirmation", color: "bg-teal-500", probability: 85 },
  { key: "Invoice Sent", label: "Invoice Sent", color: "bg-purple-500", probability: 95 },
] as const;

export const WON_STAGE = { key: "Won", label: "Won", color: "bg-emerald-500", probability: 100 } as const;
export const LOST_STAGE = { key: "Lost", label: "Lost", color: "bg-rose-500", probability: 0 } as const;

// ---------- Loss Reasons ----------

export const LOSS_REASONS = [
  "Budget constraints",
  "Chose competitor",
  "No response / Ghosted",
  "Not a good fit",
  "Project postponed",
  "Went with in-house solution",
  "Pricing too high",
  "Lost contact",
  "Changed requirements",
  "Other",
] as const;

// ---------- Win Reasons ----------

export const WIN_REASONS = [
  "Best proposal",
  "Competitive pricing",
  "Strong relationship",
  "Referral trust",
  "Superior service offering",
  "Quick turnaround",
  "Domain expertise",
  "Existing client",
  "Other",
] as const;

// ---------- Email Templates ----------

export const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Welcome to {{companyName}}!",
    body: "Dear {{leadName}},\n\nThank you for your interest in our services. We're excited to connect with you.\n\nOur team will be in touch shortly to understand your requirements better.\n\nBest regards,\n{{senderName}}\n{{companyName}}",
  },
  proposal: {
    subject: "Proposal from {{companyName}} — {{serviceName}}",
    body: "Dear {{leadName}},\n\nThank you for the opportunity. Please find our proposal attached for your review.\n\nWe believe our {{serviceName}} offering will add significant value to {{companyName}}.\n\nLooking forward to your feedback.\n\nBest regards,\n{{senderName}}",
  },
  followup: {
    subject: "Following up — {{companyName}}",
    body: "Hi {{leadName}},\n\nI wanted to follow up on our last conversation regarding {{serviceName}}.\n\nPlease let me know if you have any questions or if there's anything else I can help with.\n\nBest regards,\n{{senderName}}",
  },
  invoiceReminder: {
    subject: "Invoice #{{invoiceNumber}} — Payment Reminder",
    body: "Dear {{leadName}},\n\nThis is a friendly reminder that Invoice #{{invoiceNumber}} for ₹{{amount}} is due on {{dueDate}}.\n\nYou can make the payment via bank transfer or UPI. Please let us know once completed.\n\nThank you for your business!\n\nBest regards,\n{{senderName}}\n{{companyName}}",
  },
  thankYou: {
    subject: "Thank you for your business!",
    body: "Dear {{leadName}},\n\nThank you for choosing {{companyName}}. We truly appreciate your trust in our services.\n\nWe look forward to a long and successful partnership.\n\nWarm regards,\n{{senderName}}\n{{companyName}}",
  },
  overdue: {
    subject: "OVERDUE: Invoice #{{invoiceNumber}} — Immediate Attention Required",
    body: "Dear {{leadName}},\n\nWe noticed that Invoice #{{invoiceNumber}} for ₹{{amount}} was due on {{dueDate}} and is now overdue by {{overdueDays}} days.\n\nPlease arrange payment at your earliest convenience. If you have any questions, don't hesitate to reach out.\n\nBest regards,\n{{senderName}}\n{{companyName}}",
  },
} as const;

// ---------- Service Categories ----------

export const SERVICE_CATEGORIES = [
  { name: "Consulting", services: ["Business Strategy", "Process Optimization", "Digital Transformation", "Change Management"] },
  { name: "Technology", services: ["Web Development", "Mobile App Development", "Cloud Infrastructure", "API Integration", "DevOps"] },
  { name: "Design", services: ["UI/UX Design", "Brand Identity", "Graphic Design", "Product Design"] },
  { name: "Marketing", services: ["SEO", "Social Media Marketing", "Content Marketing", "Email Campaigns", "PPC Advertising"] },
  { name: "Analytics", services: ["Data Analytics", "Business Intelligence", "Reporting", "Dashboard Development"] },
  { name: "Training", services: ["Corporate Training", "Workshop Facilitation", "Online Course Development", "Coaching"] },
] as const;

// ---------- SLA Config ----------

export const SLA_THRESHOLDS = {
  new: { watch: 2, escalate: 5, critical: 10 },
  contacted: { watch: 3, escalate: 7, critical: 14 },
  qualified: { watch: 5, escalate: 10, critical: 21 },
  "proposal-sent": { watch: 7, escalate: 14, critical: 30 },
  negotiation: { watch: 10, escalate: 21, critical: 45 },
  confirmation: { watch: 3, escalate: 7, critical: 14 },
  "invoice-sent": { watch: 7, escalate: 14, critical: 30 },
} as const;

// ---------- Dunning Playbooks ----------

export const DUNNING_PLAYBOOKS = [
  { stage: "D1-D3", action: "Send friendly payment reminder via email", channel: "Email", tone: "Friendly" },
  { stage: "D1-D3", action: "WhatsApp message with payment link", channel: "WhatsApp", tone: "Friendly" },
  { stage: "D4-D7", action: "Follow-up call to check on payment status", channel: "Phone", tone: "Professional" },
  { stage: "D4-D7", action: "Send second reminder with late fee notice", channel: "Email", tone: "Professional" },
  { stage: "D8-D15", action: "Send formal overdue notice via registered post", channel: "Post", tone: "Firm" },
  { stage: "D8-D15", action: "Escalation call to senior contact", channel: "Phone", tone: "Firm" },
  { stage: "D15+", action: "Final demand letter with legal notice", channel: "Legal", tone: "Strict" },
  { stage: "D15+", action: "Engage collections agency", channel: "External", tone: "Strict" },
] as const;

// ---------- Invoice Payment Terms ----------

export const PAYMENT_TERMS = [
  { value: "immediate", label: "Due Immediately", days: 0 },
  { value: "net-15", label: "Net 15", days: 15 },
  { value: "net-30", label: "Net 30", days: 30 },
  { value: "net-45", label: "Net 45", days: 45 },
  { value: "net-60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom", days: 0 },
] as const;

// ---------- Industries ----------

export const INDUSTRIES = [
  "Technology", "Healthcare", "Education", "Finance", "Manufacturing",
  "Retail", "Real Estate", "Legal", "Marketing", "Consulting",
  "Hospitality", "Logistics", "Agriculture", "Government", "Non-Profit",
  "Media", "Telecommunications", "Energy", "Automotive", "Other",
] as const;

// SLA config integrated above

// ---------- GST Config ----------

export const GST_CONFIG = {
  gstRates: [5, 12, 18, 28],
  defaultRate: 18,
  intraSplit: { cgst: 9, sgst: 9 },
  interRate: 18,
  sacCodes: {
    "IT Consulting": "998314",
    "Software Development": "998315",
    "Digital Marketing": "998362",
    "Web Development": "998315",
    "Mobile App Development": "998315",
    "Cloud Services": "998315",
    "Data Analytics": "998314",
    "Cybersecurity": "998314",
    "UI/UX Design": "998314",
    "Project Management": "998314",
    "Training": "999293",
    "Support & Maintenance": "998315",
  },
} as const;
