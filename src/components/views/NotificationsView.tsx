// @ts-nocheck
// =====================================================================
// NOTIFICATIONS VIEW — Real-time notification center
// Activity feed, alerts, mentions, system notifications,
// read/unread management, bulk actions, filters, sound alerts
// =====================================================================
import { useState, useMemo, useCallback, useEffect } from "react";
import type { Lead, Invoice } from "../../types/index";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
export type NotificationType =
  | "lead.created" | "lead.won" | "lead.lost" | "lead.assigned" | "lead.stage_change"
  | "followup.overdue" | "followup.due_today" | "followup.completed"
  | "invoice.created" | "invoice.paid" | "invoice.overdue" | "invoice.payment_received"
  | "system.update" | "system.alert" | "system.welcome"
  | "team.member_added" | "team.role_change"
  | "target.achieved" | "target.milestone";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  leadId?: string;
  invoiceId?: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  expiresAt?: string;
  dismissed: boolean;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  "lead.created":      { icon: "👤", color: "text-blue-600",   bg: "bg-blue-50" },
  "lead.won":          { icon: "🎉", color: "text-emerald-600", bg: "bg-emerald-50" },
  "lead.lost":         { icon: "💔", color: "text-red-600",     bg: "bg-red-50" },
  "lead.assigned":     { icon: "🔗", color: "text-violet-600",  bg: "bg-violet-50" },
  "lead.stage_change": { icon: "🔄", color: "text-indigo-600",  bg: "bg-indigo-50" },
  "followup.overdue":  { icon: "⚠️", color: "text-red-600",     bg: "bg-red-50" },
  "followup.due_today":{ icon: "📅", color: "text-amber-600",   bg: "bg-amber-50" },
  "followup.completed":{ icon: "✅", color: "text-green-600",   bg: "bg-green-50" },
  "invoice.created":   { icon: "🧾", color: "text-cyan-600",    bg: "bg-cyan-50" },
  "invoice.paid":      { icon: "💰", color: "text-emerald-600", bg: "bg-emerald-50" },
  "invoice.overdue":   { icon: "🔴", color: "text-red-600",     bg: "bg-red-50" },
  "invoice.payment_received": { icon: "💳", color: "text-green-600", bg: "bg-green-50" },
  "system.update":     { icon: "🔔", color: "text-slate-600",   bg: "bg-slate-50" },
  "system.alert":      { icon: "🚨", color: "text-orange-600",  bg: "bg-orange-50" },
  "system.welcome":    { icon: "👋", color: "text-brand-600",   bg: "bg-brand-50" },
  "team.member_added": { icon: "🤝", color: "text-blue-600",    bg: "bg-blue-50" },
  "team.role_change":  { icon: "🔑", color: "text-violet-600",  bg: "bg-violet-50" },
  "target.achieved":   { icon: "🏆", color: "text-amber-600",   bg: "bg-amber-50" },
  "target.milestone":  { icon: "🎯", color: "text-emerald-600", bg: "bg-emerald-50" },
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-l-slate-300",
  medium: "border-l-blue-400",
  high: "border-l-amber-400",
  urgent: "border-l-red-500",
};

type FilterType = "all" | "unread" | "leads" | "followups" | "invoices" | "system" | "team";

const FILTER_CONFIG: { key: FilterType; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "📨" },
  { key: "unread", label: "Unread", icon: "🔵" },
  { key: "leads", label: "Leads", icon: "👤" },
  { key: "followups", label: "Follow-ups", icon: "📅" },
  { key: "invoices", label: "Invoices", icon: "🧾" },
  { key: "system", label: "System", icon: "🔔" },
  { key: "team", label: "Team", icon: "🤝" },
];

