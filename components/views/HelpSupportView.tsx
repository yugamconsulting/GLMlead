import { useState, useMemo } from 'react';

/* ─── Types ─── */
interface GuideArticle {
  id: string;
  title: string;
  category: string;
  icon: string;
  summary: string;
  steps: string[];
  tags: string[];
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: string;
  updatedAt: string;
  responses: { author: string; message: string; date: string }[];
}

interface FAQItem {
  q: string;
  a: string;
  category: string;
}

/* ─── Data ─── */
const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
  { id: 'leads', label: 'Managing Leads', icon: '👥' },
  { id: 'pipeline', label: 'Pipeline & Deals', icon: '📊' },
  { id: 'followups', label: 'Follow-ups', icon: '📞' },
  { id: 'invoices', label: 'Invoices & Billing', icon: '🧾' },
  { id: 'reports', label: 'Reports & Analytics', icon: '📈' },
  { id: 'settings', label: 'Settings & Config', icon: '⚙️' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧' },
];

const GUIDES: GuideArticle[] = [
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    category: 'getting-started',
    icon: '🚀',
    summary: 'Get up and running with LeadTracker in 5 minutes',
    steps: [
      'Log in with your credentials provided by your admin',
      'Familiarize yourself with the Dashboard — it shows your KPIs and pipeline at a glance',
      'Add your first lead using the "Add Lead" button or Smart Capture',
      'Move leads through the pipeline by dragging cards between stages',
      'Schedule follow-ups to stay on top of your leads',
      'Create invoices when deals are won to track revenue',
    ],
    tags: ['beginner', 'setup', 'onboarding'],
  },
  {
    id: 'smart-capture',
    title: 'Using Smart Capture',
    category: 'leads',
    icon: '🧠',
    summary: 'Extract contact info from business cards, emails, and WhatsApp messages',
    steps: [
      'Click the "Smart Capture" button in the Leads view',
      'Paste text from a business card, email signature, or WhatsApp message',
      'The system auto-detects names, phones, emails, companies, and websites',
      'Review the extracted fields and correct any mistakes',
      'Click "Add Lead" to create a new lead with the captured data',
      'The system checks for duplicate leads before creating',
    ],
    tags: ['ocr', 'capture', 'automation'],
  },
  {
    id: 'pipeline-management',
    title: 'Pipeline Management',
    category: 'pipeline',
    icon: '📊',
    summary: 'Move deals through stages and track your sales pipeline',
    steps: [
      'View all leads organized by pipeline stage in the Pipeline view',
      'Drag a lead card to move it to the next stage',
      'When moving to "Won", enter the deal value and win details',
      'When moving to "Lost", select the loss reason for analytics',
      'Use filters to focus on specific stages or team members',
      'Check the Analytics tab for pipeline velocity and conversion rates',
    ],
    tags: ['kanban', 'drag-drop', 'stages'],
  },
  {
    id: 'followup-best-practices',
    title: 'Follow-up Best Practices',
    category: 'followups',
    icon: '📞',
    summary: 'Never miss a follow-up and close more deals',
    steps: [
      'Check the Follow-ups view daily — overdue items are highlighted in red',
      'Set follow-up dates when creating or editing leads',
      'Use the queue tabs to prioritize: Overdue → Today → Upcoming',
      'Bulk-select follow-ups to snooze, mark done, or reassign',
      'Use templates for common follow-up messages (WhatsApp, Email)',
      'Set up auto-follow-up rules in Settings for new leads',
    ],
    tags: ['scheduling', 'templates', 'automation'],
  },
  {
    id: 'invoice-creation',
    title: 'Creating & Managing Invoices',
    category: 'invoices',
    icon: '🧾',
    summary: 'Generate GST-compliant invoices and track payments',
    steps: [
      'Navigate to Invoices view and click "Create Invoice"',
      'Select a client (Won lead) and add line items with quantities and rates',
      'GST is auto-calculated based on your company GST settings (CGST/SGST or IGST)',
      'Add adjustments, discounts, or notes as needed',
      'Send the invoice via email or WhatsApp using the Send button',
      'Record payments as they come in — partial payments are supported',
      'Track overdue invoices in the Dunning Board',
    ],
    tags: ['gst', 'billing', 'payments'],
  },
  {
    id: 'reports-dashboards',
    title: 'Reports & Dashboards',
    category: 'reports',
    icon: '📈',
    summary: 'Understand your sales performance with built-in reports',
    steps: [
      'The Dashboard shows real-time KPIs, pipeline funnel, and activity feed',
      'Use Reports for detailed breakdowns by source, team, and time period',
      'Analytics provides deep conversion funnel and revenue trend analysis',
      'Revenue view tracks monthly income, collection efficiency, and forecasts',
      'Export any report to CSV or JSON for further analysis',
      'Super Admins can view cross-tenant analytics and billing reports',
    ],
    tags: ['analytics', 'kpi', 'export'],
  },
  {
    id: 'team-management',
    title: 'Team & User Management',
    category: 'settings',
    icon: '👥',
    summary: 'Manage team members, roles, and permissions',
    steps: [
      'Go to Users view to see all team members',
      'Invite new members by clicking "Add Team Member"',
      'Assign roles: Owner, Admin, Manager, or User — each has different permissions',
      'Deactivate users who leave the team — their leads are reassigned',
      'Check Activity Log to see what actions each team member has taken',
      'Use Roles & Permissions tab to understand access levels',
    ],
    tags: ['roles', 'permissions', 'invite'],
  },
  {
    id: 'data-export',
    title: 'Exporting & Backing Up Data',
    category: 'settings',
    icon: '💾',
    summary: 'Export your data for backup or external analysis',
    steps: [
      'Go to Settings → Data tab for export options',
      'Export leads as CSV (compatible with Excel, Google Sheets)',
      'Export invoices as CSV for accounting integration',
      'Full JSON export preserves all data including relationships',
      'Use the Data Export view for advanced filtering before export',
      'Regularly back up your data — exports are generated locally',
    ],
    tags: ['backup', 'csv', 'json'],
  },
  {
    id: 'duplicate-leads',
    title: 'Handling Duplicate Leads',
    category: 'troubleshooting',
    icon: '🔍',
    summary: 'How the system detects and handles duplicate leads',
    steps: [
      'When adding a new lead, the system automatically checks for duplicates',
      'Exact phone or email matches show as "High confidence" duplicates',
      'Similar name+company combinations show as "Medium confidence"',
      'Review the duplicate panel before saving to decide: skip, merge, or create anyway',
      'Use the Merge tool in Lead Detail to combine duplicate records',
      'Regular deduplication keeps your database clean and accurate',
    ],
    tags: ['duplicates', 'merge', 'data-quality'],
  },
  {
    id: 'performance-tips',
    title: 'Performance Tips',
    category: 'troubleshooting',
    icon: '⚡',
    summary: 'Keep the app running smoothly with large datasets',
    steps: [
      'Use filters to narrow down large lead lists instead of scrolling',
      'Archive old won/lost leads to keep the active pipeline focused',
      'Clear browser cache if the app feels slow',
      'Use pagination (25 per page) for optimal table performance',
      'Export and delete old data you no longer need active access to',
      'Contact support if you experience persistent performance issues',
    ],
    tags: ['speed', 'optimization', 'large-data'],
  },
];

