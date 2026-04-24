// =====================================================================
// APP SHELL — Entry point with all views integrated
// Phase 7: Dashboard extracted, clean architecture
// =====================================================================

import { useState, useCallback, useMemo } from "react";
import type { Lead, Invoice, User, Tenant, ViewKey, AppSettings, PlanTemplate } from "./types/index";
import {
  DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_NAME,
  DEFAULT_TENANT_ID, DEFAULT_APP_SETTINGS, SYSTEM_PLAN_TEMPLATES,
} from "./constants/index";
import {
  loadJson, saveJson, makeId, sha256, todayISODate,
  normalizePlanTemplates,
} from "./lib/utils";

import { DashboardView } from "./components/views/DashboardView";
import { LeadsView } from "./components/views/LeadsView";
import { PipelineView } from "./components/views/PipelineView";
import { FollowupsView } from "./components/views/FollowupsView";
import { InvoicesView, RevenueView } from "./components/views/InvoicesRevenueView";
import { MyWorkView, SourcesView, UsersView, SettingsView } from "./components/views/UsersSettingsView";
import { SuperAdminView } from "./components/views/SuperAdminView";
import { ReportsView } from "./components/views/ReportsView";
import { AnalyticsView } from "./components/views/AnalyticsView";
import { NotificationsView } from "./components/views/NotificationsView";
import HelpSupportView from "./components/views/HelpSupportView";
import DataExportView from "./components/views/DataExportView";
import { ToastProvider, Spinner } from "./components/ui/SharedUI";
import LandingPage from "./components/views/LandingPage";

// =====================================================================
// Logo Component
// =====================================================================

function BrandLogo({ className = "h-11" }: { className?: string }) {
  const logoCandidates = [
    "/images/yugam-logo.png", "/yugam-logo.png",
    "/images/logo.png", "/logo.png",
  ];
  const [logoIndex, setLogoIndex] = useState(0);
  if (logoIndex >= logoCandidates.length) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white font-bold text-lg shadow-sm">Y</div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#788023] leading-tight">Yugam</span>
          <span className="text-[9px] font-medium text-slate-400 leading-tight tracking-wide uppercase">Consulting</span>
        </div>
      </div>
    );
  }
  return (
    <img src={logoCandidates[logoIndex]} alt="Yugam Consulting" className={className}
      onError={() => setLogoIndex((c) => c + 1)} />
  );
}

// =====================================================================
// Password Field Component
// =====================================================================

