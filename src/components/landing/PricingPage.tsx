// =====================================================================
// PRICING PAGE — Plans, comparison table, FAQ
// =====================================================================

import { FadeIn, PricingCard, FaqItem, CtaBanner } from "./SiteLayout";

export default function PricingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-[#788023]/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-sky-100/30 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#788023]/10 px-4 py-1.5 text-xs font-semibold text-[#788023] mb-6">
                <span className="text-base">💰</span> Simple Pricing
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                Plans That <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Grow With You</span>
              </h1>
              <p className="mt-6 text-lg text-slate-500 leading-relaxed">
                Start free. Upgrade when you're ready. No hidden fees. All prices in INR.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FadeIn delay={0}>
              <PricingCard name="Starter" price="₹0" period="month" desc="For solo entrepreneurs"
                cta="Start Free"
                features={["1 User", "100 Leads/month", "Pipeline Board", "Follow-up Reminders", "Basic Reports", "Email Support"]} />
            </FadeIn>
            <FadeIn delay={100}>
              <PricingCard name="Growth" price="₹1,499" period="month" desc="For growing teams"
                popular cta="Start 14-Day Trial"
                features={["5 Users", "500 Leads/month", "Smart Capture OCR", "Invoicing & GST", "Analytics Dashboard", "Priority Support", "CSV Import/Export"]} />
            </FadeIn>
            <FadeIn delay={200}>
              <PricingCard name="Scale" price="₹3,999" period="month" desc="For scaling businesses"
                cta="Start 14-Day Trial"
                features={["15 Users", "2,000 Leads/month", "Everything in Growth", "Revenue Forecasting", "Dunning Board", "Client Master", "Custom Templates", "API Access"]} />
            </FadeIn>
            <FadeIn delay={300}>
              <PricingCard name="Enterprise" price="Custom" period="month" desc="For large organizations"
                cta="Contact Sales"
                features={["Unlimited Users", "Unlimited Leads", "Everything in Scale", "Multi-Tenant Management", "Super Admin Panel", "Custom Integrations", "Dedicated Support", "SLA Guarantee"]} />
            </FadeIn>
          </div>
          <FadeIn className="mt-10 text-center">
            <p className="text-sm text-slate-400">
              All plans include 14-day free trial • No credit card required • Cancel anytime • GST included
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                Why Choose <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Yugam Lead Tracker</span>
              </h2>
            </div>
          </FadeIn>
          <FadeIn>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-4 px-6 font-semibold text-slate-400">Feature</th>
                    <th className="text-center py-4 px-4 font-bold text-[#788023]">Yugam</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-400">Spreadsheets</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-400">Basic CRMs</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Lead Management", true, true, true],
                    ["Pipeline Kanban Board", true, false, true],
                    ["Smart Capture OCR", true, false, false],
                    ["Duplicate Detection", true, false, false],
                    ["GST-Compliant Invoicing", true, false, false],
                    ["Dunning Board (4 stages)", true, false, false],
                    ["Follow-up Automation", true, false, true],
                    ["Revenue Analytics (7 tabs)", true, false, false],
                    ["Team Performance Tracking", true, false, true],
                    ["Multi-Tenant Super Admin", true, false, false],
                    ["Calendar View", true, false, false],
                    ["Credit Notes", true, false, false],
                    ["CSV Import with Mapping", true, true, true],
                    ["Source ROI Analysis", true, false, false],
                    ["Activity Heatmap", true, false, false],
                    ["Custom Templates", true, false, false],
                    ["Data Export (CSV/JSON/PDF)", true, true, true],
                    ["Offline-Ready (localStorage)", true, true, false],
                  ].map(([feature, yugam, sheets, basic], i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-6 text-slate-700 font-medium">{feature as string}</td>
                      <td className="text-center py-3 px-4"><span className={yugam ? "text-[#788023] font-bold" : "text-slate-300"}>{yugam ? "✓" : "✗"}</span></td>
                      <td className="text-center py-3 px-4"><span className={sheets ? "text-green-600" : "text-slate-300"}>{sheets ? "✓" : "✗"}</span></td>
                      <td className="text-center py-3 px-4"><span className={basic ? "text-green-600" : "text-slate-300"}>{basic ? "✓" : "✗"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                Frequently Asked <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Questions</span>
              </h2>
            </div>
          </FadeIn>
          <FadeIn>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <FaqItem q="Is my data secure?" a="Yes! All data is stored locally in your browser using localStorage. Nothing is sent to external servers unless you explicitly export it. Your leads, invoices, and business data stay on your device." />
              <FaqItem q="Do I need to install anything?" a="No installation required. Yugam Lead Tracker is a web application that runs in any modern browser — Chrome, Firefox, Safari, or Edge. Access it from your laptop, tablet, or phone." />
              <FaqItem q="Can I import leads from Excel?" a="Absolutely! Import leads from any CSV file. Our smart column mapping auto-detects field names (fuzzy matching), and you can manually adjust mappings before importing. Supports Excel, Google Sheets exports." />
              <FaqItem q="How does Smart Capture work?" a="Simply paste any text — a business card photo's OCR output, an email signature, a WhatsApp message — and our extraction engine automatically detects names, phone numbers (Indian format), emails, companies, websites, and addresses." />
              <FaqItem q="Is the invoicing GST-compliant?" a="Yes! Invoices auto-calculate CGST, SGST (for intra-state), or IGST (for inter-state) based on your place of supply settings. You can configure your GSTIN, supplier profile, and invoice format in Settings." />
              <FaqItem q="What's the Super Admin panel?" a="The Super Admin panel is designed for agencies and consultants managing multiple client workspaces. You can create and manage tenants, assign plan templates, manage subscriptions, and monitor activity across all tenants." />
              <FaqItem q="Can I export my data?" a="Yes — export leads, invoices, and revenue data in CSV, JSON, or PDF formats. You can also create full backups from the Settings > Data section." />
              <FaqItem q="How many team members can I add?" a="Depends on your plan: Starter (1 user), Growth (5 users), Scale (15 users), Enterprise (unlimited). Each team member gets role-based access — Owner, Admin, Manager, or User." />
              <FaqItem q="What happens if I cancel?" a="Your data stays on your device. You can export everything before downgrading. No lock-in contracts — cancel anytime from Settings. Your 14-day trial is completely free with no credit card required." />
              <FaqItem q="Do you offer customer support?" a="Growth and above plans include priority email support. Enterprise plans include a dedicated support manager and SLA guarantees. All plans have access to our Help Center." />
            </div>
          </FadeIn>
        </div>
      </section>

      <CtaBanner onLogin={onLogin} />
    </>
  );
}