const FAQS: FAQItem[] = [
  { q: 'How do I reset my password?', a: 'Contact your admin to reset your password. Admins can go to Users → select your profile → Reset Password.', category: 'getting-started' },
  { q: 'Can I import leads from a spreadsheet?', a: 'Yes! Go to Leads → Import CSV. Upload your CSV file and map columns to lead fields. The system will preview and validate before importing.', category: 'leads' },
  { q: 'How is GST calculated on invoices?', a: 'GST is auto-calculated based on your company state and client state. Same state: CGST+SGST (9%+9%). Different state: IGST (18%). Configure rates in Settings → Invoicing.', category: 'invoices' },
  { q: 'Can I customize the pipeline stages?', a: 'Pipeline stages are standardized for consistent reporting across the team. Contact your admin if you need custom stages.', category: 'pipeline' },
  { q: 'What happens when I mark a lead as "Won"?', a: 'The lead moves to Won status, you can enter deal value and win details, and the revenue appears in Dashboard and Reports. You can then create an invoice for the deal.', category: 'pipeline' },
  { q: 'How do I record a partial payment?', a: 'Open the invoice detail, go to Payments tab, click "Record Payment" and enter the amount. Partial payments update the invoice status to "Partially Paid".', category: 'invoices' },
  { q: 'What is the Dunning Board?', a: 'The Dunning Board tracks overdue invoices grouped by aging period (D1-D3, D4-D7, D8-D15, D15+). It helps you prioritize collection follow-ups.', category: 'invoices' },
  { q: 'How do Smart Capture and duplicate detection work?', a: 'Smart Capture extracts contact info from pasted text using pattern matching. Duplicate detection compares phone, email, and name against existing leads using Jaro-Winkler similarity.', category: 'leads' },
  { q: 'Can I export reports?', a: 'Yes — all report views have CSV and JSON export buttons. Go to Settings → Data for bulk export options.', category: 'reports' },
  { q: 'How do I manage team permissions?', a: 'Go to Users → Roles & Permissions tab to see the permission matrix. Owner and Admin can change roles. Four roles: Owner, Admin, Manager, User.', category: 'settings' },
  { q: 'Is my data secure?', a: 'All data is stored locally in your browser (localStorage) during this demo. Production deployments use encrypted cloud storage with role-based access control.', category: 'getting-started' },
  { q: 'How do I contact support?', a: 'Use the Support tab to create a support ticket, or email support@oruyugam.com directly. Critical issues are prioritized within 4 hours.', category: 'troubleshooting' },
];

