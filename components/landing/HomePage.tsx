// =====================================================================
// HOME PAGE — Hero, Stats, Problem Statement, How It Works, Testimonials
// =====================================================================

import { FadeIn, useCountUp, TestimonialCard, CtaBanner } from "./SiteLayout";

export default function HomePage({ onLogin, onNavigate }: {
  onLogin: () => void; onNavigate: (page: string) => void;
}) {
  const stat1 = useCountUp(98, 2000);
  const stat2 = useCountUp(40, 2000);
  const stat3 = useCountUp(500, 2000);
  const stat4 = useCountUp(3, 2000);

  return (
    <>
      {/* ============================================================ */}
      {/* HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-[#788023]/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[#788023]/3 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-gradient-to-r from-[#788023]/3 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeIn>
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#788023]/10 px-4 py-1.5 text-xs font-semibold text-[#788023] mb-6">
                  <span className="h-2 w-2 rounded-full bg-[#788023] animate-pulse" />
                  Field-Ready CRM for Modern Sales Teams
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                  Close More Deals,{" "}
                  <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Faster</span>
                </h1>
                <p className="mt-6 text-lg text-slate-500 leading-relaxed">
                  The complete lead tracking, pipeline management, and invoicing workspace built for
                  Indian sales teams. From first contact to final payment — manage everything in one place.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <button onClick={onLogin}
                    className="rounded-xl bg-[#788023] px-8 py-4 text-sm font-bold text-white shadow-xl shadow-[#788023]/25 hover:bg-[#5e6419] hover:shadow-2xl transition-all">
                    Start Free Trial →
                  </button>
                  <button onClick={() => onNavigate("features")}
                    className="rounded-xl border-2 border-slate-200 px-8 py-4 text-sm font-bold text-slate-700 hover:border-[#788023]/30 hover:text-[#788023] transition-all text-center">
                    See All Features
                  </button>
                </div>
                <div className="mt-8 flex items-center gap-6 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="text-[#788023]">✓</span> No credit card required</span>
                  <span className="flex items-center gap-1.5"><span className="text-[#788023]">✓</span> 14-day free trial</span>
                  <span className="flex items-center gap-1.5"><span className="text-[#788023]">✓</span> Cancel anytime</span>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={200} className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200/50">
                <img src="/images/hero-crm.jpg" alt="Yugam Lead Tracker Dashboard" className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
              </div>
              <div className="absolute -bottom-4 -left-4 rounded-xl bg-white p-4 shadow-xl border border-slate-100 animate-float">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-lg">📈</div>
                  <div>
                    <div className="text-xs text-slate-400">Conversion Rate</div>
                    <div className="text-lg font-bold text-slate-900">+34%</div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 rounded-xl bg-white p-4 shadow-xl border border-slate-100 animate-float" style={{ animationDelay: "1s" }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">🎯</div>
                  <div>
                    <div className="text-xs text-slate-400">Deals Won</div>
                    <div className="text-lg font-bold text-slate-900">₹12.4L</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* STATS BAR                                                    */}
      {/* ============================================================ */}
      <section className="relative py-16 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <p className="text-center text-sm font-semibold text-slate-400 uppercase tracking-wider mb-10">
              Trusted by growing sales teams across India
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div ref={stat1.ref} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#788023]">{stat1.count}%</div>
                <div className="text-sm text-slate-500 mt-1">Customer Satisfaction</div>
              </div>
              <div ref={stat2.ref} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#788023]">{stat2.count}%</div>
                <div className="text-sm text-slate-500 mt-1">Faster Follow-ups</div>
              </div>
              <div ref={stat3.ref} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#788023]">{stat3.count}+</div>
                <div className="text-sm text-slate-500 mt-1">Leads Managed</div>
              </div>
              <div ref={stat4.ref} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#788023]">&lt;{stat4.count} min</div>
                <div className="text-sm text-slate-500 mt-1">Setup Time</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PROBLEM STATEMENT                                            */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold text-[#788023] uppercase tracking-wider">The Problem</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Your Sales Process is <span className="text-red-500">Broken</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Most sales teams juggle spreadsheets, WhatsApp groups, and sticky notes. Leads fall through the cracks, follow-ups get missed, and revenue slips away.
              </p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "📋", title: "Leads Lost in Spreadsheets", desc: "No central system means leads get forgotten, duplicated, or lost between team members. You're bleeding revenue daily." },
              { icon: "⏰", title: "Follow-ups Fall Through Cracks", desc: "Without automated reminders and queue management, 67% of leads never get a second follow-up. Your competitors are faster." },
              { icon: "💰", title: "Revenue Leaks Everywhere", desc: "Invoicing delays, GST errors, and no payment tracking. Money sits in accounts receivable while you chase clients manually." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="text-center p-8 rounded-2xl bg-red-50/50 border border-red-100">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS                                                 */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold text-[#788023] uppercase tracking-wider">How It Works</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Up and Running in <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">3 Steps</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Capture Leads", desc: "Add leads manually, import from CSV, or use Smart Capture OCR to extract contact info from any text. Duplicate detection prevents double entries.", icon: "📥" },
              { step: "2", title: "Manage Pipeline", desc: "Move leads through 9 pipeline stages with drag-and-drop. Set follow-up schedules, track temperature, and get alerts on stalling deals.", icon: "📊" },
              { step: "3", title: "Close & Invoice", desc: "Mark deals as Won, generate GST-compliant invoices, track payments, and manage dunning. Revenue analytics show your growth.", icon: "🏆" },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="relative text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#788023] flex items-center justify-center text-white text-2xl shadow-lg shadow-[#788023]/25">
                    {item.icon}
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 h-7 w-7 rounded-full bg-slate-100 border-2 border-[#788023] flex items-center justify-center text-xs font-bold text-[#788023]">{item.step}</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="mt-12 text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={onLogin} className="rounded-xl bg-[#788023] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#788023]/25 hover:bg-[#5e6419] transition-all">
                Start Free Trial →
              </button>
              <button onClick={() => onNavigate("features")} className="rounded-xl border-2 border-slate-200 px-8 py-3.5 text-sm font-bold text-slate-700 hover:border-[#788023]/30 hover:text-[#788023] transition-all">
                Explore All Features
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURE PREVIEWS (Quick links to inner pages)                */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold text-[#788023] uppercase tracking-wider">Explore the Platform</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Powerful Modules, <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">One Workspace</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🎯", title: "Lead Management", desc: "Capture, organize, and track every lead from first touch to close.", page: "features" },
              { icon: "📊", title: "Pipeline Board", desc: "Visual Kanban board with drag-and-drop stage management.", page: "pipeline" },
              { icon: "🧠", title: "Smart Capture OCR", desc: "Extract contact info from any text — business cards, emails, WhatsApp.", page: "smart-capture" },
              { icon: "🧾", title: "Invoicing & GST", desc: "Create GST-compliant invoices with automatic tax calculations.", page: "invoicing" },
              { icon: "📉", title: "Analytics & Reports", desc: "7 analytics tabs with conversion funnels and revenue trends.", page: "analytics" },
              { icon: "💰", title: "Simple Pricing", desc: "Start free. Upgrade when ready. No hidden fees.", page: "pricing" },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <button onClick={() => onNavigate(item.page)}
                  className="w-full text-left group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl hover:border-[#788023]/30 transition-all duration-300 hover:-translate-y-1">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#788023]/10 text-2xl group-hover:bg-[#788023] group-hover:text-white transition-all duration-300">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    {item.title}
                    <span className="text-xs text-[#788023] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </button>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* TESTIMONIALS                                                 */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-semibold text-[#788023] uppercase tracking-wider">What Teams Say</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Loved by Sales Teams <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Across India</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            <FadeIn delay={0}>
              <TestimonialCard name="Priya Mehta" role="Sales Director" company="TechVista Solutions"
                quote="We went from losing 40% of leads to converting 3x more. The pipeline board alone paid for itself in the first month. The GST invoicing is a game-changer."
                avatar="PM" />
            </FadeIn>
            <FadeIn delay={100}>
              <TestimonialCard name="Arjun Patel" role="Founder" company="GrowthEngine Agency"
                quote="Managing 5 client workspaces with the Super Admin panel is seamless. Smart Capture saves my team at least 2 hours daily on data entry. Absolutely worth it."
                avatar="AP" />
            </FadeIn>
            <FadeIn delay={200}>
              <TestimonialCard name="Sneha Reddy" role="Sales Manager" company="CloudFirst IT"
                quote="The follow-up engine is incredible. We never miss a follow-up now. The dunning board helped us recover ₹8L in overdue payments in just 3 months."
                avatar="SR" />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FINAL CTA                                                    */}
      {/* ============================================================ */}
      <CtaBanner onLogin={onLogin} />
    </>
  );
}
