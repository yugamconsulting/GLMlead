// =====================================================================
// SUPER ADMIN VIEWS — Tenant Management, Plan Templates, Billing
// Covers: tenant CRUD, lifecycle, entitlements, subscriptions,
// plan template editor, billing panel, proration, downgrades
// =====================================================================
import { useState, useMemo, useCallback } from "react";
import type {
  Tenant,
  TenantEntitlementDraft,
  PlanTemplate,
  PlanPresetKey,
  BillingCycle,
  ProductMode,
  ViewKey,
} from "../../types/index";
import {
  PLAN_PRICING_MONTHLY_INR,
  PLAN_PRESETS,
  DEFAULT_TENANT_ID,
} from "../../constants/index";
import {
  makeId,
  formatDateDisplay,
  formatInr,
  tenantLifecycle,
  buildSubscriptionFromTenant,
  computeUpgradeProration,
  toTenantDraft,
  templateToTenantPatch,
  inferSystemTemplateId,
  planAmountForCycle,
  planKeyFromName,
  cycleMonths,
  addMonthsIso,
  generateRecoveryPassword,
  oneYearFrom,
} from "../../lib/utils";

// =====================================================================
// SUB-VIEW: Super Admin Dashboard
// =====================================================================

type SuperAdminDashboardProps = {
  tenants: Tenant[];
  planTemplates: PlanTemplate[];
  onNavigate: (view: ViewKey) => void;
};