const DEMO_TICKETS: SupportTicket[] = [
  {
    id: 'TK-001',
    subject: 'Cannot export CSV with special characters',
    description: 'When exporting leads with special characters in company name (e.g., M&N Solutions), the CSV file has encoding issues.',
    status: 'resolved',
    priority: 'medium',
    category: 'Data Export',
    createdAt: '2025-01-10T10:30:00',
    updatedAt: '2025-01-11T14:00:00',
    responses: [
      { author: 'Support Team', message: 'We\'ve fixed the CSV encoding issue. All exports now use UTF-8 with BOM for Excel compatibility.', date: '2025-01-11T14:00:00' },
    ],
  },
  {
    id: 'TK-002',
    subject: 'Follow-up reminders not showing',
    description: 'Overdue follow-ups are not highlighted on the dashboard after the latest update.',
    status: 'in-progress',
    priority: 'high',
    category: 'Follow-ups',
    createdAt: '2025-01-15T09:00:00',
    updatedAt: '2025-01-15T16:30:00',
    responses: [
      { author: 'Support Team', message: 'We\'re investigating the follow-up highlighting issue. A fix is expected in the next release.', date: '2025-01-15T16:30:00' },
    ],
  },
];

/* ─── Sub-Components ─── */

function GuideCard({ guide, onClick }: { guide: GuideArticle; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:shadow-md hover:border-brand-200 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{guide.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 group-hover:text-brand-700 transition-colors">{guide.title}</h4>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{guide.summary}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {guide.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function GuideDetail({ guide, onBack }: { guide: GuideArticle; onBack: () => void }) {
  return (
    <div className="animate-fade-in-up">
      <button onClick={onBack} className="text-sm text-brand-600 hover:text-brand-700 mb-4 flex items-center gap-1">
        ← Back to Guides
      </button>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{guide.icon}</span>
          <div>
            <h3 className="text-xl font-bold text-slate-800">{guide.title}</h3>
            <p className="text-sm text-slate-500">{guide.summary}</p>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h4 className="font-semibold text-slate-700 mb-3">Step-by-step Instructions</h4>
          <ol className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </span>
                <span className="text-slate-600 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-400 mr-1">Tags:</span>
          {guide.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TicketStatusBadge({ status }: { status: SupportTicket['status'] }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    'in-progress': 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-600',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.open}`}>{status.replace('-', ' ')}</span>;
}

function PriorityBadge({ priority }: { priority: SupportTicket['priority'] }) {
  const styles: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  const icons: Record<string, string> = { low: '○', medium: '◐', high: '●', urgent: '⬤' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[priority]}`}>{icons[priority]} {priority}</span>;
}

/* ─── Main Component ─── */
export default function HelpSupportView() {
  const [tab, setTab] = useState<'guides' | 'faq' | 'tickets' | 'shortcuts'>('guides');
  const [selectedGuide, setSelectedGuide] = useState<GuideArticle | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [faqSearch, setFaqSearch] = useState('');
  const [tickets, setTickets] = useState<SupportTicket[]>(DEMO_TICKETS);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState<{ subject: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent'; category: string }>({ subject: '', description: '', priority: 'medium', category: 'General' });
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const filteredGuides = useMemo(() => {
    let guides = GUIDES;
    if (categoryFilter !== 'all') guides = guides.filter(g => g.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      guides = guides.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.tags.some(t => t.includes(q))
      );
    }
    return guides;
  }, [categoryFilter, searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return FAQS;
    const q = faqSearch.toLowerCase();
    return FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [faqSearch]);

  const handleCreateTicket = () => {
    if (!newTicket.subject.trim()) return;
    const ticket: SupportTicket = {
      id: `TK-${String(tickets.length + 1).padStart(3, '0')}`,
      subject: newTicket.subject,
      description: newTicket.description,
      status: 'open',
      priority: newTicket.priority,
      category: newTicket.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      responses: [],
    };
    setTickets(prev => [ticket, ...prev]);
    setNewTicket({ subject: '', description: '', priority: 'medium', category: 'General' });
    setShowNewTicket(false);
  };

  /* ─── Keyboard Shortcuts Reference ─── */
  const SHORTCUTS = [
    { keys: ['G', 'D'], action: 'Go to Dashboard', category: 'Navigation' },
    { keys: ['G', 'L'], action: 'Go to Leads', category: 'Navigation' },
    { keys: ['G', 'P'], action: 'Go to Pipeline', category: 'Navigation' },
    { keys: ['G', 'F'], action: 'Go to Follow-ups', category: 'Navigation' },
    { keys: ['G', 'I'], action: 'Go to Invoices', category: 'Navigation' },
    { keys: ['G', 'R'], action: 'Go to Revenue', category: 'Navigation' },
    { keys: ['G', 'A'], action: 'Go to Analytics', category: 'Navigation' },
    { keys: ['/', '/'], action: 'Search leads', category: 'Actions' },
    { keys: ['N'], action: 'New lead (in Leads view)', category: 'Actions' },
    { keys: ['Esc'], action: 'Close modal / Go back', category: 'Actions' },
    { keys: ['?'], action: 'Show keyboard shortcuts', category: 'Actions' },
    { keys: ['Ctrl/Cmd', 'E'], action: 'Export current view', category: 'Actions' },
  ];

  const shortcutCategories = useMemo(() => {
    const cats: Record<string, typeof SHORTCUTS> = {};
    SHORTCUTS.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    return cats;
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Help & Support</h2>
          <p className="text-sm text-slate-500 mt-1">Guides, FAQs, and support for LeadTracker</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border">v2.4.1</span>
          <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">● All systems operational</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['guides', 'faq', 'tickets', 'shortcuts'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedGuide(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white shadow text-brand-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'guides' ? '📖 Guides' : t === 'faq' ? '❓ FAQ' : t === 'tickets' ? '🎫 Tickets' : '⌨️ Shortcuts'}
          </button>
        ))}
      </div>

      {/* ─── GUIDES TAB ─── */}
      {tab === 'guides' && (
        selectedGuide ? (
          <GuideDetail guide={selectedGuide} onBack={() => setSelectedGuide(null)} />
        ) : (
          <div className="space-y-4">
            {/* Search & Filter */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Category Quick Links */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const count = GUIDES.filter(g => g.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      categoryFilter === cat.id
                        ? 'bg-brand-100 border-brand-300 text-brand-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-600'
                    }`}
                  >
                    {cat.icon} {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Guide Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGuides.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-slate-400">
                  <span className="text-4xl block mb-3">🔍</span>
                  No guides found. Try a different search or category.
                </div>
              ) : (
                filteredGuides.map(guide => (
                  <GuideCard key={guide.id} guide={guide} onClick={() => setSelectedGuide(guide)} />
                ))
              )}
            </div>
          </div>
        )
      )}

      {/* ─── FAQ TAB ─── */}
      {tab === 'faq' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search frequently asked questions..."
            value={faqSearch}
            onChange={e => setFaqSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          <div className="space-y-2">
            {filteredFaqs.map((faq, i) => {
              const id = `${faq.q}-${i}`;
              const isExpanded = expandedFaq === id;
              return (
                <div key={id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(isExpanded ? null : id)}
                    className="w-full px-5 py-3.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-700 text-sm">{faq.q}</span>
                    <span className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 animate-fade-in-up">
                      <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                      <span className="inline-block text-xs text-slate-400 mt-2 px-2 py-0.5 bg-slate-50 rounded">{faq.category}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <span className="text-4xl block mb-3">❓</span>
                No matching questions found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TICKETS TAB ─── */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Manage support tickets and track issue resolution</p>
            <button
              onClick={() => setShowNewTicket(true)}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              + New Ticket
            </button>
          </div>

          {/* Tickets List */}
          <div className="space-y-3">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-mono text-slate-400">{ticket.id}</span>
                    <span className="font-medium text-slate-700 text-sm truncate">{ticket.subject}</span>
                    <div className="flex gap-2 flex-shrink-0">
                      <TicketStatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                  </div>
                  <span className={`text-slate-400 text-xs ml-3 transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {expandedTicket === ticket.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-slate-100 animate-fade-in-up">
                    <p className="text-sm text-slate-600 mt-3">{ticket.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                      <span>Updated: {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 bg-slate-50 rounded">{ticket.category}</span>
                    </div>
                    {ticket.responses.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Responses</h5>
                        {ticket.responses.map((resp, i) => (
                          <div key={i} className="bg-brand-50 border border-brand-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-brand-700">{resp.author}</span>
                              <span className="text-xs text-slate-400">{new Date(resp.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-slate-600">{resp.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Quick Reply */}
                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a reply..."
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget;
                            if (!input.value.trim()) return;
                            setTickets(prev => prev.map(t =>
                              t.id === ticket.id
                                ? {
                                    ...t,
                                    status: 'in-progress' as const,
                                    updatedAt: new Date().toISOString(),
                                    responses: [...t.responses, { author: 'You', message: input.value, date: new Date().toISOString() }],
                                  }
                                : t
                            ));
                            input.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          setTickets(prev => prev.map(t =>
                            t.id === ticket.id ? { ...t, status: 'resolved' as const, updatedAt: new Date().toISOString() } : t
                          ));
                        }}
                        className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                      >
                        ✓ Resolve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New Ticket Modal */}
          {showNewTicket && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop" onClick={() => setShowNewTicket(false)}>
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Create Support Ticket</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Subject *"
                    value={newTicket.subject}
                    onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                  <textarea
                    placeholder="Describe your issue in detail..."
                    value={newTicket.description}
                    onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  />
                  <div className="flex gap-3">
                    <select
                      value={newTicket.priority}
                      onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value as SupportTicket['priority'] }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <select
                      value={newTicket.category}
                      onChange={e => setNewTicket(p => ({ ...p, category: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                      {['General', 'Data Export', 'Follow-ups', 'Invoices', 'Pipeline', 'Performance', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowNewTicket(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                    <button
                      onClick={handleCreateTicket}
                      disabled={!newTicket.subject.trim()}
                      className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      Submit Ticket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SHORTCUTS TAB ─── */}
      {tab === 'shortcuts' && (
        <div className="space-y-6">
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
            <p className="text-sm text-brand-700">
              <span className="font-semibold">💡 Tip:</span> Press <kbd className="px-1.5 py-0.5 bg-white rounded border border-brand-200 text-xs font-mono">?</kbd> anywhere to show keyboard shortcuts.
            </p>
          </div>
          {Object.entries(shortcutCategories).map(([category, shortcuts]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{category}</h4>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {shortcuts.map(shortcut => (
                  <div key={shortcut.action} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-700">{shortcut.action}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && <span className="text-slate-300 text-xs">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="font-semibold text-slate-700 mb-2">Custom Shortcuts</h4>
            <p className="text-sm text-slate-500">
              Custom keyboard shortcuts can be configured in Settings → General → Keyboard Shortcuts.
              Contact your admin for organization-wide shortcut configurations.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <a href="mailto:support@oruyugam.com" className="text-sm text-brand-600 hover:text-brand-700">📧 support@oruyugam.com</a>
          <span className="text-sm text-slate-400">|</span>
          <a href="#" className="text-sm text-brand-600 hover:text-brand-700">📄 Documentation</a>
          <span className="text-sm text-slate-400">|</span>
          <a href="#" className="text-sm text-brand-600 hover:text-brand-700">🎥 Video Tutorials</a>
        </div>
        <p className="text-xs text-slate-400">© 2025 Yugam Consulting. All rights reserved.</p>
      </div>
    </div>
  );
}
