import { useState, useMemo } from 'react';
import type { Lead, Invoice } from '../../types';

/* ─── Types ─── */
type ExportFormat = 'csv' | 'json' | 'xlsx';
type DataScope = 'leads' | 'invoices' | 'followups' | 'revenue' | 'full';

interface ExportPreset {
  id: string;
  label: string;
  description: string;
  scope: DataScope;
  icon: string;
}

interface ExportHistoryEntry {
  id: string;
  name: string;
  format: ExportFormat;
  scope: DataScope;
  recordCount: number;
  exportedAt: string;
  size: string;
}

/* ─── Constants ─── */
const PRESETS: ExportPreset[] = [
  { id: 'all-leads', label: 'All Leads', description: 'Export all leads with full contact details, status, and scores', scope: 'leads', icon: '👥' },
  { id: 'open-leads', label: 'Open Leads Only', description: 'Export only active/open leads (excludes Won and Lost)', scope: 'leads', icon: '🟢' },
  { id: 'won-leads', label: 'Won Deals', description: 'Export won deals with deal values and close dates', scope: 'leads', icon: '🏆' },
  { id: 'pipeline', label: 'Pipeline Snapshot', description: 'Current pipeline by stage with weighted forecast values', scope: 'leads', icon: '📊' },
  { id: 'all-invoices', label: 'All Invoices', description: 'Export all invoices with line items, GST, and payment status', scope: 'invoices', icon: '🧾' },
  { id: 'overdue-invoices', label: 'Overdue Invoices', description: 'Export only overdue invoices with aging details', scope: 'invoices', icon: '⚠️' },
  { id: 'followups-due', label: 'Follow-ups Due', description: 'Export upcoming and overdue follow-ups', scope: 'followups', icon: '📞' },
  { id: 'revenue-summary', label: 'Revenue Summary', description: 'Monthly revenue breakdown with collection data', scope: 'revenue', icon: '💰' },
  { id: 'full-backup', label: 'Full Data Backup', description: 'Complete backup of all data including settings and team', scope: 'full', icon: '💾' },
];

const DEMO_HISTORY: ExportHistoryEntry[] = [
  { id: '1', name: 'All Leads Export', format: 'csv', scope: 'leads', recordCount: 156, exportedAt: '2025-01-15T10:30:00', size: '48 KB' },
  { id: '2', name: 'Monthly Invoice Report', format: 'csv', scope: 'invoices', recordCount: 42, exportedAt: '2025-01-14T16:00:00', size: '22 KB' },
  { id: '3', name: 'Full Backup', format: 'json', scope: 'full', recordCount: 234, exportedAt: '2025-01-10T09:00:00', size: '156 KB' },
  { id: '4', name: 'Won Deals Q4', format: 'csv', scope: 'leads', recordCount: 28, exportedAt: '2025-01-05T11:15:00', size: '12 KB' },
];