function PasswordField({ value, onChange, placeholder }: {
  value: string; onChange: (next: string) => void; placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-16 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-[#788023] hover:bg-[#788023]/10 transition-colors"
        onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button>
    </div>
  );
}

// =====================================================================
// Data Initialization
// =====================================================================

function initializeDefaultTenant(): Tenant {
  const existing = loadJson<Tenant | null>("lt_tenant", null);
  if (existing) return existing;
  const tenant: Tenant = {
    id: DEFAULT_TENANT_ID, name: "Yugam Consulting", slug: "yugam", productMode: "agency",
    planName: "Growth", planTemplateId: SYSTEM_PLAN_TEMPLATES[1]?.id ?? null,
    maxUsers: 5, maxLeadsPerMonth: 500, graceDays: 7, isActive: true, autoRenew: true,
    licenseStartDate: new Date().toISOString(),
    licenseEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    featureExports: true, featureAdvancedForecast: true, featureInvoicing: true,
    requireGstCompliance: true, invoiceProfile: null, auditRetentionDays: 365,
    recoveryPassword: "", ownerEmail: DEFAULT_ADMIN_EMAIL, ownerName: DEFAULT_ADMIN_NAME, ownerPhone: "",
  };
  saveJson("lt_tenant", tenant);
  return tenant;
}

function initializeDefaultAdmin(): User {
  const users = loadJson<User[]>("lt_users", []);
  const existing = users.find((u) => u.email === DEFAULT_ADMIN_EMAIL);
  if (existing) return existing;
  const admin: User = {
    id: "user-admin", name: DEFAULT_ADMIN_NAME, email: DEFAULT_ADMIN_EMAIL, phone: "",
    role: "owner", isActive: true, tenantId: DEFAULT_TENANT_ID,
    createdAt: new Date().toISOString(), passwordHash: "", profilePicture: "", lastLoginAt: "",
  };
  users.push(admin);
  saveJson("lt_users", users);
  return admin;
}

// =====================================================================
// Login Page — Enhanced with animated background
// =====================================================================

function LoginPage({ onLogin }: { onLogin: (user: User, tenant: Tenant) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Check default admin credentials FIRST (before localStorage lookup)
      if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        if (password === DEFAULT_ADMIN_PASSWORD) {
          const user = initializeDefaultAdmin();
          const tenant = initializeDefaultTenant();
          onLogin(user, tenant);
          return;
        }
        setError("Invalid password."); setLoading(false); return;
      }
      // Then check localStorage for other users
      const users = loadJson<User[]>("lt_users", []);
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) { setError("User not found. Check email or register first."); setLoading(false); return; }
      const hash = await sha256(password);
      if (user.passwordHash && user.passwordHash === hash) { const tenant = initializeDefaultTenant(); onLogin(user, tenant); }
      else { setError("Invalid credentials."); }
    } catch { setError("Login failed."); }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const googleEmail = email || "user@gmail.com";
      const users = loadJson<User[]>("lt_users", []);
      let user = users.find((u) => u.email.toLowerCase() === googleEmail.toLowerCase());
      if (!user) {
        user = {
          id: makeId(), name: googleEmail.split("@")[0], email: googleEmail, phone: "",
          role: "user", isActive: true, tenantId: DEFAULT_TENANT_ID,
          createdAt: new Date().toISOString(), passwordHash: "",
          profilePicture: "", lastLoginAt: new Date().toISOString(),
        };
        users.push(user);
        saveJson("lt_users", users);
      }
      const tenant = initializeDefaultTenant();
      onLogin(user, tenant);
    } catch {
      setError("Google sign-in failed. Please try again.");
    }
    setGoogleLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-[#788023]/5 px-4">
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#788023]/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-sky-100/50 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#edf0d2]/30 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="rounded-2xl bg-white/80 p-8 shadow-xl ring-1 ring-slate-200/80 backdrop-blur-sm">
          <div className="mb-6 flex flex-col items-center">
            <div className="animate-float mb-3">
              <BrandLogo className="h-14" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Lead Tracker</h1>
            <p className="text-sm text-slate-500">Yugam Consulting CRM</p>
          </div>

          {error && (
            <div className="mb-4 animate-slide-in-down rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <button onClick={handleGoogleSignIn} disabled={googleLoading}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md disabled:opacity-60 transition-all duration-200">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? <span className="flex items-center gap-2"><Spinner size="sm" /> Connecting...</span> : "Sign in with Google"}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-500">or sign in with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all"
                placeholder="admin@oruyugam.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <PasswordField value={password} onChange={setPassword} placeholder="Enter password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#788023] py-2.5 text-sm font-semibold text-white hover:bg-[#646b1d] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md">
              {loading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Signing in...</span> : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Default: <span className="font-mono text-slate-500">{DEFAULT_ADMIN_EMAIL}</span> / <span className="font-mono text-slate-500">{DEFAULT_ADMIN_PASSWORD}</span>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Yugam Consulting · Lead Tracker v2.0
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// Sidebar Navigation
// =====================================================================

const MAIN_NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: string; badge?: string }> = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "mywork", label: "My Work", icon: "📋" },
  { key: "leads", label: "Leads", icon: "👥" },
  { key: "pipeline", label: "Pipeline", icon: "🔄" },
  { key: "followups", label: "Follow-ups", icon: "📅" },
  { key: "help", label: "Help & Support", icon: "❓" },
  { key: "data-export", label: "Data Export", icon: "📤" },
  { key: "revenue", label: "Revenue", icon: "💰" },
  { key: "invoices", label: "Invoices", icon: "🧾" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "analytics", label: "Analytics", icon: "📊" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "sources", label: "Sources", icon: "📡" },
  { key: "users", label: "Team & Users", icon: "🏢" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

const SUPERADMIN_NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: "superadmin", label: "Admin Dashboard", icon: "🛡️" },
  { key: "tenant-detail", label: "Tenant Detail", icon: "🔍" },
  { key: "plan-templates", label: "Plan Templates", icon: "📑" },
  { key: "billing", label: "Billing", icon: "💳" },
];