/* ------------------------------------------------------------------ */
/* Notification Generator                                             */
/* ------------------------------------------------------------------ */
function generateNotifications(leads: any[], invoices: any[]): AppNotification[] {
  const notifs: AppNotification[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let id = 1;
  const mkId = () => `notif-${id++}`;

  // Welcome notification
  notifs.push({
    id: mkId(), type: "system.welcome", priority: "medium",
    title: "Welcome to Yugam Lead Tracker!",
    message: "Your CRM workspace is ready. Start by adding leads or exploring the dashboard.",
    read: false, dismissed: false, createdAt: today,
  });

  // Lead notifications
  leads.forEach(l => {
    const name = l.leadName || l.name || "Unknown";
    const status = l.leadStatus || l.status || "New";

    if (status === "Won") {
      notifs.push({
        id: mkId(), type: "lead.won", priority: "high",
        title: `Deal Won: ${name}`,
        message: `Congratulations! ${l.companyName || l.company || ""} has been won with a deal value of ₹${(l.dealValue || 0).toLocaleString("en-IN")}.`,
        leadId: l.id, read: Math.random() > 0.5, dismissed: false,
        createdAt: l.createdAt || today,
        actionLabel: "View Lead",
      });
    }

    if (status === "Lost") {
      notifs.push({
        id: mkId(), type: "lead.lost", priority: "medium",
        title: `Lead Lost: ${name}`,
        message: `${name} at ${l.companyName || l.company || "N/A"} has been marked as lost. Consider re-engagement.`,
        leadId: l.id, read: Math.random() > 0.3, dismissed: false,
        createdAt: l.createdAt || today,
      });
    }

    // Overdue follow-ups
    if (l.nextFollowupDate && l.nextFollowupDate < today && l.leadStatus !== "Won" && l.leadStatus !== "Lost") {
      notifs.push({
        id: mkId(), type: "followup.overdue", priority: "high",
        title: `Overdue Follow-up: ${name}`,
        message: `Follow-up for ${name} was due on ${l.nextFollowupDate}. Take action now!`,
        leadId: l.id, read: false, dismissed: false,
        createdAt: l.nextFollowupDate,
        actionLabel: "Schedule",
      });
    }

    // Due today
    if (l.nextFollowupDate === today && l.leadStatus !== "Won" && l.leadStatus !== "Lost") {
      notifs.push({
        id: mkId(), type: "followup.due_today", priority: "medium",
        title: `Follow-up Today: ${name}`,
        message: `${name} has a follow-up scheduled for today. Don't forget!`,
        leadId: l.id, read: false, dismissed: false,
        createdAt: today,
      });
    }

    // New leads (created in last 3 days)
    const age = Math.floor((Date.now() - new Date(l.createdAt || today).getTime()) / 86400000);
    if (age <= 3 && status === "New") {
      notifs.push({
        id: mkId(), type: "lead.created", priority: "medium",
        title: `New Lead: ${name}`,
        message: `${name} from ${l.companyName || l.company || "N/A"} has been added via ${l.leadSource || l.source || "Unknown"}.`,
        leadId: l.id, read: age > 1, dismissed: false,
        createdAt: l.createdAt || today,
      });
    }
  });

  // Invoice notifications
  invoices.forEach(inv => {
    const client = inv.leadName || inv.clientName || inv.customerLegalName || "Client";
    const total = inv.totalAmount || inv.total || 0;
    const paid = inv.amountPaid || inv.paidAmount || 0;
    const invStatus = inv.status || "Draft";

    if (invStatus === "Paid") {
      notifs.push({
        id: mkId(), type: "invoice.paid", priority: "medium",
        title: `Payment Received: ${inv.invoiceNumber}`,
        message: `₹${total.toLocaleString("en-IN")} received from ${client}. Invoice fully paid.`,
        invoiceId: inv.id, read: true, dismissed: false,
        createdAt: inv.createdAt || today,
      });
    }

    if (invStatus === "Overdue" || (invStatus === "Issued" && inv.dueDate && inv.dueDate < today)) {
      notifs.push({
        id: mkId(), type: "invoice.overdue", priority: "urgent",
        title: `Invoice Overdue: ${inv.invoiceNumber}`,
        message: `Invoice ${inv.invoiceNumber} for ₹${total.toLocaleString("en-IN")} to ${client} is overdue. Outstanding: ₹${(total - paid).toLocaleString("en-IN")}.`,
        invoiceId: inv.id, read: false, dismissed: false,
        createdAt: inv.dueDate || inv.createdAt || today,
        actionLabel: "View Invoice",
      });
    }

    if (invStatus === "Issued" || invStatus === "Partially Paid") {
      notifs.push({
        id: mkId(), type: "invoice.created", priority: "low",
        title: `Invoice Issued: ${inv.invoiceNumber}`,
        message: `₹${total.toLocaleString("en-IN")} invoiced to ${client}. Paid: ₹${paid.toLocaleString("en-IN")}.`,
        invoiceId: inv.id, read: true, dismissed: false,
        createdAt: inv.issueDate || inv.createdAt || today,
      });
    }
  });

  // Target milestone
  const wonLeads = leads.filter(l => (l.leadStatus || l.status) === "Won");
  if (wonLeads.length > 0) {
    const totalWon = wonLeads.reduce((s, l) => s + (l.dealValue || 0), 0);
    notifs.push({
      id: mkId(), type: "target.milestone", priority: "high",
      title: `Revenue Milestone: ₹${(totalWon / 100000).toFixed(1)}L`,
      message: `You've reached ₹${(totalWon / 100000).toFixed(1)} Lakhs in won revenue across ${wonLeads.length} deals. Keep it up!`,
      read: false, dismissed: false, createdAt: today,
    });
  }

  // System notification
  notifs.push({
    id: mkId(), type: "system.update", priority: "low",
    title: "System Update Available",
    message: "A new version of the CRM is available with improved pipeline management and reporting features.",
    read: true, dismissed: false, createdAt: today,
  });

  // Sort by date descending, unread first
  return notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function NotificationCard({ notif, onMarkRead, onDismiss, onAction }: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (notif: AppNotification) => void;
}) {
  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG["system.update"];
  const priorityStyle = PRIORITY_STYLES[notif.priority] || PRIORITY_STYLES.low;

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 ${priorityStyle}
      ${!notif.read ? "ring-1 ring-brand-200" : ""} transition-all hover:shadow-md animate-fade-in`}>
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center text-lg flex-shrink-0`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`text-sm font-semibold ${notif.read ? "text-slate-600" : "text-slate-800"}`}>
                {notif.title}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notif.read && (
                <button onClick={() => onMarkRead(notif.id)}
                  className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center"
                  title="Mark as read">
                  <span className="w-2 h-2 bg-brand-500 rounded-full" />
                </button>
              )}
              <button onClick={() => onDismiss(notif.id)}
                className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
                title="Dismiss">
                ✕
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{notif.createdAt}</span>
              {notif.priority === "urgent" && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full font-medium">Urgent</span>
              )}
              {notif.priority === "high" && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-medium">High</span>
              )}
            </div>
            {notif.actionLabel && (
              <button onClick={() => onAction(notif)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700">
                {notif.actionLabel} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationSummary({ notifications }: { notifications: AppNotification[] }) {
  const unread = notifications.filter(n => !n.read && !n.dismissed).length;
  const urgent = notifications.filter(n => n.priority === "urgent" && !n.dismissed).length;
  const today = notifications.filter(n => n.createdAt === new Date().toISOString().slice(0, 10) && !n.dismissed).length;

  const typeBreakdown: Record<string, number> = {};
  notifications.filter(n => !n.dismissed).forEach(n => {
    const category = n.type.startsWith("lead") ? "Leads" :
      n.type.startsWith("followup") ? "Follow-ups" :
      n.type.startsWith("invoice") ? "Invoices" :
      n.type.startsWith("team") ? "Team" : "System";
    typeBreakdown[category] = (typeBreakdown[category] || 0) + 1;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Summary</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-brand-50 rounded-lg">
          <div className="text-2xl font-bold text-brand-600">{unread}</div>
          <div className="text-[10px] text-slate-500">Unread</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{urgent}</div>
          <div className="text-[10px] text-slate-500">Urgent</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{today}</div>
          <div className="text-[10px] text-slate-500">Today</div>
        </div>
      </div>
      <div className="space-y-2">
        {Object.entries(typeBreakdown).map(([cat, count]) => (
          <div key={cat} className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{cat}</span>
            <span className="font-semibold text-slate-800">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* MAIN NOTIFICATIONS VIEW                                            */
/* ================================================================== */
interface NotificationsViewProps {
  leads: Lead[];
  invoices: Invoice[];
  onNavigate?: (view: string, id?: string) => void;
}

export function NotificationsView({ leads, invoices, onNavigate }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    generateNotifications(leads, invoices)
  );
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotifications = useMemo(() => {
    let result = notifications.filter(n => !n.dismissed);

    // Filter by type
    if (filter === "unread") result = result.filter(n => !n.read);
    else if (filter === "leads") result = result.filter(n => n.type.startsWith("lead"));
    else if (filter === "followups") result = result.filter(n => n.type.startsWith("followup"));
    else if (filter === "invoices") result = result.filter(n => n.type.startsWith("invoice"));
    else if (filter === "system") result = result.filter(n => n.type.startsWith("system"));
    else if (filter === "team") result = result.filter(n => n.type.startsWith("team"));

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }

    return result;
  }, [notifications, filter, searchQuery]);

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissed: true })));
  }, []);

  const handleAction = useCallback((notif: AppNotification) => {
    markRead(notif.id);
    if (notif.leadId && onNavigate) onNavigate("leads", notif.leadId);
    else if (notif.invoiceId && onNavigate) onNavigate("invoices", notif.invoiceId);
  }, [markRead, onNavigate]);

  const filterCounts = useMemo(() => {
    const active = notifications.filter(n => !n.dismissed);
    return {
      all: active.length,
      unread: active.filter(n => !n.read).length,
      leads: active.filter(n => n.type.startsWith("lead")).length,
      followups: active.filter(n => n.type.startsWith("followup")).length,
      invoices: active.filter(n => n.type.startsWith("invoice")).length,
      system: active.filter(n => n.type.startsWith("system")).length,
      team: active.filter(n => n.type.startsWith("team")).length,
    };
  }, [notifications]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Notifications {unreadCount > 0 && <span className="text-brand-600">({unreadCount} unread)</span>}
          </h1>
          <p className="text-sm text-slate-500">Activity feed, alerts & reminders</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="px-3 py-1.5 text-xs font-medium border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50">
              ✓ Mark All Read
            </button>
          )}
          <button onClick={dismissAll}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            🗑️ Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar - Filters & Summary */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="relative">
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200" />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm space-y-0.5">
            {FILTER_CONFIG.map(f => (
              <button key={f.key}
                onClick={() => setFilter(f.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all
                  ${filter === f.key ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                <span className="flex items-center gap-2">
                  <span>{f.icon}</span> {f.label}
                </span>
                {(filterCounts[f.key] || 0) > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px]
                    ${filter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {filterCounts[f.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Summary */}
          <NotificationSummary notifications={notifications} />
        </div>

        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <div className="text-4xl mb-3 animate-float">📭</div>
              <h3 className="text-lg font-semibold text-slate-700">All caught up!</h3>
              <p className="text-sm text-slate-500 mt-1">
                {filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
              </p>
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 px-1">
                Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
              </div>
              {filteredNotifications.map(notif => (
                <NotificationCard
                  key={notif.id}
                  notif={notif}
                  onMarkRead={markRead}
                  onDismiss={dismiss}
                  onAction={handleAction}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