/* ─── Utility Functions ─── */
function escapeCSV(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function leadsToCSV(leads: Lead[]): string {
  const headers = ['Name', 'Company', 'Email', 'Phone', 'Source', 'Status', 'Temperature', 'Deal Value', 'Expected Close', 'Assigned To', 'Created'];
  const rows = leads.map(l => [
    l.leadName, l.companyName, l.emailId, l.phoneNumber, l.leadSource, l.leadStatus, l.leadTemperature,
    l.dealValue ?? '', l.expectedClosingDate ?? '', l.assignedTo ?? '', l.createdAt,
  ].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function invoicesToCSV(invoices: Invoice[]): string {
  const headers = ['Invoice #', 'Client', 'Status', 'Issue Date', 'Due Date', 'Subtotal', 'GST', 'Total', 'Paid', 'Outstanding'];
  const rows = invoices.map(inv => [
    inv.invoiceNumber, inv.leadName, inv.status, inv.issueDate, inv.dueDate,
    inv.subtotal, (inv.cgstAmount + inv.sgstAmount + inv.igstAmount), inv.totalAmount, inv.amountPaid, inv.totalAmount - inv.amountPaid,
  ].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── Filter Panel ─── */
interface FilterState {
  status: string[];
  sources: string[];
  temperature: string[];
  dateFrom: string;
  dateTo: string;
  assignedTo: string[];
}

function FilterPanel({ filters, onChange, leads }: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  leads: Lead[];
}) {
  const toggle = (field: 'status' | 'sources' | 'temperature' | 'assignedTo', value: string) => {
    const arr = filters[field] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filters, [field]: next });
  };

  const statuses = useMemo(() => [...new Set(leads.map(l => l.leadStatus))].sort(), [leads]);
  const sources = useMemo(() => [...new Set(leads.map(l => l.leadSource))].sort(), [leads]);
  const assignees = useMemo(() => [...new Set(leads.map(l => l.assignedTo).filter(Boolean) as string[])].sort(), [leads]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h4 className="text-sm font-semibold text-slate-700">Filter Data</h4>

      {/* Date Range */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Date Range</label>
        <div className="flex gap-2">
          <input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500" />
          <span className="text-slate-400 self-center text-xs">to</span>
          <input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500" />
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Status ({filters.status.length ? filters.status.length : 'All'})</label>
        <div className="flex flex-wrap gap-1">
          {statuses.map(s => (
            <button key={s} onClick={() => toggle('status', s)}
              className={`text-xs px-2 py-1 rounded-full border transition-all ${
                filters.status.includes(s) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Source ({filters.sources.length ? filters.sources.length : 'All'})</label>
        <div className="flex flex-wrap gap-1">
          {sources.map(s => (
            <button key={s} onClick={() => toggle('sources', s)}
              className={`text-xs px-2 py-1 rounded-full border transition-all ${
                filters.sources.includes(s) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Temperature ({filters.temperature.length ? filters.temperature.length : 'All'})</label>
        <div className="flex gap-1">
          {['Hot', 'Warm', 'Cold'].map(t => (
            <button key={t} onClick={() => toggle('temperature', t)}
              className={`text-xs px-2 py-1 rounded-full border transition-all ${
                filters.temperature.includes(t) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      {assignees.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1.5">Assigned To ({filters.assignedTo.length ? filters.assignedTo.length : 'All'})</label>
          <div className="flex flex-wrap gap-1">
            {assignees.map(a => (
              <button key={a} onClick={() => toggle('assignedTo', a)}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  filters.assignedTo.includes(a) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>{a}</button>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => onChange({ status: [], sources: [], temperature: [], dateFrom: '', dateTo: '', assignedTo: [] })}
        className="text-xs text-brand-600 hover:text-brand-700">Reset Filters</button>
    </div>
  );
}

/* ─── Preview Table ─── */
function PreviewTable({ data, scope }: { data: Lead[] | Invoice[]; scope: DataScope }) {
  const isLeads = scope === 'leads' || scope === 'followups';
  const items = data.slice(0, 10);

  if (isLeads) {
    const leads = items as Lead[];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Company</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Source</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Temp</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">Deal Value</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 text-slate-700">{l.leadName}</td>
                <td className="px-3 py-1.5 text-slate-600">{l.companyName}</td>
                <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${
                  l.leadStatus === 'Won' ? 'bg-green-100 text-green-700' :
                  l.leadStatus === 'Lost' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{l.leadStatus}</span></td>
                <td className="px-3 py-1.5 text-slate-600">{l.leadSource}</td>
                <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${
                  l.leadTemperature === 'Hot' ? 'bg-red-100 text-red-700' :
                  l.leadTemperature === 'Warm' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{l.leadTemperature}</span></td>
                <td className="px-3 py-1.5 text-right text-slate-600">₹{(l.dealValue ?? 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 10 && (
          <p className="text-xs text-slate-400 text-center py-2">Showing 10 of {data.length} records</p>
        )}
      </div>
    );
  }

  const invoices = items as Invoice[];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Invoice #</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Client</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Issue Date</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">Total</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">Paid</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-1.5 text-slate-700 font-mono">{inv.invoiceNumber}</td>
              <td className="px-3 py-1.5 text-slate-600">{inv.leadName}</td>
              <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${
                inv.status === 'Paid' ? 'bg-green-100 text-green-700' :
                inv.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>{inv.status}</span></td>
              <td className="px-3 py-1.5 text-slate-600">{inv.issueDate}</td>
              <td className="px-3 py-1.5 text-right text-slate-600">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
              <td className="px-3 py-1.5 text-right text-slate-600">₹{inv.amountPaid.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <p className="text-xs text-slate-400 text-center py-2">Showing 10 of {data.length} records</p>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
interface Props {
  leads?: Lead[];
  invoices?: Invoice[];
}

export default function DataExportView({ leads = [], invoices = [] }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<DataScope>('leads');
  const [showFilters, setShowFilters] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ status: [], sources: [], temperature: [], dateFrom: '', dateTo: '', assignedTo: [] });
  const [history, setHistory] = useState<ExportHistoryEntry[]>(DEMO_HISTORY);
  const [tab, setTab] = useState<'export' | 'history' | 'scheduled'>('export');

  /* Apply filters */
  const filteredData = useMemo(() => {
    if (scope === 'invoices' || scope === 'revenue') {
      let inv = [...invoices];
      if (filters.dateFrom) inv = inv.filter(i => i.issueDate >= filters.dateFrom);
      if (filters.dateTo) inv = inv.filter(i => i.issueDate <= filters.dateTo);
      return inv;
    }

    let l = [...leads];
    if (filters.status.length) l = l.filter(x => filters.status.includes(x.leadStatus));
    if (filters.sources.length) l = l.filter(x => filters.sources.includes(x.leadSource));
    if (filters.temperature.length) l = l.filter(x => filters.temperature.includes(x.leadTemperature));
    if (filters.assignedTo.length) l = l.filter(x => x.assignedTo && filters.assignedTo.includes(x.assignedTo));
    if (filters.dateFrom) l = l.filter(x => x.createdAt >= filters.dateFrom);
    if (filters.dateTo) l = l.filter(x => x.createdAt <= filters.dateTo);
    return l;
  }, [scope, leads, invoices, filters]);

  const handleExport = () => {
    let content = '';
    let filename = '';
    const mimeTypes: Record<ExportFormat, string> = {
      csv: 'text/csv;charset=utf-8;',
      json: 'application/json;charset=utf-8;',
      xlsx: 'text/csv;charset=utf-8;', // fallback to CSV for xlsx
    };

    if (scope === 'full') {
      const data = { leads, invoices, exportedAt: new Date().toISOString(), version: '2.4.1' };
      content = JSON.stringify(data, null, 2);
      filename = `leadtracker-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    } else if (format === 'json') {
      content = JSON.stringify(filteredData, null, 2);
      filename = `leadtracker-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
    } else if (scope === 'invoices' || scope === 'revenue') {
      content = invoicesToCSV(filteredData as Invoice[]);
      filename = `leadtracker-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      content = leadsToCSV(filteredData as Lead[]);
      filename = `leadtracker-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    }

    downloadFile(content, filename, mimeTypes[format]);

    // Add to history
    const entry: ExportHistoryEntry = {
      id: String(Date.now()),
      name: PRESETS.find(p => p.id === selectedPreset)?.label ?? `Custom ${scope} export`,
      format,
      scope,
      recordCount: filteredData.length,
      exportedAt: new Date().toISOString(),
      size: `${(content.length / 1024).toFixed(1)} KB`,
    };
    setHistory(prev => [entry, ...prev]);
  };

  const handlePresetSelect = (preset: ExportPreset) => {
    setSelectedPreset(preset.id);
    setScope(preset.scope);
    setFilters({ status: [], sources: [], temperature: [], dateFrom: '', dateTo: '', assignedTo: [] });
    setShowPreview(true);

    // Auto-set filters based on preset
    if (preset.id === 'open-leads') {
      setFilters(f => ({ ...f, status: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Confirmation', 'Invoice Sent'] }));
    } else if (preset.id === 'won-leads') {
      setFilters(f => ({ ...f, status: ['Won'] }));
    } else if (preset.id === 'overdue-invoices') {
      setFilters(f => ({ ...f, status: ['Issued', 'Partially Paid'] }));
    }
  };

  const formatIcon: Record<ExportFormat, string> = { csv: '📄', json: '📦', xlsx: '📊' };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Data Export Center</h2>
        <p className="text-sm text-slate-500 mt-1">Export and backup your CRM data in multiple formats</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['export', 'history', 'scheduled'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white shadow text-brand-700' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'export' ? '📤 Export' : t === 'history' ? '📜 History' : '⏰ Scheduled'}
          </button>
        ))}
      </div>

      {/* ─── EXPORT TAB ─── */}
      {tab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Presets */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Quick Export Presets</h3>
            <div className="space-y-2">
              {PRESETS.map(preset => (
                <button key={preset.id} onClick={() => handlePresetSelect(preset)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedPreset === preset.id
                      ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-200'
                      : 'bg-white border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{preset.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{preset.label}</div>
                      <div className="text-xs text-slate-400 line-clamp-1">{preset.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Config + Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Format Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Export Format</h4>
              <div className="flex gap-3">
                {(['csv', 'json', 'xlsx'] as ExportFormat[]).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      format === f ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-200' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}>
                    <span className="text-2xl block mb-1">{formatIcon[f]}</span>
                    <span className="text-sm font-medium text-slate-700 block">{f.toUpperCase()}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {f === 'csv' ? 'Excel compatible' : f === 'json' ? 'Full structure' : 'Spreadsheet'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Data Scope</h4>
              <div className="flex flex-wrap gap-2">
                {(['leads', 'invoices', 'followups', 'revenue', 'full'] as DataScope[]).map(s => (
                  <button key={s} onClick={() => setScope(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      scope === s ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {s === 'leads' ? '👥 Leads' : s === 'invoices' ? '🧾 Invoices' : s === 'followups' ? '📞 Follow-ups' : s === 'revenue' ? '💰 Revenue' : '💾 Full Backup'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="flex gap-3">
              <button onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  showFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                🔍 {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <button onClick={() => setShowPreview(!showPreview)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  showPreview ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                👁️ {showPreview ? 'Hide Preview' : 'Preview Data'}
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <FilterPanel filters={filters} onChange={setFilters} leads={leads} />
            )}

            {/* Preview */}
            {showPreview && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Preview ({filteredData.length} records)</h4>
                  <span className="text-xs text-slate-400">{format.toUpperCase()} format</span>
                </div>
                <PreviewTable data={filteredData} scope={scope} />
              </div>
            )}

            {/* Export Button */}
            <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl p-4">
              <div>
                <p className="text-sm font-medium text-brand-700">
                  {filteredData.length} records will be exported as {format.toUpperCase()}
                </p>
                <p className="text-xs text-brand-500 mt-0.5">
                  {scope === 'full' ? 'Complete backup including all data' : `Filtered ${scope} data`}
                </p>
              </div>
              <button onClick={handleExport}
                className="px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm">
                ⬇️ Export Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Recent export history</p>
            {history.length > 0 && (
              <button onClick={() => setHistory([])} className="text-xs text-red-500 hover:text-red-600">Clear History</button>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Export Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Format</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Scope</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Records</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Size</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{entry.name}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-slate-100 rounded font-mono">{entry.format.toUpperCase()}</span></td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{entry.scope}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{entry.recordCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{entry.size}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(entry.exportedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No export history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SCHEDULED TAB ─── */}
      {tab === 'scheduled' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Schedule automatic exports</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">
              <span className="font-semibold">⚡ Coming Soon:</span> Scheduled exports allow you to automatically generate and email reports on a daily, weekly, or monthly basis.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-2">📅 Daily Lead Report</h4>
              <p className="text-sm text-slate-500 mb-3">Receive a daily CSV of new leads and updated statuses at 9:00 AM</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Not configured</span>
                <button className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-colors">Set Up</button>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-2">📊 Weekly Revenue Summary</h4>
              <p className="text-sm text-slate-500 mb-3">Get a weekly revenue report with collection status every Monday</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Not configured</span>
                <button className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-colors">Set Up</button>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-2">🧾 Monthly Invoice Backup</h4>
              <p className="text-sm text-slate-500 mb-3">Full JSON backup of all invoices and payments on the 1st of each month</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Not configured</span>
                <button className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-colors">Set Up</button>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-2">💾 Full Data Backup</h4>
              <p className="text-sm text-slate-500 mb-3">Complete system backup including all data, settings, and team config</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Not configured</span>
                <button className="text-xs px-3 py-1.5 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-colors">Set Up</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
