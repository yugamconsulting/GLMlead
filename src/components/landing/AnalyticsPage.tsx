// =====================================================================
// ANALYTICS PAGE — Analytics & reporting details
// =====================================================================

import { FadeIn, PageHero, CtaBanner } from "./SiteLayout";

export default function AnalyticsPage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <PageHero
        icon="📉"
        badge="Analytics & Insights"
        title="Data-Driven"
        highlight="Sales Decisions"
        desc="7 powerful analytics tabs that turn your CRM data into actionable insights. See what's working, fix what's not."
      />

      {/* Dashboard Image */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200/50">
              <img src="/images/analytics-dashboard.jpg" alt="Analytics Dashboard" className="w-full object-cover" />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 8 Analytics Modules */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: "🔻", title: "Conversion Funnel",
                desc: "Stage-by-stage conversion rates with velocity metrics. Find exactly where deals stall and fix your process.",
                details: ["9-stage conversion rates", "Stage-to-stage drop-off analysis", "Average time per stage transition", "Funnel comparison by date range"],
              },
              {
                icon: "💰", title: "Revenue Trends",
                desc: "12-month revenue charts with monthly breakdowns and year-over-year comparison.",
                details: ["Monthly won revenue tracking", "Invoiced vs collected comparison", "Revenue by source breakdown", "Year-over-year growth rates"],
              },
              {
                icon: "👥", title: "Team Performance",
                desc: "Leaderboard with medals. Per-member win rates, pipeline values, and activity metrics.",
                details: ["🥇🥈🥉 leader board", "Win rate per team member", "Pipeline value distribution", "Activity score & login frequency"],
              },
              {
                icon: "📢", title: "Source ROI",
                desc: "Which lead source gives the best ROI? Conversion rates and revenue per channel.",
                details: ["Conversion rate by source", "Revenue per lead by source", "Cost-per-acquisition tracking", "Source quality scoring"],
              },
              {
                icon: "🔥", title: "Activity Heatmap",
                desc: "GitHub-style activity heatmap showing your team's busiest days and weeks.",
                details: ["12-week rolling heatmap", "Activity intensity by day/week", "Busiest days identification", "Activity trend comparison"],
              },
              {
                icon: "🔮", title: "Forecast",
                desc: "Weighted pipeline forecast using stage probabilities. Predict next quarter's revenue.",
                details: ["Stage-weighted probability", "Monthly close forecast", "Confirmed vs probable revenue", "Pipeline coverage ratio"],
              },
              {
                icon: "📊", title: "Cohort Analysis",
                desc: "Track lead cohorts over time. See how different groups convert and at what pace.",
                details: ["Monthly lead cohorts", "Conversion timeline per cohort", "Cohort retention curves", "Cohort revenue comparison"],
              },
              {
                icon: "⏱️", title: "Sales Cycle",
                desc: "Average days to close by source and stage. Optimize your sales process timing.",
                details: ["Average close time by source", "Stage-wise time distribution", "Fastest/slowest sources", "Cycle improvement tracking"],
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-lg hover:border-[#788023]/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 text-3xl">{item.icon}</div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4">{item.desc}</p>
                      <ul className="space-y-1.5">
                        {item.details.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-slate-500">
                            <span className="mt-0.5 text-[#788023]">✓</span>{d}
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

      {/* Reports Preview */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                6 Report <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Types</span>
              </h2>
              <p className="mt-4 text-lg text-slate-500">Export-ready reports for every business need.</p>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Lead Summary", desc: "Total, open, won, lost leads with conversion rates by source and temperature." },
              { title: "Pipeline Report", desc: "Stage-wise pipeline value, conversion rates, and velocity metrics." },
              { title: "Revenue Report", desc: "Monthly revenue breakdown, collection efficiency, and outstanding amounts." },
              { title: "Team Performance", desc: "Per-member stats: won, lost, win rate, avg deal size, pipeline value." },
              { title: "Source Analysis", desc: "Conversion and revenue metrics per lead source with ROI analysis." },
              { title: "Invoice Aging", desc: "Outstanding invoices by age bucket: current, 1-30, 31-60, 60+ days." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#788023]/30 hover:bg-white transition-all duration-300">
                  <h4 className="text-sm font-bold text-slate-800 mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
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
