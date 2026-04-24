// =====================================================================
// PIPELINE PAGE — Pipeline management details
// =====================================================================

import { FadeIn, PageHero, CtaBanner } from "./SiteLayout";

export default function PipelinePage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <PageHero
        icon="📊"
        badge="Pipeline Management"
        title="Visual Pipeline That"
        highlight="Drives Action"
        desc="See every deal at every stage. Drag cards between columns. Get alerts when deals stall. Never lose track of a hot lead again."
      />

      {/* Screenshot */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-200/50">
              <img src="/images/pipeline-kanban.jpg" alt="Pipeline Kanban Board" className="w-full object-cover" />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {[
              {
                icon: "🎨", title: "9-Stage Kanban Board",
                desc: "From New to Won, visualize every lead's journey through your sales process with color-coded temperature indicators. Drag and drop leads between stages.",
                details: ["New → Contacted → Qualified → Proposal Sent", "Negotiation → Confirmation → Invoice Sent", "Won and Lost stages with reason tracking", "Card count per column with WIP limits"],
              },
              {
                icon: "⚡", title: "WIP Limits & Alerts",
                desc: "Set work-in-progress limits per stage. Get alerts when stages overflow so you can take action before deals go cold.",
                details: ["Configurable WIP limits per pipeline stage", "Visual warning when limits are exceeded", "Priority scoring based on temperature & time", "Neglect risk indicators: Low, Medium, High"],
              },
              {
                icon: "📊", title: "Velocity Analytics",
                desc: "Track how fast leads move through each stage. Identify bottlenecks and optimize your sales process with data.",
                details: ["Average days per stage transition", "Stage velocity trend over weeks", "Conversion rate between stages", "Bottleneck identification with suggestions"],
              },
              {
                icon: "🏆", title: "Won/Lost Tracking",
                desc: "Record win reasons, lost reasons, and competitor info. Learn from every deal to improve your close rate.",
                details: ["Won: deal value, close date, reason", "Lost: competitor, reason, follow-up date", "Win rate analysis by source and temperature", "Revenue impact of won vs lost deals"],
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#788023]/10 flex items-center justify-center text-2xl">{item.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4">{item.desc}</p>
                      <ul className="space-y-2">
                        {item.details.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-0.5 text-[#788023] text-xs">✓</span>{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Analytics Preview */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                Pipeline <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Analytics</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500">Understand your pipeline like never before with real-time analytics.</p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { metric: "Total Pipeline", value: "₹24.5L", desc: "Sum of all open deal values" },
              { metric: "Weighted Forecast", value: "₹12.8L", desc: "Probability-adjusted pipeline" },
              { metric: "Avg Days in Stage", value: "4.2 days", desc: "Average velocity across stages" },
              { metric: "Conversion Rate", value: "34%", desc: "Lead-to-won conversion rate" },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-extrabold text-[#788023]">{item.value}</div>
                  <div className="text-sm font-semibold text-slate-700 mt-1">{item.metric}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
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
