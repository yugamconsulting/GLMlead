// =====================================================================
// INVOICING PAGE — GST invoicing, dunning, payments
// =====================================================================

import { FadeIn, PageHero, CtaBanner } from "./SiteLayout";

export default function InvoicingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <PageHero
        icon="🧾"
        badge="Invoicing & GST"
        title="Invoice, Track &"
        highlight="Collect"
        desc="Create GST-compliant invoices in seconds. Track payments, manage dunning, and get paid faster. Everything you need for Indian billing compliance."
      />

      {/* Mock Invoice */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-bold text-slate-800">TAX INVOICE</div>
                    <div className="text-xs text-slate-400">#YUGAM-2025-001</div>
                  </div>
                  <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Paid</div>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-4 gap-2 font-semibold text-slate-400 pb-2 border-b border-slate-100">
                    <span>Item</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
                  </div>
                  {[
                    { item: "Digital Marketing", qty: 1, rate: 50000 },
                    { item: "SEO Setup", qty: 1, rate: 25000 },
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-slate-600">
                      <span>{row.item}</span>
                      <span className="text-right">{row.qty}</span>
                      <span className="text-right">₹{row.rate.toLocaleString("en-IN")}</span>
                      <span className="text-right">₹{(row.qty * row.rate).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>₹75,000</span></div>
                    <div className="flex justify-between text-slate-500"><span>CGST (9%)</span><span>₹6,750</span></div>
                    <div className="flex justify-between text-slate-500"><span>SGST (9%)</span><span>₹6,750</span></div>
                    <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-100">
                      <span>Total</span><span>₹88,500</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">GST-Compliant Invoicing</h3>
                <p className="text-slate-500 leading-relaxed mb-6">
                  Automatically calculate CGST, SGST, and IGST based on place of supply. Generate professional invoices that match India's GST format.
                </p>
                <div className="space-y-3">
                  {[
                    "Auto CGST/SGST for intra-state transactions",
                    "Auto IGST for inter-state transactions",
                    "GSTIN tracking for supplier and customer",
                    "SAC code management for services",
                    "Place of supply rules built-in",
                    "Tax breakdown on every invoice",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-0.5 text-[#788023]">✓</span>{item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Dunning Board */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                4-Stage <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Dunning Board</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500">Automated payment follow-up escalation. Never let invoices go unpaid.</p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { stage: "D1–D3", label: "Gentle Reminder", color: "bg-blue-50 border-blue-200", icon: "📬", desc: "Friendly payment reminder via email or WhatsApp. Professional tone, no pressure." },
              { stage: "D4–D7", label: "Follow-up", color: "bg-amber-50 border-amber-200", icon: "📋", desc: "Second reminder with invoice copy. Mention late payment terms and due amount." },
              { stage: "D8–D15", label: "Escalation", color: "bg-orange-50 border-orange-200", icon: "⚠️", desc: "Formal notice. Mention late fees and potential service suspension. Phone call follow-up." },
              { stage: "D15+", label: "Final Notice", color: "bg-red-50 border-red-200", icon: "🚨", desc: "Final notice before collections. Legal notice template. Service suspension warning." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className={`rounded-xl border-2 p-6 ${item.color}`}>
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <div className="text-xs font-bold text-slate-500 mb-1">{item.stage}</div>
                  <h4 className="text-sm font-bold text-slate-800 mb-2">{item.label}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Client Master & Payments */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "💳", title: "Payment Tracking", desc: "Record partial and full payments. Track outstanding amounts. See payment history at a glance.", features: ["Partial payment recording", "Payment progress bars", "Outstanding balance alerts", "Collection efficiency metrics"] },
              { icon: "🏢", title: "Client Master", desc: "Per-client outstanding tracking, invoice history, and payment patterns.", features: ["Client-wise outstanding", "Payment pattern analysis", "Invoice history per client", "Quick pay links"] },
              { icon: "📄", title: "Credit Notes", desc: "Issue credit notes for adjustments, refunds, and corrections.", features: ["Full & partial credit notes", "Adjust against outstanding", "GST-compliant adjustments", "Audit trail for all credits"] },
              { icon: "🖨️", title: "Print & Share", desc: "Generate print-ready invoices and share via email or WhatsApp.", features: ["Print-optimized layout", "PDF generation", "WhatsApp share button", "Custom branding & logo"] },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{item.desc}</p>
                  <ul className="space-y-1.5">
                    {item.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs text-slate-500">
                        <span className="text-[#788023] text-[10px] mt-0.5">✓</span>{f}
                      </li>
                    ))}
                  </ul>
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
