// =====================================================================
// SHARED UI COMPONENTS — Toast, EmptyState, Skeleton, Modal, Badge
// =====================================================================
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

/* ================================================================== */
/* TOAST NOTIFICATION SYSTEM                                          */
/* ================================================================== */

type ToastType = "success" | "error" | "warning" | "info";
type Toast = { id: string; type: ToastType; message: string; duration?: number };

const ToastContext = createContext<{
  addToast: (type: ToastType, message: string, duration?: number) => void;
}>({ addToast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" style={{ maxWidth: 380 }}>
        {toasts.map((toast) => (
          <div key={toast.id}
            className={`animate-toast-in flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
              toast.type === "success" ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" :
              toast.type === "error" ? "border-rose-200 bg-rose-50/95 text-rose-800" :
              toast.type === "warning" ? "border-amber-200 bg-amber-50/95 text-amber-800" :
              "border-sky-200 bg-sky-50/95 text-sky-800"
            }`}>
            <span className="text-base mt-0.5">
              {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : "ℹ️"}
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ================================================================== */
/* EMPTY STATE COMPONENT                                              */
/* ================================================================== */

const EMPTY_STATE_CONFIGS: Record<string, { icon: string; title: string; description: string; action?: string }> = {
  leads: { icon: "👥", title: "No leads yet", description: "Start by adding your first lead or import from CSV.", action: "Add Lead" },
  pipeline: { icon: "🔄", title: "Pipeline is empty", description: "Add leads to see them organized in your pipeline stages." },
  followups: { icon: "📅", title: "No follow-ups pending", description: "All caught up! Set follow-up dates on your leads to see them here." },
  invoices: { icon: "🧾", title: "No invoices created", description: "Create your first invoice from a won lead." },
  revenue: { icon: "💰", title: "No revenue data", description: "Revenue data will appear as you close deals and create invoices." },
  users: { icon: "🏢", title: "No team members", description: "Invite team members to collaborate on leads." },
  sources: { icon: "📡", title: "No source data", description: "Source analytics will appear as you add leads with different sources." },
  search: { icon: "🔍", title: "No results found", description: "Try adjusting your search or filters." },
  tenants: { icon: "🏢", title: "No tenants", description: "Create your first tenant to get started." },
};

export function EmptyState({
  type,
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  type?: string;
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const config = type ? EMPTY_STATE_CONFIGS[type] ?? EMPTY_STATE_CONFIGS.search : undefined;
  const displayIcon = icon ?? config?.icon ?? "📭";
  const displayTitle = title ?? config?.title ?? "Nothing here";
  const displayDesc = description ?? config?.description ?? "";
  const displayAction = actionLabel ?? config?.action;

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
      <div className="animate-float text-6xl mb-4">{displayIcon}</div>
      <h3 className="text-lg font-semibold text-slate-700">{displayTitle}</h3>
      <p className="mt-1 max-w-xs text-center text-sm text-slate-400">{displayDesc}</p>
      {displayAction && onAction && (
        <button onClick={onAction}
          className="mt-4 rounded-xl bg-[#788023] px-4 py-2 text-sm font-medium text-white hover:bg-[#646b1d] transition-colors">
          {displayAction}
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/* SKELETON LOADING                                                   */
/* ================================================================== */

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} /></td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-8 w-1/3 rounded" />
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="skeleton h-5 w-5 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
      <div className="skeleton h-7 w-24 rounded" />
    </div>
  );
}

/* ================================================================== */
/* MODAL COMPONENT                                                    */
/* ================================================================== */

export function Modal({
  open, onClose, title, children, wide, className = "",
}: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode;
  wide?: boolean; className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        className={`animate-scale-in rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 ${wide ? "w-full max-w-3xl" : "w-full max-w-lg"} max-h-[90vh] flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">✕</button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* BADGE COMPONENT                                                    */
/* ================================================================== */

const BADGE_STYLES: Record<string, string> = {
  hot: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  warm: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  cold: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  won: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  lost: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  new: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  contacted: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  qualified: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
  proposal: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  negotiation: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  overdue: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  today: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  upcoming: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  done: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  active: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  suspended: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
};

export function Badge({ children, variant, className = "" }: {
  children: ReactNode; variant?: string; className?: string;
}) {
  const style = variant ? BADGE_STYLES[variant.toLowerCase()] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200" : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style} ${className}`}>
      {children}
    </span>
  );
}

/* ================================================================== */
/* CONFIRM DIALOG                                                     */
/* ================================================================== */

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = "Confirm", variant = "danger",
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string;
  variant?: "danger" | "warning" | "info";
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="animate-scale-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{variant === "danger" ? "🗑️" : variant === "warning" ? "⚠️" : "ℹ️"}</span>
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              variant === "danger" ? "bg-rose-600 hover:bg-rose-700" :
              variant === "warning" ? "bg-amber-600 hover:bg-amber-700" :
              "bg-[#788023] hover:bg-[#646b1d]"
            }`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ANIMATED COUNTER                                                   */
/* ================================================================== */

export function AnimatedValue({ value, format = (v) => String(v) }: {
  value: number; format?: (v: number) => string;
}) {
  const [displayed, setDisplayed] = useState(value);
  useEffect(() => {
    const start = displayed;
    const end = value;
    const diff = end - start;
    if (Math.abs(diff) < 1) { setDisplayed(end); return; }
    const duration = 500;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className="animate-count-up">{format(displayed)}</span>;
}

/* ================================================================== */
/* SPARKLINE (mini chart)                                             */
/* ================================================================== */

export function Sparkline({ data, width = 80, height = 24, color = "#788023" }: {
  data: number[]; width?: number; height?: number; color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* ================================================================== */
/* TREND INDICATOR                                                   */
/* ================================================================== */

export function TrendIndicator({ current, previous, suffix = "%" }: {
  current: number; previous: number; suffix?: string;
}) {
  if (previous === 0 && current === 0) return null;
  const diff = current - previous;
  const pctChange = previous > 0 ? (diff / previous) * 100 : current > 0 ? 100 : 0;
  const isUp = diff > 0;
  const isDown = diff < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : isDown ? "text-rose-600" : "text-slate-400"}`}>
      {isUp ? "↑" : isDown ? "↓" : "→"} {Math.abs(pctChange).toFixed(1)}{suffix}
    </span>
  );
}

/* ================================================================== */
/* LOADING SPINNER                                                    */
/* ================================================================== */

export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };
  return (
    <div className={`animate-spin rounded-full border-2 border-slate-200 border-t-[#788023] ${sizeClasses[size]} ${className}`} />
  );
}

