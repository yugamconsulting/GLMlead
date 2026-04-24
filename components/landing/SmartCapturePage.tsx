// =====================================================================
// SMART CAPTURE PAGE — OCR demo and feature details
// =====================================================================

import { FadeIn, PageHero, CtaBanner } from "./SiteLayout";

export default function SmartCapturePage({ onLogin }: { onLogin: () => void }) {
  return (
    <>
      <PageHero
        icon="🧠"
        badge="Smart Capture OCR"
        title="From Text to Lead in"
        highlight="Seconds"
        desc="Paste a business card photo, email signature, or WhatsApp message. Our intelligent text extraction engine detects names, phone numbers, emails, companies, and addresses — automatically."
      />

      {/* Interactive Demo */}
      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Smart Capture — Paste Any Text</div>
                    <div className="text-xs font-semibold text-[#788023]">Demo</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 font-mono text-xs text-slate-600 leading-relaxed">
                    Rahul Sharma<br />
                    Senior Marketing Manager<br />
                    TechVista Solutions Pvt Ltd<br />
                    📞 +91 98765 43210<br />
                    ✉️ rahul.sharma@techvista.com<br />
                    🌐 www.techvista.com<br />
                    📍 Mumbai, Maharashtra
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-[#788023] animate-progress" />
                    <span className="text-xs font-semibold text-[#788023]">6 fields detected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["👤 Rahul Sharma", "🏢 TechVista Solutions", "📞 +91 98765 43210", "✉️ rahul@techvista.com", "🌐 techvista.com", "📍 Mumbai, Maharashtra"].map((f, i) => (
                      <div key={i} className="rounded-lg bg-[#788023]/10 border border-[#788023]/20 px-3 py-2 text-xs font-medium text-[#788023]">{f}</div>
                    ))}
                  </div>
                  <button onClick={onLogin} className="w-full rounded-lg bg-[#788023] py-2.5 text-sm font-bold text-white hover:bg-[#5e6419] transition-all">
                    Use Selected Fields → Add Lead
                  </button>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">How It Works</h3>
                <div className="space-y-4">
                  {[
                    { step: "1", title: "Paste or Upload", desc: "Paste any text — business card OCR output, email signature, WhatsApp message, or upload an image." },
                    { step: "2", title: "Auto-Extract", desc: "Our engine detects names, phone numbers (Indian format), emails, companies, websites, and addresses." },
                    { step: "3", title: "Review & Confirm", desc: "See all detected fields with confidence levels. Select which ones to use. Edit or override as needed." },
                    { step: "4", title: "Add Lead", desc: "One click to create a new lead with all the captured information. Duplicate detection warns if the lead already exists." },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#788023] flex items-center justify-center text-white font-bold text-sm">{item.step}</div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                        <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Detection Features */}
      <section className="py-20 sm:py-28 bg-slate-50 border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                What Gets <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Detected</span>
              </h2>
            </div>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "👤", title: "Person Names", desc: "Capital-letter pattern matching with Indian name detection. Handles first + last name combinations." },
              { icon: "📞", title: "Phone Numbers", desc: "Indian phone format detection: +91 prefix, 10-digit numbers, with/without spaces and dashes." },
              { icon: "✉️", title: "Email Addresses", desc: "Standard email regex with domain validation. Detects multiple emails in a single text block." },
              { icon: "🏢", title: "Company Names", desc: "Keyword-based detection (Pvt Ltd, LLP, Inc, etc.). Extracts organization names from context." },
              { icon: "🌐", title: "Websites", desc: "URL extraction with and without protocol. Detects www. prefixes and bare domain names." },
              { icon: "📍", title: "Addresses", desc: "Indian city and state keyword matching. Detects addresses with postal codes and landmarks." },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 50}>
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-[#788023]/30 transition-all duration-300">
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Duplicate Detection */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
                  Built-in <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">Duplicate Detection</span>
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed mb-6">
                  Every captured lead is checked against your existing database using fuzzy matching algorithms. Never add the same lead twice.
                </p>
                <div className="space-y-3">
                  {[
                    { level: "High", color: "text-red-600", desc: "Exact phone or email match — blocks duplicate entry" },
                    { level: "Medium", color: "text-amber-600", desc: "Name + company fuzzy match — shows warning" },
                    { level: "Low", color: "text-blue-600", desc: "Similar name — informational notice only" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${item.color} bg-opacity-10`}>{item.level}</span>
                      <span className="text-sm text-slate-600">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Jaro-Winkler Similarity</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Our matching engine uses the Jaro-Winkler string similarity algorithm to detect near-duplicates even with typos, abbreviations, and formatting differences.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <CtaBanner onLogin={onLogin} />
    </>
  );
}