function Sidebar({ currentView, onNavigate, currentUser, tenant, leads, mobileOpen, onMobileClose }: {
  currentView: ViewKey; onNavigate: (view: ViewKey) => void; currentUser: User | null; tenant: Tenant | null;
  leads: Lead[]; mobileOpen: boolean; onMobileClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isSuperAdminView = ["superadmin", "tenant-detail", "plan-templates", "billing"].includes(currentView);
  const overdueCount = leads.filter((l) => !l.isDeleted && l.followupStatus === "Pending" && l.nextFollowupDate && l.nextFollowupDate < todayISODate()).length;
  const navItems = MAIN_NAV_ITEMS.map((item) => {
    if (item.key === "followups" && overdueCount > 0) return { ...item, badge: String(overdueCount) };
    return item;
  });

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
        <BrandLogo className={collapsed ? "h-8" : "h-10"} />
        {!collapsed && <span className="text-sm font-semibold text-slate-700">Lead Tracker</span>}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {!isSuperAdminView ? (
          navItems.map((item, idx) => (
            <button key={item.key} onClick={() => { onNavigate(item.key); onMobileClose(); }}
              className={`animate-slide-in mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 ${
                currentView === item.key ? "bg-[#788023]/10 font-semibold text-[#788023]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`} style={{ animationDelay: `${idx * 20}ms` }}>
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white animate-bounce-in">{item.badge}</span>
              )}
            </button>
          ))
        ) : (
          <>
            <button onClick={() => { onNavigate("dashboard"); onMobileClose(); }}
              className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 transition-colors">
              <span>←</span>{!collapsed && <span>Back to Main</span>}
            </button>
            <div className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${collapsed ? "hidden" : ""}`}>Super Admin</div>
            {SUPERADMIN_NAV_ITEMS.map((item) => (
              <button key={item.key} onClick={() => { onNavigate(item.key); onMobileClose(); }}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 ${
                  currentView === item.key ? "bg-[#788023]/10 font-semibold text-[#788023]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}>
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-slate-100 p-2">
        {currentUser?.role === "owner" && !isSuperAdminView && (
          <button onClick={() => { onNavigate("superadmin"); onMobileClose(); }}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#788023] hover:bg-[#788023]/10 transition-colors">
            <span>🛡️</span>{!collapsed && <span>Super Admin</span>}
          </button>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
          {collapsed ? "▶" : "◀"} {!collapsed && "Collapse"}
        </button>
      </div>
      {currentUser && !collapsed && (
        <div className="border-t border-slate-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#788023]/10 text-xs font-bold text-[#788023]">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{currentUser.role} · {tenant?.planName ?? "Free"}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className={`hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
        {sidebarContent}
      </aside>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="modal-backdrop flex-1" onClick={onMobileClose} />
          <aside className="sidebar-mobile-visible w-64 flex-col border-r border-slate-200 bg-white animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// =====================================================================
// Main App Component
// =====================================================================

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [currentView, setCurrentView] = useState<ViewKey>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [appPhase, setAppPhase] = useState<"landing" | "login" | "app">("landing");

  const [leads, setLeads] = useState<Lead[]>(() => loadJson<Lead[]>("lt_leads", []));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadJson<Invoice[]>("lt_invoices", []));
  const [users, setUsers] = useState<User[]>(() => loadJson<User[]>("lt_users", []));
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadJson<AppSettings>("lt_settings", DEFAULT_APP_SETTINGS);
    return { ...DEFAULT_APP_SETTINGS, ...loaded };
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const existing = loadJson<Tenant[]>("lt_tenants", []);
    if (existing.length === 0) {
      const defaultTenant = loadJson<Tenant | null>("lt_tenant", null);
      return defaultTenant ? [defaultTenant] : [];
    }
    return existing;
  });
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>(() => {
    const loaded = loadJson<PlanTemplate[]>("lt_plan_templates", SYSTEM_PLAN_TEMPLATES);
    return normalizePlanTemplates(loaded);
  });

  const persistLeads = useCallback((updated: Lead[]) => { setLeads(updated); saveJson("lt_leads", updated); }, []);
  const persistInvoices = useCallback((updated: Invoice[]) => { setInvoices(updated); saveJson("lt_invoices", updated); }, []);
  const persistUsers = useCallback((updated: User[]) => { setUsers(updated); saveJson("lt_users", updated); }, []);
  const persistSettings = useCallback((updated: AppSettings) => { setSettings(updated); saveJson("lt_settings", updated); }, []);
  const persistTenants = useCallback((updated: Tenant[]) => { setTenants(updated); saveJson("lt_tenants", updated); }, []);
  const persistPlanTemplates = useCallback((updated: PlanTemplate[]) => { setPlanTemplates(updated); saveJson("lt_plan_templates", updated); }, []);

  const handleLogin = useCallback((user: User, tenant: Tenant) => {
    setCurrentUser(user); setCurrentTenant(tenant); initializeDefaultAdmin();
    setAppPhase("app");
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null); setCurrentTenant(null);
    setAppPhase("landing");
  }, []);

  const handleResetData = useCallback(() => {
    persistLeads([]); persistInvoices([]);
    persistSettings(DEFAULT_APP_SETTINGS);
  }, [persistLeads, persistInvoices, persistSettings]);

  // Demo data seeder
  const seedDemoData = useCallback(() => {
    if (leads.length > 0) return;
    const mkLead = (overrides: Partial<Lead> & { leadName: string; companyName: string }): Lead => ({
      id: makeId(), phoneNumber: "", emailId: "", website: "", address: "", assignedTo: "Admin",
      leadSource: "Website", serviceInterested: "Digital Marketing", leadStatus: "New", leadTemperature: "Warm",
      dealValue: 0, wonDealValue: null, collectedAmount: null, dateAdded: todayISODate(),
      nextFollowupDate: "", lastContactedDate: "", followupStatus: "Pending", expectedClosingDate: "",
      notes: "", invoiceFlowStatus: "Not Sent", invoiceSentDate: "", isDeleted: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tenantId: DEFAULT_TENANT_ID,
      duplicateOf: null, tags: [], customFields: {},
      ...overrides,
    });
    const demoLeads: Lead[] = [
      mkLead({ leadName: "Priya Sharma", companyName: "TechVision India", phoneNumber: "9876543210", emailId: "priya@techvision.in", website: "techvision.in", address: "Mumbai, India", leadSource: "LinkedIn", serviceInterested: "Digital Marketing", leadStatus: "Qualified", leadTemperature: "Hot", dealValue: 250000, nextFollowupDate: todayISODate(), lastContactedDate: todayISODate(), followupStatus: "Pending", notes: "Interested in full-service digital marketing package" }),
      mkLead({ leadName: "Rahul Mehta", companyName: "GreenLeaf Solutions", phoneNumber: "9812345678", emailId: "rahul@greenleaf.co", address: "Delhi, India", leadSource: "Referral", serviceInterested: "SEO", leadStatus: "Proposal Sent", leadTemperature: "Warm", dealValue: 180000, dateAdded: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), nextFollowupDate: todayISODate(), lastContactedDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10), notes: "Referred by existing client" }),
      mkLead({ leadName: "Anita Desai", companyName: "StartupHub", phoneNumber: "9988776655", emailId: "anita@startuphub.io", website: "startuphub.io", address: "Bangalore, India", leadSource: "Website", serviceInterested: "Web Development", leadStatus: "New", leadTemperature: "Cold", dealValue: 500000, dateAdded: new Date(Date.now() - 86400000).toISOString().slice(0, 10), notes: "Submitted inquiry through website" }),
      mkLead({ leadName: "Vikram Patel", companyName: "Patel Industries", phoneNumber: "9876501234", emailId: "vikram@patelind.com", address: "Ahmedabad, India", leadSource: "Cold Outreach", serviceInterested: "Branding", leadStatus: "Won", leadTemperature: "Hot", dealValue: 320000, wonDealValue: 320000, collectedAmount: 160000, dateAdded: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), followupStatus: "Done", lastContactedDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), notes: "Closed deal for complete branding package", invoiceFlowStatus: "Sent", invoiceSentDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10) }),
      mkLead({ leadName: "Meera Krishnan", companyName: "EduTech Pro", phoneNumber: "9765432100", emailId: "meera@edutechpro.com", website: "edutechpro.com", address: "Chennai, India", leadSource: "Meta Ads", serviceInterested: "Social Media Management", leadStatus: "Contacted", leadTemperature: "Warm", dealValue: 150000, dateAdded: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), notes: "Came through Facebook ad campaign" }),
      mkLead({ leadName: "Arjun Nair", companyName: "CloudNine Tech", phoneNumber: "9001234567", emailId: "arjun@cloudnine.io", website: "cloudnine.io", address: "Hyderabad, India", leadSource: "LinkedIn", serviceInterested: "Cloud Consulting", leadStatus: "Negotiation", leadTemperature: "Hot", dealValue: 450000, dateAdded: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), lastContactedDate: todayISODate(), expectedClosingDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), notes: "Discussing scope for multi-cloud migration" }),
      mkLead({ leadName: "Kavita Reddy", companyName: "StyleCraft", phoneNumber: "9112233445", emailId: "kavita@stylecraft.in", website: "stylecraft.in", address: "Bangalore, India", leadSource: "Referral", serviceInterested: "Branding", leadStatus: "Confirmation", leadTemperature: "Hot", dealValue: 280000, dateAdded: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), nextFollowupDate: todayISODate(), lastContactedDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), expectedClosingDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), notes: "Confirming final scope and pricing" }),
      mkLead({ leadName: "Sanjay Gupta", companyName: "HealthFirst", phoneNumber: "9223344556", emailId: "sanjay@healthfirst.com", address: "Pune, India", leadSource: "Cold Outreach", serviceInterested: "Digital Marketing", leadStatus: "Lost", leadTemperature: "Cold", dealValue: 200000, dateAdded: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10), followupStatus: "Done", lastContactedDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), notes: "Chose competitor — lower pricing" }),
      mkLead({ leadName: "Deepa Iyer", companyName: "NovaTech Solutions", phoneNumber: "9345678901", emailId: "deepa@novatech.in", website: "novatech.in", address: "Mumbai, India", leadSource: "LinkedIn", serviceInterested: "Web Development", leadStatus: "Invoice Sent", leadTemperature: "Hot", dealValue: 600000, dateAdded: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), invoiceFlowStatus: "Sent", invoiceSentDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), notes: "Invoice sent for web development project" }),
      mkLead({ leadName: "Rajesh Kumar", companyName: "FinServe India", phoneNumber: "9456789012", emailId: "rajesh@finserve.in", address: "Delhi, India", leadSource: "WhatsApp", serviceInterested: "SEO", leadStatus: "Contacted", leadTemperature: "Warm", dealValue: 120000, dateAdded: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), nextFollowupDate: todayISODate(), lastContactedDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), notes: "Contacted via WhatsApp business" }),
      mkLead({ leadName: "Lakshmi Narayan", companyName: "TextileKing", phoneNumber: "9567890123", emailId: "lakshmi@textileking.com", website: "textileking.com", address: "Surat, India", leadSource: "Meta Ads", serviceInterested: "Social Media Management", leadStatus: "Qualified", leadTemperature: "Warm", dealValue: 85000, dateAdded: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), notes: "Wants social media for textile business" }),
      mkLead({ leadName: "Suresh Menon", companyName: "AeroDesign Studios", phoneNumber: "9678901234", emailId: "suresh@aerodesign.co", website: "aerodesign.co", address: "Bangalore, India", leadSource: "Website", serviceInterested: "Branding", leadStatus: "Won", leadTemperature: "Hot", dealValue: 400000, wonDealValue: 380000, collectedAmount: 380000, dateAdded: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), followupStatus: "Done", lastContactedDate: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), notes: "Full branding project completed and paid", invoiceFlowStatus: "Sent", invoiceSentDate: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10) }),
      mkLead({ leadName: "Nandini Rao", companyName: "BioPharm Labs", phoneNumber: "9789012345", emailId: "nandini@biopharm.in", address: "Hyderabad, India", leadSource: "Referral", serviceInterested: "Digital Marketing", leadStatus: "Proposal Sent", leadTemperature: "Hot", dealValue: 350000, dateAdded: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), notes: "Needs digital marketing for pharmaceutical products" }),
      mkLead({ leadName: "Amit Joshi", companyName: "FoodChain Express", phoneNumber: "9890123456", emailId: "amit@foodchain.in", website: "foodchain.in", address: "Pune, India", leadSource: "WhatsApp", serviceInterested: "Web Development", leadStatus: "New", leadTemperature: "Cold", dealValue: 95000, dateAdded: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), notes: "Wants a food delivery website" }),
      mkLead({ leadName: "Priti Shah", companyName: "LegalEdge Associates", phoneNumber: "9901234567", emailId: "priti@legaledge.in", address: "Mumbai, India", leadSource: "LinkedIn", serviceInterested: "SEO", leadStatus: "Negotiation", leadTemperature: "Warm", dealValue: 175000, dateAdded: new Date(Date.now() - 18 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), expectedClosingDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), notes: "Negotiating SEO for law firm" }),
      mkLead({ leadName: "Karan Malhotra", companyName: "FitZone Gyms", phoneNumber: "9012345678", emailId: "karan@fitzone.in", address: "Delhi, India", leadSource: "Cold Outreach", serviceInterested: "Social Media Management", leadStatus: "Lost", leadTemperature: "Cold", dealValue: 60000, dateAdded: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10), followupStatus: "Done", lastContactedDate: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), notes: "Budget constraints, may revisit in Q3" }),
      mkLead({ leadName: "Divya Kapoor", companyName: "Artisan Coffee Co", phoneNumber: "9123456789", emailId: "divya@artisancoffee.in", website: "artisancoffee.in", address: "Bangalore, India", leadSource: "Referral", serviceInterested: "Branding", leadStatus: "Qualified", leadTemperature: "Warm", dealValue: 140000, dateAdded: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), notes: "Wants complete rebrand for chain of coffee shops" }),
      mkLead({ leadName: "Rohit Bansal", companyName: "EduPrime Academy", phoneNumber: "9234567890", emailId: "rohit@eduprime.in", address: "Jaipur, India", leadSource: "LinkedIn", serviceInterested: "Digital Marketing", leadStatus: "New", leadTemperature: "Cold", dealValue: 200000, dateAdded: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), notes: "EdTech startup looking for student acquisition campaigns" }),
      mkLead({ leadName: "Shalini Verma", companyName: "MediCare Plus", phoneNumber: "9345678901", emailId: "shalini@medicareplus.in", website: "medicareplus.in", address: "Lucknow, India", leadSource: "Meta Ads", serviceInterested: "Web Development", leadStatus: "Contacted", leadTemperature: "Warm", dealValue: 300000, dateAdded: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), nextFollowupDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), lastContactedDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), notes: "Healthcare platform needs patient portal development" }),
    ];
    persistLeads(demoLeads);

    // Seed demo invoices
    const inv = loadJson<Invoice[]>("lt_invoices", []);
    if (inv.length === 0) {
      const vikramId = demoLeads.find((l) => l.leadName === "Vikram Patel")?.id ?? "";
      const sureshId = demoLeads.find((l) => l.leadName === "Suresh Menon")?.id ?? "";
      const deepaId = demoLeads.find((l) => l.leadName === "Deepa Iyer")?.id ?? "";
      const demoInvoices: Invoice[] = [
        { id: makeId(), invoiceNumber: "YUGAM-2025-0001", leadId: vikramId, leadName: "Vikram Patel", tenantId: DEFAULT_TENANT_ID, status: "Partially Paid", recurrence: "one-time", lineItems: [{ id: makeId(), serviceName: "Branding Package", description: "Complete branding package including logo, business cards, letterhead", sacCode: "998314", quantity: 1, unitPrice: 270000, gstRate: 18 }], serviceName: "Branding Package", description: "Complete branding package", sacCode: "998314", quantity: 1, unitPrice: 270000, gstRate: 18, gstMode: "Intra", subtotal: 270000, cgstAmount: 24300, sgstAmount: 24300, igstAmount: 0, totalAmount: 318600, amountPaid: 160000, dueDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), issueDate: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10), supplierGstin: "", supplierLegalName: "Yugam Consulting", supplierAddress: "Mumbai", supplierState: "Maharashtra", customerGstin: "", customerLegalName: "Patel Industries", customerAddress: "Ahmedabad", customerState: "Gujarat", notes: "50% advance received", adjustments: [], createdAt: new Date(Date.now() - 25 * 86400000).toISOString(), updatedAt: new Date().toISOString(), parentId: null },
        { id: makeId(), invoiceNumber: "YUGAM-2025-0002", leadId: sureshId, leadName: "Suresh Menon", tenantId: DEFAULT_TENANT_ID, status: "Paid", recurrence: "one-time", lineItems: [{ id: makeId(), serviceName: "Branding & Web Design", description: "Complete brand identity and website", sacCode: "998314", quantity: 1, unitPrice: 322000, gstRate: 18 }], serviceName: "Branding & Web Design", description: "Complete brand identity and website", sacCode: "998314", quantity: 1, unitPrice: 322000, gstRate: 18, gstMode: "Intra", subtotal: 322000, cgstAmount: 28980, sgstAmount: 28980, igstAmount: 0, totalAmount: 379960, amountPaid: 379960, dueDate: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), issueDate: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10), supplierGstin: "", supplierLegalName: "Yugam Consulting", supplierAddress: "Mumbai", supplierState: "Maharashtra", customerGstin: "", customerLegalName: "AeroDesign Studios", customerAddress: "Bangalore", customerState: "Karnataka", notes: "Full payment received", adjustments: [], createdAt: new Date(Date.now() - 40 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(), parentId: null },
        { id: makeId(), invoiceNumber: "YUGAM-2025-0003", leadId: deepaId, leadName: "Deepa Iyer", tenantId: DEFAULT_TENANT_ID, status: "Issued", recurrence: "one-time", lineItems: [{ id: makeId(), serviceName: "Web Development", description: "Full-stack web application development", sacCode: "998314", quantity: 1, unitPrice: 500000, gstRate: 18 }], serviceName: "Web Development", description: "Full-stack web application", sacCode: "998314", quantity: 1, unitPrice: 500000, gstRate: 18, gstMode: "Intra", subtotal: 500000, cgstAmount: 45000, sgstAmount: 45000, igstAmount: 0, totalAmount: 590000, amountPaid: 0, dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), issueDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), supplierGstin: "", supplierLegalName: "Yugam Consulting", supplierAddress: "Mumbai", supplierState: "Maharashtra", customerGstin: "", customerLegalName: "NovaTech Solutions", customerAddress: "Mumbai", customerState: "Maharashtra", notes: "Net-15 payment terms", adjustments: [], createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(), parentId: null },
        { id: makeId(), invoiceNumber: "YUGAM-2025-0004", leadId: "", leadName: "Kavita Reddy", tenantId: DEFAULT_TENANT_ID, status: "Draft", recurrence: "one-time", lineItems: [{ id: makeId(), serviceName: "Branding Consultation", description: "Brand strategy and identity design", sacCode: "998314", quantity: 1, unitPrice: 280000, gstRate: 18 }], serviceName: "Branding Consultation", description: "Brand strategy and identity design", sacCode: "998314", quantity: 1, unitPrice: 280000, gstRate: 18, gstMode: "Intra", subtotal: 280000, cgstAmount: 25200, sgstAmount: 25200, igstAmount: 0, totalAmount: 330400, amountPaid: 0, dueDate: "", issueDate: todayISODate(), supplierGstin: "", supplierLegalName: "Yugam Consulting", supplierAddress: "Mumbai", supplierState: "Maharashtra", customerGstin: "", customerLegalName: "StyleCraft", customerAddress: "Bangalore", customerState: "Karnataka", notes: "Awaiting client confirmation", adjustments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), parentId: null },
      ];
      persistInvoices(demoInvoices);
    }
  }, [leads.length, persistLeads, persistInvoices]);

  const userContext = useMemo(() => currentUser ? { name: currentUser.name, role: currentUser.role } : { name: "", role: "" }, [currentUser]);

  const getNavLabel = (view: ViewKey) => {
    const main = MAIN_NAV_ITEMS.find((n) => n.key === view);
    if (main) return main.label;
    const sa = SUPERADMIN_NAV_ITEMS.find((n) => n.key === view);
    if (sa) return sa.label;
    return "Dashboard";
  };

  // Phase-based routing: Landing → Login → App
  if (appPhase === "landing") return <LandingPage onLogin={() => setAppPhase("login")} />;
  if (appPhase === "login" || !currentUser || !currentTenant) return (
    <div className="relative">
      <button onClick={() => setAppPhase("landing")}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-[#788023] shadow-sm border border-slate-200 transition-colors">
        ← Home
      </button>
      <LoginPage onLogin={handleLogin} />
    </div>
  );
  if (leads.length === 0) seedDemoData();

  const renderView = () => {
    switch (currentView) {
      case "dashboard": return <DashboardView leads={leads} invoices={invoices} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
      case "mywork": return <MyWorkView leads={leads} invoices={invoices} currentUser={userContext} />;
      case "leads": return <LeadsView leads={leads} onLeadsChange={persistLeads} currentUser={userContext} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
      case "pipeline": return <PipelineView leads={leads} onLeadsChange={persistLeads} currentUser={userContext} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
      case "followups": return <FollowupsView leads={leads} onLeadsChange={persistLeads} currentUser={userContext} />;
      case "revenue": return <RevenueView leads={leads} invoices={invoices} />;
      case "invoices": return <InvoicesView invoices={invoices} leads={leads} onInvoicesChange={persistInvoices} />;
      case "sources": return <SourcesView leads={leads} />;
      case "reports": return <ReportsView leads={leads} invoices={invoices} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
      case "analytics": return <AnalyticsView leads={leads} invoices={invoices} />;
      case "notifications": return <NotificationsView leads={leads} invoices={invoices} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
      case "help": return <HelpSupportView />;
      case "data-export": return <DataExportView leads={leads} invoices={invoices} />;
      case "users": return <UsersView users={users} leads={leads} onUsersChange={persistUsers} currentUser={userContext} />;
      case "settings": return <SettingsView settings={settings} onSettingsChange={persistSettings} leads={leads} invoices={invoices} onResetData={handleResetData} />;
      case "superadmin":
      case "tenant-detail":
      case "plan-templates":
      case "billing":
        return (
          <SuperAdminView
            tenants={tenants}
            onTenantsChange={persistTenants}
            planTemplates={planTemplates}
            onPlanTemplatesChange={persistPlanTemplates}
            currentSubView={currentView}
            onNavigate={setCurrentView}
          />
        );
      default: return <DashboardView leads={leads} invoices={invoices} onNavigate={(v) => setCurrentView(v as ViewKey)} />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          currentUser={currentUser}
          tenant={currentTenant}
          leads={leads}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-700">{getNavLabel(currentView)}</h2>
                  <span className="hidden sm:inline text-xs text-slate-400">· {currentTenant.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                   {currentView === "dashboard" ? "Sales overview & pipeline health" :
                    currentView === "leads" ? "Manage leads & contacts" :
                    currentView === "pipeline" ? "Kanban board view" :
                    currentView === "followups" ? "Follow-up queue & scheduling" :
                    currentView === "invoices" ? "Invoice management & GST" :
                    currentView === "revenue" ? "Revenue tracking & forecasting" :
                    currentView === "reports" ? "Custom reports & exports" :
                    currentView === "analytics" ? "Deep business insights & forecasting" :
                    currentView === "notifications" ? "Activity feed & alerts" :
                    currentView === "sources" ? "Lead source performance" :
                    currentView === "mywork" ? "Personal workspace" :
                    currentView === "users" ? "Team management" :
                    currentView === "settings" ? "Application settings" :
                    currentView === "help" ? "Help center & support" :
                    currentView === "data-export" ? "Data export center" :
                    currentView === "superadmin" ? "Platform administration" :
                    currentView === "tenant-detail" ? "Tenant configuration" :
                    currentView === "plan-templates" ? "Plan template editor" :
                    currentView === "billing" ? "Subscription billing" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="hidden lg:inline text-xs text-slate-400">
                {leads.filter((l) => !l.isDeleted).length} leads · {invoices.length} invoices
              </span>
              {leads.filter((l) => !l.isDeleted && l.followupStatus === "Pending" && l.nextFollowupDate && l.nextFollowupDate < todayISODate()).length > 0 && (
                <button className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                  onClick={() => setCurrentView("followups")}>
                  <span className="text-base">🔔</span>
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white animate-bounce-in">
                    {leads.filter((l) => !l.isDeleted && l.followupStatus === "Pending" && l.nextFollowupDate && l.nextFollowupDate < todayISODate()).length}
                  </span>
                </button>
              )}
              {userContext.role === "owner" && (
                <span className="hidden sm:inline-flex rounded-full bg-[#788023]/10 px-2 py-0.5 text-[10px] font-medium text-[#788023] items-center gap-1">
                  🛡️ {tenants.length} tenants
                </span>
              )}
              <div className="hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-[#788023]/10 text-xs font-bold text-[#788023]">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <button onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Logout
              </button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="animate-fade-in">
              {renderView()}
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