/* ================================================================== */
/* TAB BAR                                                            */
/* ================================================================== */

export function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ key: T; label: string; count?: number; color?: string }>;
  active: T; onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            active === tab.key
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
          }`}>
          {tab.label}
          {tab.count !== undefined && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              active === tab.key ? "bg-slate-100 text-slate-600" : "bg-slate-200/60 text-slate-500"
            }`}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ================================================================== */
/* PROGRESS BAR                                                        */
/* ================================================================== */

export function ProgressBar({ value, max = 100, color = "bg-emerald-500", showLabel = false, size = "md" }: {
  value: number; max?: number; color?: string; showLabel?: boolean; size?: "sm" | "md" | "lg";
}) {
  const pct = Math.min((value / max) * 100, 100);
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  return (
    <div className="w-full">
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heights[size]}`}>
        <div className={`${heights[size]} ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <div className="text-[10px] text-slate-500 mt-1 text-right">{Math.round(pct)}%</div>}
    </div>
  );
}

/* ================================================================== */
/* BAR CHART (simple horizontal/vertical)                              */
/* ================================================================== */

export function SimpleBarChart({ data, orientation = "vertical", height = 160, showValues = true }: {
  data: Array<{ label: string; value: number; color?: string }>;
  orientation?: "vertical" | "horizontal";
  height?: number;
  showValues?: boolean;
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  if (orientation === "horizontal") {
    return (
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-slate-600 text-right truncate">{d.label}</span>
            <div className="flex-1 h-6 bg-slate-50 rounded-full overflow-hidden relative">
              <div className={`h-full ${d.color || "bg-brand-500"} rounded-full transition-all duration-700`}
                style={{ width: `${(d.value / maxVal) * 100}%` }} />
              {showValues && (
                <span className="absolute inset-0 flex items-center px-3 text-[10px] font-semibold text-slate-700">
                  {d.value.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full relative" style={{ height: `${height - 24}px` }}>
            <div className={`absolute bottom-0 w-full ${d.color || "bg-brand-500"} rounded-t transition-all duration-700`}
              style={{ height: `${(d.value / maxVal) * 100}%` }} />
          </div>
          <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* DONUT CHART (SVG)                                                   */
/* ================================================================== */

export function DonutChart({ segments, size = 120, strokeWidth = 20, centerLabel, centerValue }: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number; strokeWidth?: number;
  centerLabel?: string; centerValue?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const segLen = (seg.value / total) * circumference;
          const gap = 2;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${Math.max(segLen - gap, 0)} ${circumference - segLen + gap}`}
              strokeDashoffset={-offset} strokeLinecap="round" />
          );
          offset += segLen;
          return el;
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-bold text-slate-800">{centerValue}</span>}
          {centerLabel && <span className="text-[10px] text-slate-500">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* ENHANCED KPI CARD                                                   */
/* ================================================================== */

export function KPICard({ icon, label, value, subValue, trend, trendUp, color = "brand", sparkData }: {
  icon: string; label: string; value: string | number;
  subValue?: string; trend?: string; trendUp?: boolean;
  color?: string; sparkData?: number[];
}) {
  const bgColors: Record<string, string> = {
    brand: "bg-brand-50", blue: "bg-blue-50", emerald: "bg-emerald-50",
    amber: "bg-amber-50", rose: "bg-rose-50", violet: "bg-violet-50",
    cyan: "bg-cyan-50", indigo: "bg-indigo-50", slate: "bg-slate-50",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${bgColors[color] || bgColors.brand} flex items-center justify-center text-sm`}>
          {icon}
        </div>
        {sparkData && sparkData.length >= 2 && <Sparkline data={sparkData} width={60} height={20} />}
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-slate-500">{label}</span>
        {trend && (
          <span className={`text-[10px] font-medium ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      {subValue && <div className="text-[10px] text-slate-400 mt-0.5">{subValue}</div>}
    </div>
  );
}

/* ================================================================== */
/* SEARCH INPUT                                                        */
/* ================================================================== */

export function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all" />
    </div>
  );
}

/* ================================================================== */
/* PAGINATION                                                          */
/* ================================================================== */

export function Pagination({ page, totalPages, onPageChange, pageSize, totalItems }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
  pageSize: number; totalItems: number;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-xs text-slate-500">Showing {start}-{end} of {totalItems}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">← Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
          if (p < 1 || p > totalPages) return null;
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-7 h-7 text-xs rounded ${p === page ? "bg-brand-500 text-white" : "border border-slate-200 hover:bg-slate-50"}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">Next →</button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* SELECT FIELD                                                        */
/* ================================================================== */

export function SelectField({ value, onChange, options, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string; className?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white ${className}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

/* ================================================================== */
/* DRAWER (slide-in panel)                                             */
/* ================================================================== */

export function Drawer({ open, onClose, title, children, side = "right", width = "w-96" }: {
  open: boolean; onClose: () => void; title?: string;
  children: ReactNode; side?: "left" | "right"; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="modal-backdrop flex-1" onClick={onClose} />
      <aside className={`${width} h-full bg-white shadow-2xl flex flex-col ${side === "left" ? "animate-slide-in" : "animate-slide-in-right"}`}>
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* DATA TABLE WRAPPER                                                  */
/* ================================================================== */

export function DataTable({ columns, children, className = "" }: {
  columns: Array<{ label: string; className?: string; align?: "left" | "right" | "center" }>;
  children: ReactNode; className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            {columns.map((col, i) => (
              <th key={i} className={`px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap
                ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                ${col.className || ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/* STAT CARD (compact)                                                 */
/* ================================================================== */

export function StatCard({ icon, label, value, bgColor = "bg-white" }: {
  icon: string; label: string; value: string | number; bgColor?: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-3 text-center`}>
      <div className="text-xl font-bold text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{icon} {label}</div>
    </div>
  );
}