function SuperAdminDashboard({ tenants, planTemplates, onNavigate }: SuperAdminDashboardProps) {
  const activeTenants = tenants.filter((t) => t.isActive);
  const suspendedTenants = tenants.filter((t) => !t.isActive);
  const lifecycleSummaries = tenants.map((t) => ({
    tenant: t,
    lifecycle: tenantLifecycle(t),
    subscription: buildSubscriptionFromTenant(t),
  }));

  const inGrace = lifecycleSummaries.filter((ls) => ls.lifecycle.status === "Grace");
  const expired = lifecycleSummaries.filter((ls) => ls.lifecycle.status === "Expired");

  const totalMonthlyRevenue = tenants.reduce((sum, t) => {
    const key = planKeyFromName(t.planName);
    const monthly = PLAN_PRICING_MONTHLY_INR[key] ?? 0;
    return sum + monthly;
  }, 0);

  const planDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    tenants.forEach((t) => {
      const plan = t.planName || "Unknown";
      dist[plan] = (dist[plan] || 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [tenants]);

  const productModeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    tenants.forEach((t) => {
      dist[t.productMode] = (dist[t.productMode] || 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [tenants]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Super Admin</h1>
          <p className="text-sm text-slate-500">Platform overview, tenant management, and billing control</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} · {planTemplates.length} plan{planTemplates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Total Tenants", value: tenants.length, icon: "🏢", color: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Active", value: activeTenants.length, icon: "✅", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Suspended", value: suspendedTenants.length, icon: "⛔", color: "bg-slate-100 text-slate-600 border-slate-200" },
          { label: "In Grace", value: inGrace.length, icon: "⏳", color: "bg-amber-50 text-amber-700 border-amber-200" },
          { label: "Expired", value: expired.length, icon: "❌", color: "bg-rose-50 text-rose-700 border-rose-200" },
          { label: "Monthly Rev.", value: formatInr(totalMonthlyRevenue), icon: "💰", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Plan Templates", value: planTemplates.length, icon: "📋", color: "bg-violet-50 text-violet-700 border-violet-200" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
            <div className="flex items-center gap-1.5"><span className="text-sm">{kpi.icon}</span><span className="text-[10px] font-medium opacity-80">{kpi.label}</span></div>
            <p className="mt-2 text-xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button type="button" onClick={() => onNavigate("superadmin" as ViewKey)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#788023] hover:shadow-sm">
          <span className="text-lg">🏢</span>
          <h3 className="mt-2 text-sm font-semibold text-slate-800">Manage Tenants</h3>
          <p className="text-xs text-slate-500">Create, edit, suspend, or delete tenants</p>
        </button>
        <button type="button" onClick={() => onNavigate("plan-templates" as ViewKey)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#788023] hover:shadow-sm">
          <span className="text-lg">📋</span>
          <h3 className="mt-2 text-sm font-semibold text-slate-800">Plan Templates</h3>
          <p className="text-xs text-slate-500">Configure pricing tiers and feature flags</p>
        </button>
        <button type="button" onClick={() => onNavigate("billing" as ViewKey)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#788023] hover:shadow-sm">
          <span className="text-lg">💳</span>
          <h3 className="mt-2 text-sm font-semibold text-slate-800">Billing & Subscriptions</h3>
          <p className="text-xs text-slate-500">View all subscriptions, upgrades, and downgrades</p>
        </button>
        <button type="button" onClick={() => onNavigate("tenant-detail" as ViewKey)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#788023] hover:shadow-sm">
          <span className="text-lg">🔍</span>
          <h3 className="mt-2 text-sm font-semibold text-slate-800">Tenant Details</h3>
          <p className="text-xs text-slate-500">Deep-dive into individual tenant data</p>
        </button>
      </div>

      {/* Plan Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Plan Distribution</h2>
          {planDistribution.length === 0 ? (
            <p className="text-sm text-slate-400">No tenants yet.</p>
          ) : (
            <div className="space-y-2">
              {planDistribution.map(([plan, count]) => {
                const maxCount = Math.max(1, ...planDistribution.map(([, c]) => c));
                const pct = (count / maxCount) * 100;
                return (
                  <div key={plan} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-slate-700 truncate">{plan}</span>
                    <div className="flex-1">
                      <div className="h-6 rounded-full bg-slate-100">
                        <div className="flex h-6 items-center rounded-full bg-[#788023]/70 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(pct, 10)}%` }}>
                          {count} tenant{count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{formatInr(PLAN_PRICING_MONTHLY_INR[plan.toLowerCase() as PlanPresetKey] ?? 0)}/mo each</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Product Mode Distribution</h2>
          {productModeDistribution.length === 0 ? (
            <p className="text-sm text-slate-400">No tenants yet.</p>
          ) : (
            <div className="space-y-2">
              {productModeDistribution.map(([mode, count]) => {
                const maxCount = Math.max(1, ...productModeDistribution.map(([, c]) => c));
                const pct = (count / maxCount) * 100;
                return (
                  <div key={mode} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium text-slate-700 capitalize">{mode}</span>
                    <div className="flex-1">
                      <div className="h-6 rounded-full bg-slate-100">
                        <div className="flex h-6 items-center rounded-full bg-violet-500/70 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(pct, 10)}%` }}>
                          {count}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tenant Lifecycle Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">All Tenants</h2>
        {lifecycleSummaries.length === 0 ? (
          <p className="text-sm text-slate-400">No tenants created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Users</th>
                  <th className="pb-2 pr-4">Leads/mo</th>
                  <th className="pb-2 pr-4">Expiry</th>
                  <th className="pb-2 pr-4">Auto-Renew</th>
                  <th className="pb-2">Rev/mo</th>
                </tr>
              </thead>
              <tbody>
                {lifecycleSummaries.map(({ tenant: t, lifecycle: lc }) => {
                  const statusColor = lc.status === "Active" ? "bg-emerald-100 text-emerald-700"
                    : lc.status === "Grace" ? "bg-amber-100 text-amber-700"
                    : lc.status === "Expired" ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-600";
                  const monthlyRev = PLAN_PRICING_MONTHLY_INR[planKeyFromName(t.planName)] ?? 0;
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2 pr-4">
                        <div>
                          <p className="font-medium text-slate-800">{t.name}</p>
                          <p className="text-[10px] text-slate-400">{t.slug}</p>
                        </div>
                      </td>
                      <td className="py-2 pr-4"><span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{t.planName}</span></td>
                      <td className="py-2 pr-4 capitalize text-slate-600">{t.productMode}</td>
                      <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{lc.status}</span></td>
                      <td className="py-2 pr-4 text-slate-700">{t.maxUsers}</td>
                      <td className="py-2 pr-4 text-slate-700">{t.maxLeadsPerMonth.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{formatDateDisplay(t.licenseEndDate.slice(0, 10))}<br />{lc.daysToExpiry >= 0 ? `${lc.daysToExpiry}d left` : `${lc.daysPastDue}d overdue`}</td>
                      <td className="py-2 pr-4">{t.autoRenew ? <span className="text-emerald-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                      <td className="py-2 text-xs font-medium text-emerald-700">{formatInr(monthlyRev)}</td>
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

// =====================================================================
// SUB-VIEW: Tenant Management
// =====================================================================

type TenantManagementProps = {
  tenants: Tenant[];
  onTenantsChange: (tenants: Tenant[]) => void;
  planTemplates: PlanTemplate[];
};

function TenantManagement({ tenants, onTenantsChange, planTemplates }: TenantManagementProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "grace" | "expired" | "suspended">("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredTenants = useMemo(() => {
    let result = tenants;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(lower) || t.slug.toLowerCase().includes(lower) || t.ownerEmail.toLowerCase().includes(lower)
      );
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => {
        const lc = tenantLifecycle(t);
        if (filterStatus === "active") return lc.status === "Active";
        if (filterStatus === "grace") return lc.status === "Grace";
        if (filterStatus === "expired") return lc.status === "Expired";
        if (filterStatus === "suspended") return lc.status === "Suspended";
        return true;
      });
    }
    return result;
  }, [tenants, searchTerm, filterStatus]);

  const handleCreateTenant = useCallback((draft: TenantEntitlementDraft) => {
    const now = new Date().toISOString();
    const newTenant: Tenant = {
      id: `tenant-${makeId()}`,
      name: draft.name.trim(),
      slug: draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      productMode: draft.productMode,
      planName: draft.planName,
      planTemplateId: inferSystemTemplateId(draft.planName),
      maxUsers: draft.maxUsers,
      maxLeadsPerMonth: draft.maxLeadsPerMonth,
      graceDays: draft.graceDays,
      isActive: true,
      autoRenew: true,
      licenseStartDate: now,
      licenseEndDate: oneYearFrom(now),
      createdAt: now,
      updatedAt: now,
      featureExports: draft.featureExports,
      featureAdvancedForecast: draft.featureAdvancedForecast,
      featureInvoicing: draft.featureInvoicing,
      requireGstCompliance: draft.requireGstCompliance,
      invoiceProfile: draft.invoiceProfile,
      auditRetentionDays: draft.auditRetentionDays,
      recoveryPassword: generateRecoveryPassword(),
      ownerEmail: "",
      ownerName: "",
      ownerPhone: "",
    };
    onTenantsChange([...tenants, newTenant]);
    setShowCreate(false);
  }, [tenants, onTenantsChange]);

  const handleUpdateTenant = useCallback((updated: Tenant) => {
    onTenantsChange(tenants.map((t) => (t.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : t)));
    setEditingTenant(null);
  }, [tenants, onTenantsChange]);

  const handleToggleSuspend = useCallback((tenantId: string) => {
    onTenantsChange(
      tenants.map((t) => (t.id === tenantId ? { ...t, isActive: !t.isActive, updatedAt: new Date().toISOString() } : t))
    );
  }, [tenants, onTenantsChange]);

  const handleDeleteTenant = useCallback((tenantId: string) => {
    onTenantsChange(tenants.filter((t) => t.id !== tenantId));
    setShowDeleteConfirm(null);
  }, [tenants, onTenantsChange]);

  const handleRenewLicense = useCallback((tenantId: string) => {
    onTenantsChange(
      tenants.map((t) =>
        t.id === tenantId
          ? { ...t, licenseEndDate: oneYearFrom(t.licenseEndDate), isActive: true, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }, [tenants, onTenantsChange]);

  const handleApplyPlanTemplate = useCallback((tenantId: string, templateId: string) => {
    const template = planTemplates.find((pt) => pt.id === templateId);
    if (!template) return;
    const patch = templateToTenantPatch(template);
    onTenantsChange(
      tenants.map((t) =>
        t.id === tenantId ? { ...t, ...patch, planTemplateId: templateId, updatedAt: new Date().toISOString() } : t
      )
    );
  }, [tenants, onTenantsChange, planTemplates]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tenant Management</h1>
          <p className="text-sm text-slate-500">Create, configure, and manage all platform tenants</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
          + New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text" placeholder="Search by name, slug, or email..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023] focus:ring-1 focus:ring-[#788023]/40"
        />
        <div className="flex gap-1">
          {(["all", "active", "grace", "expired", "suspended"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${filterStatus === s ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{filteredTenants.length} of {tenants.length} tenants</span>
      </div>

      {/* Tenant Cards */}
      {filteredTenants.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No tenants found.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant) => {
            const lc = tenantLifecycle(tenant);
            const statusColor = lc.status === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : lc.status === "Grace" ? "bg-amber-100 text-amber-700 border-amber-200"
              : lc.status === "Expired" ? "bg-rose-100 text-rose-700 border-rose-200"
              : "bg-slate-100 text-slate-600 border-slate-200";
            const monthlyRev = PLAN_PRICING_MONTHLY_INR[planKeyFromName(tenant.planName)] ?? 0;
            const isDefault = tenant.id === DEFAULT_TENANT_ID;

            return (
              <div key={tenant.id} className={`rounded-xl border p-4 ${lc.status === "Active" ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{tenant.name}</h3>
                    <p className="text-[10px] text-slate-400">{tenant.slug} · {tenant.productMode}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>{lc.status}</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-sm font-bold text-slate-800">{tenant.maxUsers}</p><p className="text-[9px] text-slate-500">Max Users</p></div>
                  <div><p className="text-sm font-bold text-slate-800">{tenant.maxLeadsPerMonth.toLocaleString()}</p><p className="text-[9px] text-slate-500">Leads/mo</p></div>
                  <div><p className="text-sm font-bold text-emerald-700">{formatInr(monthlyRev)}</p><p className="text-[9px] text-slate-500">Revenue/mo</p></div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Plan:</span><span className="font-medium">{tenant.planName}</span></div>
                  <div className="flex justify-between"><span>License Ends:</span><span className={lc.daysToExpiry < 30 ? "text-rose-600 font-medium" : ""}>{formatDateDisplay(tenant.licenseEndDate.slice(0, 10))}</span></div>
                  <div className="flex justify-between"><span>Grace Period:</span><span>{tenant.graceDays} days</span></div>
                  <div className="flex justify-between"><span>Auto-Renew:</span><span>{tenant.autoRenew ? "Yes" : "No"}</span></div>
                </div>

                {/* Feature Flags */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {[
                    { label: "Exports", enabled: tenant.featureExports },
                    { label: "Forecast", enabled: tenant.featureAdvancedForecast },
                    { label: "Invoicing", enabled: tenant.featureInvoicing },
                    { label: "GST", enabled: tenant.requireGstCompliance },
                  ].map((f) => (
                    <span key={f.label} className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${f.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {f.enabled ? "✓" : "✗"} {f.label}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setEditingTenant(tenant)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                  <button type="button" onClick={() => handleApplyPlanTemplate(tenant.id, "")} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">Change Plan</button>
                  {lc.status !== "Active" && (
                    <button type="button" onClick={() => handleRenewLicense(tenant.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100">Renew</button>
                  )}
                  {!isDefault && (
                    <button type="button" onClick={() => handleToggleSuspend(tenant.id)} className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${tenant.isActive ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                      {tenant.isActive ? "Suspend" : "Activate"}
                    </button>
                  )}
                  {!isDefault && (
                    <button type="button" onClick={() => setShowDeleteConfirm(tenant.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-100">Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Tenant Modal */}
      {showCreate && (
        <TenantEditorModal
          planTemplates={planTemplates}
          onSave={handleCreateTenant}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <TenantEditorModal
          tenant={editingTenant}
          planTemplates={planTemplates}
          onSave={(draftOrTenant) => {
            if ("id" in draftOrTenant) {
              handleUpdateTenant(draftOrTenant as Tenant);
            } else {
              const updated = { ...editingTenant, ...(draftOrTenant as Partial<TenantEntitlementDraft>), updatedAt: new Date().toISOString() } as Tenant;
              handleUpdateTenant(updated);
            }
          }}
          onClose={() => setEditingTenant(null)}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-rose-700">Delete Tenant?</h3>
            <p className="mt-2 text-sm text-slate-600">This will permanently remove this tenant and all associated data. This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
              <button type="button" onClick={() => handleDeleteTenant(showDeleteConfirm)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Tenant Editor Modal
// =====================================================================

type TenantEditorModalProps = {
  tenant?: Tenant;
  planTemplates: PlanTemplate[];
  onSave: (draft: TenantEntitlementDraft | Tenant) => void;
  onClose: () => void;
};

function TenantEditorModal({ tenant, planTemplates, onSave, onClose }: TenantEditorModalProps) {
  const isEdit = !!tenant;
  const [form, setForm] = useState<TenantEntitlementDraft>(
    tenant
      ? toTenantDraft(tenant)
      : {
          name: "",
          slug: "",
          productMode: "crm" as ProductMode,
          planName: "Growth",
          maxUsers: 5,
          maxLeadsPerMonth: 500,
          graceDays: 7,
          featureExports: true,
          featureAdvancedForecast: true,
          featureInvoicing: true,
          requireGstCompliance: true,
          invoiceProfile: null,
          auditRetentionDays: 365,
        }
  );

  const [selectedPlanTemplateId, setSelectedPlanTemplateId] = useState<string>(tenant?.planTemplateId ?? "");
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  const handleNameChange = (name: string) => {
    setForm((f) => {
      const updated = { ...f, name };
      if (autoSlug) {
        updated.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      return updated;
    });
  };

  const handleApplyTemplate = (templateId: string) => {
    setSelectedPlanTemplateId(templateId);
    if (!templateId) return;
    const template = planTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setForm((f) => ({
      ...f,
      planName: template.name,
      maxUsers: template.maxUsers,
      maxLeadsPerMonth: template.maxLeadsPerMonth,
      graceDays: template.graceDays,
      featureExports: template.featureExports,
      featureAdvancedForecast: template.featureAdvancedForecast,
      featureInvoicing: template.featureInvoicing,
      requireGstCompliance: template.requireGstCompliance,
      auditRetentionDays: template.auditRetentionDays,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{isEdit ? "Edit Tenant" : "Create New Tenant"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Apply Plan Template */}
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <label className="mb-1 block text-xs font-medium text-violet-700">Quick Apply Plan Template</label>
            <select
              value={selectedPlanTemplateId}
              onChange={(e) => handleApplyTemplate(e.target.value)}
              className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— Select a plan template —</option>
              {planTemplates.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {formatInr(t.monthlyPriceInr)}/mo ({t.isSystemPreset ? "System" : "Custom"})</option>
              ))}
            </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tenant Name *</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Slug *</label>
              <div className="flex items-center gap-1">
                <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.slug} onChange={(e) => { setForm((f) => ({ ...f, slug: e.target.value })); setAutoSlug(false); }} required />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Product Mode</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.productMode} onChange={(e) => setForm((f) => ({ ...f, productMode: e.target.value as ProductMode }))}>
                <option value="crm">CRM</option>
                <option value="field">Field</option>
                <option value="agency">Agency</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Plan Name</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max Users</label>
              <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.maxUsers} onChange={(e) => setForm((f) => ({ ...f, maxUsers: Math.max(1, Number(e.target.value)) }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max Leads/Month</label>
              <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.maxLeadsPerMonth} onChange={(e) => setForm((f) => ({ ...f, maxLeadsPerMonth: Math.max(1, Number(e.target.value)) }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Grace Days</label>
              <input type="number" min={0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.graceDays} onChange={(e) => setForm((f) => ({ ...f, graceDays: Math.max(0, Number(e.target.value)) }))} />
            </div>
          </div>

          {/* Feature Flags */}
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="mb-2 block text-xs font-medium text-slate-600">Feature Flags</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "featureExports" as const, label: "CSV/JSON Exports" },
                { key: "featureAdvancedForecast" as const, label: "Advanced Forecast" },
                { key: "featureInvoicing" as const, label: "Invoicing Module" },
                { key: "requireGstCompliance" as const, label: "GST Compliance" },
              ] as const).map((flag) => (
                <label key={flag.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[flag.key] as boolean}
                    onChange={(e) => setForm((f) => ({ ...f, [flag.key]: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-700">{flag.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Audit Retention */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Audit Retention (days)</label>
            <input type="number" min={30} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.auditRetentionDays} onChange={(e) => setForm((f) => ({ ...f, auditRetentionDays: Math.max(30, Number(e.target.value)) }))} />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
              {isEdit ? "Save Changes" : "Create Tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// SUB-VIEW: Plan Templates
// =====================================================================

type PlanTemplatesProps = {
  planTemplates: PlanTemplate[];
  onPlanTemplatesChange: (templates: PlanTemplate[]) => void;
};

function PlanTemplates({ planTemplates, onPlanTemplatesChange }: PlanTemplatesProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PlanTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const systemTemplates = planTemplates.filter((t) => t.isSystemPreset);
  const customTemplates = planTemplates.filter((t) => !t.isSystemPreset);

  const handleCreateTemplate = useCallback((template: PlanTemplate) => {
    onPlanTemplatesChange([...planTemplates, template]);
    setShowEditor(false);
  }, [planTemplates, onPlanTemplatesChange]);

  const handleUpdateTemplate = useCallback((updated: PlanTemplate) => {
    onPlanTemplatesChange(planTemplates.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTemplate(null);
  }, [planTemplates, onPlanTemplatesChange]);

  const handleToggleActive = useCallback((templateId: string) => {
    onPlanTemplatesChange(
      planTemplates.map((t) => (t.id === templateId ? { ...t, isActive: !t.isActive, updatedAt: new Date().toISOString() } : t))
    );
  }, [planTemplates, onPlanTemplatesChange]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    onPlanTemplatesChange(planTemplates.filter((t) => t.id !== templateId));
    setShowDeleteConfirm(null);
  }, [planTemplates, onPlanTemplatesChange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Plan Templates</h1>
          <p className="text-sm text-slate-500">Manage pricing tiers, feature flags, and plan presets</p>
        </div>
        <button type="button" onClick={() => setShowEditor(true)} className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
          + New Plan Template
        </button>
      </div>

      {/* System Presets */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">System Presets</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {systemTemplates.map((template) => (
            <PlanTemplateCard
              key={template.id}
              template={template}
              onEdit={setEditingTemplate}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Custom Templates</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {customTemplates.map((template) => (
              <PlanTemplateCard
                key={template.id}
                template={template}
                onEdit={setEditingTemplate}
                onToggleActive={handleToggleActive}
                onDelete={setShowDeleteConfirm}
                canDelete
              />
            ))}
          </div>
        </div>
      )}

      {/* Pricing Comparison Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Plan Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                <th className="pb-2 pr-4">Feature</th>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <th key={t.id} className="pb-2 px-3 text-center">{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">Monthly Price</td>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <td key={t.id} className="py-2 px-3 text-center font-bold text-emerald-700">{formatInr(t.monthlyPriceInr)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">Max Users</td>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <td key={t.id} className="py-2 px-3 text-center">{t.maxUsers}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">Max Leads/mo</td>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <td key={t.id} className="py-2 px-3 text-center">{t.maxLeadsPerMonth.toLocaleString()}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">Grace Days</td>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <td key={t.id} className="py-2 px-3 text-center">{t.graceDays}</td>
                ))}
              </tr>
              {[
                { key: "featureExports" as const, label: "Exports" },
                { key: "featureAdvancedForecast" as const, label: "Advanced Forecast" },
                { key: "featureInvoicing" as const, label: "Invoicing" },
                { key: "requireGstCompliance" as const, label: "GST Compliance" },
              ].map((feature) => (
                <tr key={feature.key} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-700">{feature.label}</td>
                  {planTemplates.filter((t) => t.isActive).map((t) => (
                    <td key={t.id} className="py-2 px-3 text-center">
                      {t[feature.key] ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-700">Audit Retention</td>
                {planTemplates.filter((t) => t.isActive).map((t) => (
                  <td key={t.id} className="py-2 px-3 text-center">{t.auditRetentionDays}d</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showEditor || editingTemplate) && (
        <PlanTemplateEditorModal
          template={editingTemplate}
          onSave={(t) => {
            if (editingTemplate) handleUpdateTemplate(t);
            else handleCreateTemplate(t);
          }}
          onClose={() => { setShowEditor(false); setEditingTemplate(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-rose-700">Delete Plan Template?</h3>
            <p className="mt-2 text-sm text-slate-600">This will permanently remove this plan template. Tenants already on this plan will not be affected.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
              <button type="button" onClick={() => handleDeleteTemplate(showDeleteConfirm)} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Plan Template Card
// =====================================================================

function PlanTemplateCard({ template, onEdit, onToggleActive, onDelete, canDelete = false }: {
  template: PlanTemplate;
  onEdit: (t: PlanTemplate) => void;
  onToggleActive: (id: string) => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  const presetKey = planKeyFromName(template.name);
  const popularPlan = presetKey === "growth";

  return (
    <div className={`rounded-xl border p-4 ${template.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"} ${popularPlan ? "ring-2 ring-[#788023]/40" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{template.name}</h3>
            {template.isSystemPreset && <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-medium text-sky-700">System</span>}
            {popularPlan && <span className="rounded bg-[#788023] px-1.5 py-0.5 text-[9px] font-medium text-white">Popular</span>}
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">{template.offerLabel}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
          {template.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-[#788023]">{formatInr(template.monthlyPriceInr)}<span className="text-xs font-normal text-slate-500">/mo</span></p>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between"><span>Max Users:</span><span className="font-medium">{template.maxUsers}</span></div>
        <div className="flex justify-between"><span>Leads/mo:</span><span className="font-medium">{template.maxLeadsPerMonth.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Grace Days:</span><span className="font-medium">{template.graceDays}</span></div>
        <div className="flex justify-between"><span>Audit:</span><span className="font-medium">{template.auditRetentionDays}d</span></div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {[
          { label: "Exports", on: template.featureExports },
          { label: "Forecast", on: template.featureAdvancedForecast },
          { label: "Invoicing", on: template.featureInvoicing },
          { label: "GST", on: template.requireGstCompliance },
        ].map((f) => (
          <span key={f.label} className={`rounded px-1 py-0.5 text-[8px] font-medium ${f.on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
            {f.on ? "✓" : "✗"} {f.label}
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        <button type="button" onClick={() => onEdit(template)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">Edit</button>
        <button type="button" onClick={() => onToggleActive(template.id)} className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-medium ${template.isActive ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {template.isActive ? "Disable" : "Enable"}
        </button>
        {canDelete && onDelete && (
          <button type="button" onClick={() => onDelete(template.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">Delete</button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Plan Template Editor Modal
// =====================================================================

function PlanTemplateEditorModal({ template, onSave, onClose }: {
  template: PlanTemplate | null;
  onSave: (t: PlanTemplate) => void;
  onClose: () => void;
}) {
  const isEdit = !!template;
  const [form, setForm] = useState<PlanTemplate>(
    template ?? {
      id: `plan-${makeId()}`,
      name: "",
      description: "",
      monthlyPriceInr: 0,
      offerLabel: "",
      maxUsers: 1,
      maxLeadsPerMonth: 100,
      graceDays: 7,
      featureExports: true,
      featureAdvancedForecast: true,
      featureInvoicing: true,
      requireGstCompliance: true,
      auditRetentionDays: 365,
      isSystemPreset: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }
  );

  const [applyPreset, setApplyPreset] = useState<PlanPresetKey | "">("");

  const handlePresetApply = (key: PlanPresetKey) => {
    setApplyPreset(key);
    const preset = PLAN_PRESETS[key];
    if (preset) {
      setForm((f) => ({
        ...f,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        maxUsers: preset.maxUsers,
        maxLeadsPerMonth: preset.maxLeadsPerMonth,
        graceDays: preset.graceDays,
        featureExports: preset.featureExports,
        featureAdvancedForecast: preset.featureAdvancedForecast,
        featureInvoicing: preset.featureInvoicing,
        requireGstCompliance: preset.requireGstCompliance,
        auditRetentionDays: preset.auditRetentionDays,
        monthlyPriceInr: PLAN_PRICING_MONTHLY_INR[key],
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), updatedAt: new Date().toISOString() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">{isEdit ? "Edit Plan Template" : "Create Plan Template"}</h2>

        {!isEdit && (
          <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
            <label className="mb-1 block text-xs font-medium text-violet-700">Quick Start from Preset</label>
            <div className="flex gap-2">
              {(["starter", "growth", "scale", "enterprise"] as const).map((key) => (
                <button key={key} type="button" onClick={() => handlePresetApply(key)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${applyPreset === key ? "bg-violet-600 text-white" : "bg-white text-violet-700 border border-violet-300 hover:bg-violet-100"}`}>
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Plan Name *</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Monthly Price (INR)</label>
              <input type="number" min={0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.monthlyPriceInr} onChange={(e) => setForm((f) => ({ ...f, monthlyPriceInr: Math.max(0, Number(e.target.value)) }))} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Offer Label</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.offerLabel} onChange={(e) => setForm((f) => ({ ...f, offerLabel: e.target.value }))} placeholder="e.g., Most popular for agencies" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max Users</label>
              <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.maxUsers} onChange={(e) => setForm((f) => ({ ...f, maxUsers: Math.max(1, Number(e.target.value)) }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max Leads/mo</label>
              <input type="number" min={1} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.maxLeadsPerMonth} onChange={(e) => setForm((f) => ({ ...f, maxLeadsPerMonth: Math.max(1, Number(e.target.value)) }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Grace Days</label>
              <input type="number" min={0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.graceDays} onChange={(e) => setForm((f) => ({ ...f, graceDays: Math.max(0, Number(e.target.value)) }))} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="mb-2 block text-xs font-medium text-slate-600">Feature Flags</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "featureExports" as const, label: "CSV/JSON Exports" },
                { key: "featureAdvancedForecast" as const, label: "Advanced Forecast" },
                { key: "featureInvoicing" as const, label: "Invoicing Module" },
                { key: "requireGstCompliance" as const, label: "GST Compliance" },
              ] as const).map((flag) => (
                <label key={flag.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={form[flag.key] as boolean} onChange={(e) => setForm((f) => ({ ...f, [flag.key]: e.target.checked }))} />
                  <span className="text-sm text-slate-700">{flag.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Audit Retention (days)</label>
            <input type="number" min={30} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.auditRetentionDays} onChange={(e) => setForm((f) => ({ ...f, auditRetentionDays: Math.max(30, Number(e.target.value)) }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d]">
              {isEdit ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// SUB-VIEW: Billing & Subscriptions
// =====================================================================

type BillingProps = {
  tenants: Tenant[];
  onTenantsChange: (tenants: Tenant[]) => void;
  planTemplates: PlanTemplate[];
};

function BillingPanel({ tenants, onTenantsChange, planTemplates }: BillingProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [showUpgradeModal, setShowUpgradeModal] = useState<Tenant | null>(null);
  const [showRenewModal, setShowRenewModal] = useState<Tenant | null>(null);

  const subscriptions = useMemo(() => tenants.map(buildSubscriptionFromTenant), [tenants]);

  const uniquePlans = useMemo(() => {
    const plans = new Set(tenants.map((t) => t.planName));
    return Array.from(plans).sort();
  }, [tenants]);

  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((sub) => {
        const tenant = tenants.find((t) => t.id === sub.tenantId);
        return tenant?.name.toLowerCase().includes(lower) || tenant?.slug.toLowerCase().includes(lower) || sub.planName.toLowerCase().includes(lower);
      });
    }
    if (filterPlan !== "all") {
      result = result.filter((sub) => sub.planName === filterPlan);
    }
    return result;
  }, [subscriptions, tenants, searchTerm, filterPlan]);

  const totalMonthlyRevenue = useMemo(
    () => tenants.reduce((sum, t) => sum + (PLAN_PRICING_MONTHLY_INR[planKeyFromName(t.planName)] ?? 0), 0),
    [tenants]
  );

  const totalAnnualProjection = totalMonthlyRevenue * 12;

  const handleUpgrade = useCallback((tenant: Tenant, newPlanName: string, billingCycle: BillingCycle) => {
    const newTemplateId = inferSystemTemplateId(newPlanName);
    const template = planTemplates.find((t) => t.id === newTemplateId);
    const patch = template ? templateToTenantPatch(template) : {};
    const now = new Date().toISOString();

    onTenantsChange(
      tenants.map((t) =>
        t.id === tenant.id
          ? {
              ...t,
              ...patch,
              planName: newPlanName,
              planTemplateId: newTemplateId,
              licenseEndDate: addMonthsIso(t.licenseEndDate, cycleMonths(billingCycle)),
              updatedAt: now,
            }
          : t
      )
    );
    setShowUpgradeModal(null);
  }, [tenants, onTenantsChange, planTemplates]);

  const handleRenew = useCallback((tenant: Tenant, cycle: BillingCycle) => {
    onTenantsChange(
      tenants.map((t) =>
        t.id === tenant.id
          ? {
              ...t,
              licenseEndDate: addMonthsIso(t.licenseEndDate, cycleMonths(cycle)),
              isActive: true,
              autoRenew: true,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );
    setShowRenewModal(null);
  }, [tenants, onTenantsChange]);

  const handleToggleAutoRenew = useCallback((tenantId: string) => {
    onTenantsChange(
      tenants.map((t) => (t.id === tenantId ? { ...t, autoRenew: !t.autoRenew, updatedAt: new Date().toISOString() } : t))
    );
  }, [tenants, onTenantsChange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Billing & Subscriptions</h1>
          <p className="text-sm text-slate-500">Manage plan changes, renewals, and billing cycles</p>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Monthly Revenue", value: formatInr(totalMonthlyRevenue), icon: "💰", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Annual Projection", value: formatInr(totalAnnualProjection), icon: "📈", color: "bg-sky-50 text-sky-700 border-sky-200" },
          { label: "Active Subscriptions", value: String(subscriptions.filter((s) => s.status === "active").length), icon: "✅", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { label: "Suspended", value: String(subscriptions.filter((s) => s.status === "suspended").length), icon: "⛔", color: "bg-rose-50 text-rose-700 border-rose-200" },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
            <div className="flex items-center gap-1.5"><span className="text-sm">{kpi.icon}</span><span className="text-[10px] font-medium opacity-80">{kpi.label}</span></div>
            <p className="mt-2 text-xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text" placeholder="Search tenants..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#788023]"
        />
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All Plans</option>
          {uniquePlans.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filteredSubscriptions.length} subscriptions</span>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">All Subscriptions</h2>
        {filteredSubscriptions.length === 0 ? (
          <p className="text-sm text-slate-400">No subscriptions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                  <th className="pb-2 pr-4">Tenant</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Billing</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Renewal</th>
                  <th className="pb-2 pr-4">Auto-Renew</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub) => {
                  const tenant = tenants.find((t) => t.id === sub.tenantId);
                  if (!tenant) return null;
                  const lc = tenantLifecycle(tenant);
                  const monthlyAmount = planAmountForCycle(sub.planName, sub.billingCycle);

                  return (
                    <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-800">{tenant.name}</p>
                        <p className="text-[10px] text-slate-400">{tenant.slug}</p>
                      </td>
                      <td className="py-2 pr-4"><span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{sub.planName}</span></td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sub.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {sub.status === "active" ? lc.status : "Suspended"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 capitalize text-slate-600">{sub.billingCycle}</td>
                      <td className="py-2 pr-4 text-xs font-medium text-emerald-700">{formatInr(monthlyAmount)}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{formatDateDisplay(sub.renewalDate.slice(0, 10))}</td>
                      <td className="py-2 pr-4">
                        <button type="button" onClick={() => handleToggleAutoRenew(tenant.id)}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${tenant.autoRenew ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {tenant.autoRenew ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setShowUpgradeModal(tenant)} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50">Change Plan</button>
                          <button type="button" onClick={() => setShowRenewModal(tenant)} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100">Renew</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upgrade/Change Plan Modal */}
      {showUpgradeModal && (
        <UpgradePlanModal
          tenant={showUpgradeModal}
          planTemplates={planTemplates}
          onUpgrade={handleUpgrade}
          onClose={() => setShowUpgradeModal(null)}
        />
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <RenewModal
          tenant={showRenewModal}
          onRenew={handleRenew}
          onClose={() => setShowRenewModal(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// Upgrade Plan Modal
// =====================================================================

function UpgradePlanModal({ tenant, planTemplates, onUpgrade, onClose }: {
  tenant: Tenant;
  planTemplates: PlanTemplate[];
  onUpgrade: (tenant: Tenant, newPlan: string, cycle: BillingCycle) => void;
  onClose: () => void;
}) {
  const currentPlanKey = planKeyFromName(tenant.planName);
  const [selectedPlan, setSelectedPlan] = useState<string>(tenant.planName);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");

  const currentMonthly = PLAN_PRICING_MONTHLY_INR[currentPlanKey] ?? 0;
  const newPlanKey = planKeyFromName(selectedPlan);
  const newMonthly = PLAN_PRICING_MONTHLY_INR[newPlanKey] ?? 0;
  const newCycleAmount = planAmountForCycle(selectedPlan, selectedCycle);
  const proration = computeUpgradeProration(tenant.planName, selectedPlan, selectedCycle, tenant.licenseEndDate);
  const isUpgrade = newMonthly > currentMonthly;
  const isDowngrade = newMonthly < currentMonthly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Change Plan — {tenant.name}</h2>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Current Plan</p>
          <p className="text-sm font-semibold text-slate-800">{tenant.planName} — {formatInr(currentMonthly)}/mo</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">New Plan</label>
            <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {planTemplates.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.name}>{t.name} — {formatInr(t.monthlyPriceInr)}/mo</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Billing Cycle</label>
            <div className="flex gap-2">
              {(["monthly", "quarterly", "annually"] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setSelectedCycle(cycle)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize ${selectedCycle === cycle ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                  {cycle} ({formatInr(planAmountForCycle(selectedPlan, cycle))})
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className={`rounded-lg border p-3 ${isUpgrade ? "border-emerald-200 bg-emerald-50" : isDowngrade ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-xs font-medium text-slate-700 mb-2">Plan Change Summary</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-600">New Plan:</span><span className="font-medium">{selectedPlan}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">New Amount:</span><span className="font-medium">{formatInr(newCycleAmount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Proration (today):</span><span className="font-medium">{formatInr(proration)}</span></div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-700">
                  {isUpgrade ? "↑ Upgrade" : isDowngrade ? "↓ Downgrade" : "→ Same Plan"}
                </span>
                <span className={`font-bold ${isUpgrade ? "text-emerald-700" : isDowngrade ? "text-amber-700" : "text-slate-700"}`}>
                  {formatInr(Math.abs(newMonthly - currentMonthly))}{isUpgrade ? "/mo more" : isDowngrade ? "/mo less" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" onClick={() => onUpgrade(tenant, selectedPlan, selectedCycle)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${isUpgrade ? "bg-emerald-600 hover:bg-emerald-700" : isDowngrade ? "bg-amber-600 hover:bg-amber-700" : "bg-[#788023] hover:bg-[#646b1d]"}`}>
            {isUpgrade ? "Upgrade Now" : isDowngrade ? "Downgrade Now" : "Apply Change"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Renew Modal
// =====================================================================

function RenewModal({ tenant, onRenew, onClose }: {
  tenant: Tenant;
  onRenew: (tenant: Tenant, cycle: BillingCycle) => void;
  onClose: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const lc = tenantLifecycle(tenant);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Renew License — {tenant.name}</h2>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Current Plan:</span><span className="font-medium">{tenant.planName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="font-medium">{lc.status}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">License Ends:</span><span className="font-medium">{formatDateDisplay(tenant.licenseEndDate.slice(0, 10))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Days {lc.daysToExpiry >= 0 ? "Remaining" : "Overdue"}:</span><span className={`font-medium ${lc.daysToExpiry < 0 ? "text-rose-600" : ""}`}>{Math.abs(lc.daysToExpiry)}</span></div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">Renewal Period</label>
          <div className="flex gap-2">
            {(["monthly", "quarterly", "annually"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCycle(c)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize ${cycle === c ? "border-[#788023] bg-[#788023]/10 text-[#788023]" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <p className="font-medium text-emerald-700">New license end: {formatDateDisplay(addMonthsIso(tenant.licenseEndDate, cycleMonths(cycle)).slice(0, 10))}</p>
          <p className="mt-1 text-emerald-600">Amount: {formatInr(planAmountForCycle(tenant.planName, cycle))}</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="button" onClick={() => onRenew(tenant, cycle)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Confirm Renewal</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// TENANT DETAIL VIEW — Deep-dive into individual tenant
// =====================================================================

type TenantDetailViewProps = {
  tenants: Tenant[];
  onTenantsChange: (tenants: Tenant[]) => void;
  planTemplates: PlanTemplate[];
};

function TenantDetailView({ tenants }: TenantDetailViewProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenants[0]?.id ?? "");
  const [detailTab, setDetailTab] = useState<"overview" | "entitlements" | "subscription" | "logs">("overview");

  const tenant = tenants.find((t) => t.id === selectedTenantId);
  const lc = tenant ? tenantLifecycle(tenant) : null;
  const sub = tenant ? buildSubscriptionFromTenant(tenant) : null;

  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">No tenants available. Create tenants from the Tenant Management section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tenant Details</h1>
          <p className="text-sm text-slate-500">Deep-dive into individual tenant configuration and lifecycle</p>
        </div>
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </div>

      {tenant && lc && sub && (
        <>
          <div className="flex gap-2">
            {(["overview", "entitlements", "subscription", "logs"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${detailTab === tab ? "bg-[#788023] text-white" : "bg-slate-100 text-slate-700"}`}>
                {tab}
              </button>
            ))}
          </div>

          {detailTab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Basic Info</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["Name", tenant.name],
                    ["Slug", tenant.slug],
                    ["Product Mode", tenant.productMode],
                    ["Owner", tenant.ownerName || "Not set"],
                    ["Owner Email", tenant.ownerEmail || "Not set"],
                    ["Owner Phone", tenant.ownerPhone || "Not set"],
                    ["Created", formatDateDisplay(tenant.createdAt.slice(0, 10))],
                    ["Updated", formatDateDisplay(tenant.updatedAt.slice(0, 10))],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-800 capitalize">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Lifecycle Status</h3>
                <div className={`mb-4 rounded-lg border p-4 text-center ${
                  lc.status === "Active" ? "border-emerald-200 bg-emerald-50" :
                  lc.status === "Grace" ? "border-amber-200 bg-amber-50" :
                  lc.status === "Expired" ? "border-rose-200 bg-rose-50" :
                  "border-slate-200 bg-slate-50"
                }`}>
                  <p className={`text-3xl font-bold ${
                    lc.status === "Active" ? "text-emerald-700" :
                    lc.status === "Grace" ? "text-amber-700" :
                    lc.status === "Expired" ? "text-rose-700" :
                    "text-slate-600"
                  }`}>{lc.status}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {lc.daysToExpiry >= 0 ? `${lc.daysToExpiry} days until expiry` : `${lc.daysPastDue} days past due`}
                  </p>
                  {lc.inGrace && <p className="mt-1 text-xs text-amber-600 font-medium">⚠️ In grace period</p>}
                  {lc.isBlocked && <p className="mt-1 text-xs text-rose-600 font-medium">🚫 Access blocked</p>}
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["License Start", formatDateDisplay(tenant.licenseStartDate.slice(0, 10))],
                    ["License End", formatDateDisplay(tenant.licenseEndDate.slice(0, 10))],
                    ["Grace Days", `${tenant.graceDays} days`],
                    ["Days to Expiry", `${lc.daysToExpiry}`],
                    ["Days Past Due", `${lc.daysPastDue}`],
                    ["In Grace", lc.inGrace ? "Yes" : "No"],
                    ["Is Blocked", lc.isBlocked ? "Yes" : "No"],
                    ["Auto-Renew", tenant.autoRenew ? "Yes" : "No"],
                    ["Recovery Password", tenant.recoveryPassword ? "••••••••" : "Not set"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {detailTab === "entitlements" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Entitlements & Feature Flags</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Usage Limits</h4>
                  <div className="space-y-2">
                    {[
                      ["Max Users", String(tenant.maxUsers)],
                      ["Max Leads/Month", tenant.maxLeadsPerMonth.toLocaleString()],
                      ["Audit Retention", `${tenant.auditRetentionDays} days`],
                      ["Plan Name", tenant.planName],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-1.5 border-b border-slate-50 text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-medium text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Feature Flags</h4>
                  <div className="space-y-2">
                    {[
                      { label: "CSV/JSON Exports", enabled: tenant.featureExports },
                      { label: "Advanced Forecast", enabled: tenant.featureAdvancedForecast },
                      { label: "Invoicing Module", enabled: tenant.featureInvoicing },
                      { label: "GST Compliance", enabled: tenant.requireGstCompliance },
                    ].map((f) => (
                      <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                        <span className="text-sm text-slate-700">{f.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {f.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === "subscription" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Subscription Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Subscription ID", sub.id],
                  ["Plan", sub.planName],
                  ["Billing Cycle", sub.billingCycle],
                  ["Amount/Cycle", formatInr(planAmountForCycle(sub.planName, sub.billingCycle))],
                  ["Status", sub.status],
                  ["Renewal Date", formatDateDisplay(sub.renewalDate.slice(0, 10))],
                  ["Grace Ends", formatDateDisplay(sub.graceEndsAt.slice(0, 10))],
                  ["Auto-Renew", sub.autoRenew ? "Yes" : "No"],
                  ["Retry Count", String(sub.retryCount)],
                  ["Scheduled Downgrade", sub.scheduledDowngradePlanTemplateId ?? "None"],
                  ["Created", formatDateDisplay(sub.createdAt.slice(0, 10))],
                  ["Updated", formatDateDisplay(sub.updatedAt.slice(0, 10))],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-800 capitalize">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailTab === "logs" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Activity Log</h3>
              <div className="space-y-2">
                {[
                  { action: "Tenant Created", date: tenant.createdAt, detail: `Initial setup with ${tenant.planName} plan` },
                  { action: "Last Updated", date: tenant.updatedAt, detail: "Configuration change" },
                  { action: "License Start", date: tenant.licenseStartDate, detail: `Valid until ${formatDateDisplay(tenant.licenseEndDate.slice(0, 10))}` },
                ].map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-[#788023]" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{log.action}</p>
                      <p className="text-xs text-slate-400">{log.detail} · {formatDateDisplay(log.date.slice(0, 10))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =====================================================================
// MAIN EXPORT: SuperAdmin View Router
// =====================================================================

export type SuperAdminViewProps = {
  tenants: Tenant[];
  onTenantsChange: (tenants: Tenant[]) => void;
  planTemplates: PlanTemplate[];
  onPlanTemplatesChange: (templates: PlanTemplate[]) => void;
  currentSubView: string;
  onNavigate: (view: ViewKey) => void;
};

export function SuperAdminView({
  tenants,
  onTenantsChange,
  planTemplates,
  onPlanTemplatesChange,
  currentSubView,
  onNavigate,
}: SuperAdminViewProps) {
  // Sub-view routing
  switch (currentSubView) {
    case "tenant-detail":
      return <TenantDetailView tenants={tenants} onTenantsChange={onTenantsChange} planTemplates={planTemplates} />;
    case "plan-templates":
      return <PlanTemplates planTemplates={planTemplates} onPlanTemplatesChange={onPlanTemplatesChange} />;
    case "billing":
      return <BillingPanel tenants={tenants} onTenantsChange={onTenantsChange} planTemplates={planTemplates} />;
    case "superadmin":
      return <TenantManagement tenants={tenants} onTenantsChange={onTenantsChange} planTemplates={planTemplates} />;
    default:
      return <SuperAdminDashboard tenants={tenants} planTemplates={planTemplates} onNavigate={onNavigate} />;
  }
}
