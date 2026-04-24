// =====================================================================
// FEATURES PAGE — All 12 feature cards with detailed descriptions
// =====================================================================

import { FadeIn, FeatureCard, PageHero, CtaBanner } from "./SiteLayout";

export default function FeaturesPage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <PageHero
        icon="⚡"
        badge="Complete Feature Set"
        title="Everything You Need to"
        highlight="Close Deals"
        desc="A field-ready CRM with 17 powerful modules, built specifically for Indian sales teams managing leads, pipeline, invoicing, and team performance."
      />

      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FadeIn delay={0}>
              <FeatureCard icon="🎯" title="Lead Management"
                desc="Capture, organize, and track every lead from first touch to close. Never lose a prospect again."
                highlights={["CSV Import/Export with smart column mapping", "Duplicate detection with fuzzy matching", "Lead health scoring & SLA tracking", "Smart Capture OCR — paste text → auto-fill", "Batch operations: status, temperature, assign"]} />
            </FadeIn>
            <FadeIn delay={50}>
              <FeatureCard icon="📊" title="Pipeline Board"
                desc="Visual Kanban board with drag-and-drop stage management. See your entire pipeline at a glance."
                highlights={["9 pipeline stages with WIP limits", "Priority scoring & neglect risk alerts", "Drag leads to Won/Lost with reason tracking", "Stage velocity & conversion analytics", "Batch stage change & audit trail"]} />
            </FadeIn>
            <FadeIn delay={100}>
              <FeatureCard icon="⏰" title="Follow-up Engine"
                desc="Automated follow-up queues ensure no lead goes cold. Smart scheduling with templates."
                highlights={["5 smart queues: Overdue, Today, Upcoming, No Date, Done", "Auto-follow-up rules engine", "Calendar view with monthly navigation", "Recurring follow-up templates", "Daily digest with streak tracking"]} />
            </FadeIn>
            <FadeIn delay={150}>
              <FeatureCard icon="🧾" title="Invoicing & GST"
                desc="Create professional invoices with automatic GST calculations. Track payments and send reminders."
                highlights={["CGST/SGST/IGST auto-calculation", "Dunning board with 4 escalation stages", "Client master with outstanding tracking", "Credit notes & adjustments", "Print-ready invoice layouts"]} />
            </FadeIn>
            <FadeIn delay={200}>
              <FeatureCard icon="📈" title="Revenue Tracking"
                desc="Monthly revenue breakdowns, collection analytics, and financial forecasting."
                highlights={["Monthly trend charts & comparison", "Collection efficiency metrics", "Revenue by client breakdown", "Weighted pipeline forecast", "Target tracking vs actual"]} />
            </FadeIn>
            <FadeIn delay={250}>
              <FeatureCard icon="🧠" title="Smart Capture OCR"
                desc="Extract contact info from business cards, email signatures, and WhatsApp messages instantly."
                highlights={["Paste any text → auto-extract name, phone, email", "Indian phone number format detection", "Email & website extraction", "Capture history with re-use", "Image upload support"]} />
            </FadeIn>
            <FadeIn delay={300}>
              <FeatureCard icon="📉" title="Analytics & Reports"
                desc="7 deep analytics tabs with conversion funnels, revenue trends, and team performance."
                highlights={["GitHub-style activity heatmap", "Cohort analysis & deal size distribution", "Source ROI analysis", "Sales cycle analysis", "Forecast with stage-weighted probability"]} />
            </FadeIn>
            <FadeIn delay={350}>
              <FeatureCard icon="👥" title="Team Management"
                desc="Role-based access, team performance tracking, and workload distribution."
                highlights={["4 roles: Owner, Admin, Manager, User", "Permissions matrix per role", "Per-member KPI dashboard", "Activity log with 14 event types", "Win rate & avg deal size per member"]} />
            </FadeIn>
            <FadeIn delay={400}>
              <FeatureCard icon="🛡️" title="Super Admin"
                desc="Multi-tenant management for agencies managing multiple client workspaces."
                highlights={["Tenant lifecycle: Active → Grace → Suspended", "Plan template editor with presets", "Subscription billing with proration", "Feature flags per tenant", "Audit trail & activity monitoring"]} />
            </FadeIn>
            <FadeIn delay={450}>
              <FeatureCard icon="🔔" title="Notifications"
                desc="Real-time activity feed with preferences and bulk action management."
                highlights={["Activity feed from all CRM modules", "Configurable notification preferences", "Bulk mark read / dismiss", "Overdue & SLA escalation alerts", "Daily summary digest option"]} />
            </FadeIn>
            <FadeIn delay={500}>
              <FeatureCard icon="📦" title="Data Export"
                desc="Export everything — leads, invoices, revenue data — in CSV, JSON, or PDF formats."
                highlights={["Date range filters per export", "Multi-format: CSV, JSON, PDF", "Batch export with field selection", "Import from CSV with mapping", "One-click backup & restore"]} />
            </FadeIn>
            <FadeIn delay={550}>
              <FeatureCard icon="⚙️" title="Settings & Config"
                desc="7 settings tabs to customize every aspect of your CRM experience."
                highlights={["General, Automation, Company, Invoicing", "WhatsApp & Email templates", "Section visibility controls", "SLA threshold configuration", "Danger zone: reset, wipe, export"]} />
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                Built for <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Indian Sales Teams</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Every feature is designed with Indian business requirements in mind — GST compliance, Indian phone formats, INR currency, and local business workflows.
              </p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "🇮🇳", title: "GST Compliant", desc: "Auto CGST/SGST/IGST calculation. GSTIN tracking. SAC codes. Place of supply rules. Invoice format matching Indian standards." },
              { icon: "📞", title: "Indian Phone Formats", desc: "+91 prefix detection. 10-digit validation. WhatsApp integration. Smart formatting for Indian mobile and landline numbers." },
              { icon: "₹", title: "INR Currency", desc: "All amounts in Indian Rupees. Lakhs/Crores formatting. Indian number formatting with commas. Tax-inclusive pricing." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="text-center p-8 rounded-2xl bg-[#788023]/5 border border-[#788023]/20">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner onLogin={onLogin} />
    </>
  );
}
