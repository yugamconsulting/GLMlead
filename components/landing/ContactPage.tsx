// =====================================================================
// CONTACT PAGE — Contact form, company info, support
// =====================================================================

import { useState } from "react";
import { FadeIn, PageHero, CtaBanner } from "./SiteLayout";

export default function ContactPage({ onLogin }: { onLogin: () => void }) {
  const [formData, setFormData] = useState({ name: "", email: "", company: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <PageHero
        icon="📞"
        badge="Get in Touch"
        title="We'd Love to"
        highlight="Hear From You"
        desc="Have questions about Yugam Lead Tracker? Need a demo? Want to discuss enterprise pricing? Our team is ready to help."
      />

      <section className="pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-3">
              <FadeIn>
                {submitted ? (
                  <div className="rounded-2xl bg-green-50 border border-green-200 p-12 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Message Sent!</h3>
                    <p className="text-slate-500">Thank you for reaching out. Our team will get back to you within 24 hours.</p>
                    <button onClick={() => setSubmitted(false)} className="mt-6 rounded-xl bg-[#788023] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#5e6419] transition-all">
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
                        <input type="text" required value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all"
                          placeholder="Your full name" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
                        <input type="email" required value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all"
                          placeholder="you@company.com" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
                        <input type="text" value={formData.company}
                          onChange={e => setFormData({ ...formData, company: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all"
                          placeholder="Your company name" />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
                        <select required value={formData.subject}
                          onChange={e => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all">
                          <option value="">Select a topic</option>
                          <option value="demo">Request a Demo</option>
                          <option value="pricing">Pricing Questions</option>
                          <option value="enterprise">Enterprise Plan</option>
                          <option value="support">Technical Support</option>
                          <option value="partnership">Partnership Inquiry</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Message *</label>
                      <textarea required rows={5} value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-[#788023] focus:ring-2 focus:ring-[#788023]/40 transition-all resize-none"
                        placeholder="Tell us how we can help..." />
                    </div>
                    <button type="submit"
                      className="rounded-xl bg-[#788023] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#788023]/25 hover:bg-[#5e6419] transition-all">
                      Send Message →
                    </button>
                  </form>
                )}
              </FadeIn>
            </div>

            {/* Contact Info Sidebar */}
            <div className="lg:col-span-2">
              <FadeIn delay={200}>
                <div className="space-y-6">
                  {/* Contact Cards */}
                  {[
                    { icon: "📧", title: "Email Us", info: "admin@oruyugam.com", desc: "We reply within 24 hours" },
                    { icon: "📞", title: "Call Us", info: "+91 98765 43210", desc: "Mon–Fri, 10 AM – 7 PM IST" },
                    { icon: "📍", title: "Visit Us", info: "Mumbai, Maharashtra", desc: "India" },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#788023]/10 flex items-center justify-center text-xl">{item.icon}</div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                        <div className="text-sm text-[#788023] font-medium">{item.info}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}

                  {/* Quick Links */}
                  <div className="p-5 rounded-xl bg-[#788023]/5 border border-[#788023]/20">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Quick Links</h4>
                    <div className="space-y-2">
                      {[
                        { label: "📖 Documentation", desc: "Guides and tutorials" },
                        { label: "🎬 Video Tutorials", desc: "Learn by watching" },
                        { label: "💬 Community Forum", desc: "Connect with other users" },
                        { label: "🎫 Submit a Ticket", desc: "Get technical help" },
                      ].map((link, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                          <span className="text-sm text-slate-600">{link.label}</span>
                          <span className="text-xs text-slate-400">{link.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Social */}
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Follow Us</h4>
                    <div className="flex gap-3">
                      {["LinkedIn", "Twitter", "GitHub", "YouTube"].map(s => (
                        <span key={s} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs font-medium hover:border-[#788023]/30 hover:text-[#788023] transition-colors cursor-pointer">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner onLogin={onLogin} />
    </>
  );
}
