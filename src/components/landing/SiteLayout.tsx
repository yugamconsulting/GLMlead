// =====================================================================
// SITE LAYOUT — Shared navigation, footer, and utility components
// for the multi-page marketing site
// =====================================================================

import { useState, useEffect, useRef } from "react";

// -------------------------------------------------------------------
// Page type
// -------------------------------------------------------------------
export type SitePage =
  | "home"
  | "features"
  | "pipeline"
  | "smart-capture"
  | "invoicing"
  | "analytics"
  | "pricing"
  | "contact";

export const SITE_NAV_ITEMS: { key: SitePage; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "features", label: "Features" },
  { key: "pipeline", label: "Pipeline" },
  { key: "smart-capture", label: "Smart Capture" },
  { key: "invoicing", label: "Invoicing" },
  { key: "analytics", label: "Analytics" },
  { key: "pricing", label: "Pricing" },
  { key: "contact", label: "Contact" },
];

// -------------------------------------------------------------------
// Animated Counter Hook
// -------------------------------------------------------------------
export function useCountUp(target: number, duration = 2000, start = 0) {
  const [count, setCount] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(start + (target - start) * eased));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, start]);
  return { count, ref };
}

// -------------------------------------------------------------------
// Fade-in on Scroll
// -------------------------------------------------------------------
export function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// -------------------------------------------------------------------
// Feature Card
// -------------------------------------------------------------------
export function FeatureCard({ icon, title, desc, highlights }: {
  icon: string; title: string; desc: string; highlights?: string[];
}) {
  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl hover:border-[#788023]/30 transition-all duration-300 hover:-translate-y-1">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#788023]/10 text-2xl group-hover:bg-[#788023] group-hover:text-white transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed mb-3">{desc}</p>
      {highlights && (
        <ul className="space-y-1.5">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-[#788023]/10 flex items-center justify-center text-[#788023] text-[10px]">✓</span>
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Pricing Card
// -------------------------------------------------------------------
export function PricingCard({ name, price, period, desc, features, popular, cta }: {
  name: string; price: string; period: string; desc: string;
  features: string[]; popular?: boolean; cta: string;
}) {
  return (
    <div className={`relative rounded-2xl border-2 p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
      popular ? "border-[#788023] bg-[#788023]/5 shadow-xl" : "border-slate-200 bg-white shadow-sm hover:shadow-lg"
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#788023] px-4 py-1 text-xs font-bold text-white">Most Popular</div>
      )}
      <h3 className="text-lg font-bold text-slate-800">{name}</h3>
      <p className="text-xs text-slate-400 mt-1">{desc}</p>
      <div className="mt-4 mb-5">
        <span className="text-4xl font-extrabold text-slate-900">{price}</span>
        <span className="text-sm text-slate-400 ml-1">/{period}</span>
      </div>
      <ul className="space-y-2.5 flex-1 mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-[#788023]">✓</span>{f}
          </li>
        ))}
      </ul>
      <button className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
        popular
          ? "bg-[#788023] text-white hover:bg-[#5e6419] shadow-lg shadow-[#788023]/25"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}>{cta}</button>
    </div>
  );
}

// -------------------------------------------------------------------
// FAQ Accordion
// -------------------------------------------------------------------
export function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left">
        <span className="text-sm font-semibold text-slate-800 pr-4">{q}</span>
        <span className={`text-[#788023] text-xl transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-60 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Testimonial Card
// -------------------------------------------------------------------
export function TestimonialCard({ name, role, company, quote, avatar }: {
  name: string; role: string; company: string; quote: string; avatar: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-1 mb-3">
        {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400 text-sm">★</span>)}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[#788023]/10 flex items-center justify-center text-[#788023] font-bold text-sm">{avatar}</div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{name}</div>
          <div className="text-xs text-slate-400">{role}, {company}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Section Header
// -------------------------------------------------------------------
export function SectionHeader({ badge, title, highlight, desc }: {
  badge: string; title: string; highlight: string; desc?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-16">
      <span className="text-xs font-semibold text-[#788023] uppercase tracking-wider">{badge}</span>
      <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">
        {title}{" "}
        <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">{highlight}</span>
      </h2>
      {desc && <p className="mt-4 text-lg text-slate-500">{desc}</p>}
    </div>
  );
}

// -------------------------------------------------------------------
// CTA Banner
// -------------------------------------------------------------------
export function CtaBanner({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#788023] to-[#5e6419]" />
        <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-white/5 blur-3xl" />
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            Ready to Close More Deals?
          </h2>
          <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
            Join hundreds of Indian sales teams who've transformed their pipeline with Yugam Lead Tracker. Start your free trial today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onLogin}
              className="rounded-xl bg-white px-8 py-4 text-sm font-bold text-[#788023] shadow-xl hover:bg-slate-50 transition-all">
              Start Free Trial →
            </button>
            <button onClick={onLogin}
              className="rounded-xl border-2 border-white/30 px-8 py-4 text-sm font-bold text-white hover:bg-white/10 transition-all">
              Explore Features
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/50">
            <span>✓ Free 14-day trial</span>
            <span>✓ No credit card</span>
            <span>✓ Setup in 3 minutes</span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------
// Page Hero (used by inner pages)
// -------------------------------------------------------------------
export function PageHero({ badge, title, highlight, desc, icon }: {
  badge: string; title: string; highlight: string; desc: string; icon: string;
}) {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-20">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-[#788023]/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-sky-100/30 blur-3xl" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#788023]/10 px-4 py-1.5 text-xs font-semibold text-[#788023] mb-6">
              <span className="text-base">{icon}</span> {badge}
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
              {title}{" "}
              <span className="bg-gradient-to-r from-[#788023] to-[#9ea63a] bg-clip-text text-transparent">{highlight}</span>
            </h1>
            <p className="mt-6 text-lg text-slate-500 leading-relaxed">{desc}</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------
// SITE NAVIGATION
// -------------------------------------------------------------------
function SiteNav({ currentPage, onNavigate, onLogin }: {
  currentPage: SitePage; onNavigate: (page: SitePage) => void; onLogin: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100" : "bg-white/80 backdrop-blur-sm"
    }`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <button onClick={() => onNavigate("home")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white font-bold text-lg shadow-sm">Y</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#788023] leading-tight">Yugam</span>
              <span className="text-[9px] font-medium text-slate-400 leading-tight tracking-wide uppercase">Consulting</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {SITE_NAV_ITEMS.map(l => (
              <button key={l.key} onClick={() => onNavigate(l.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === l.key
                    ? "bg-[#788023]/10 text-[#788023]"
                    : "text-slate-600 hover:text-[#788023] hover:bg-slate-50"
                }`}>
                {l.label}
              </button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-[#788023] transition-colors">
              Sign In
            </button>
            <button onClick={onLogin}
              className="rounded-xl bg-[#788023] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#788023]/25 hover:bg-[#5e6419] transition-all">
              Get Started Free
            </button>
            {/* Mobile Menu Toggle */}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2 text-slate-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenu
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="lg:hidden border-t border-slate-100 py-4 space-y-1 animate-fade-in">
            {SITE_NAV_ITEMS.map(l => (
              <button key={l.key} onClick={() => { onNavigate(l.key); setMobileMenu(false); }}
                className={`block w-full text-left text-sm font-medium py-2.5 px-3 rounded-lg transition-colors ${
                  currentPage === l.key
                    ? "bg-[#788023]/10 text-[#788023]"
                    : "text-slate-600 hover:text-[#788023] hover:bg-slate-50"
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

// -------------------------------------------------------------------
// SITE FOOTER
// -------------------------------------------------------------------
function SiteFooter({ onNavigate }: { onNavigate: (page: SitePage) => void }) {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#788023] text-white font-bold text-lg">Y</div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white leading-tight">Yugam Consulting</span>
                <span className="text-[9px] font-medium text-slate-500 leading-tight tracking-wide uppercase">Lead Tracker CRM</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              Field-ready CRM for modern Indian sales teams. Manage leads, pipeline, invoicing, and analytics — all in one place.
            </p>
            <div className="flex gap-3 mt-4">
              {["LinkedIn", "Twitter", "GitHub"].map(s => (
                <span key={s} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer">{s}</span>
              ))}
            </div>
          </div>
          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Lead Management", page: "features" as SitePage },
                { label: "Pipeline Board", page: "pipeline" as SitePage },
                { label: "Smart Capture OCR", page: "smart-capture" as SitePage },
                { label: "Invoicing & GST", page: "invoicing" as SitePage },
                { label: "Analytics", page: "analytics" as SitePage },
                { label: "Pricing", page: "pricing" as SitePage },
              ].map(l => (
                <li key={l.label}><button onClick={() => onNavigate(l.page)} className="hover:text-white transition-colors">{l.label}</button></li>
              ))}
            </ul>
          </div>
          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              {["About Us", "Careers", "Blog", "Press"].map(l => (
                <li key={l}><span className="hover:text-white transition-colors cursor-pointer">{l}</span></li>
              ))}
              <li><button onClick={() => onNavigate("contact")} className="hover:text-white transition-colors">Contact</button></li>
            </ul>
          </div>
          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2.5 text-sm">
              {["Help Center", "Documentation", "API Reference", "Status Page", "Release Notes"].map(l => (
                <li key={l}><span className="hover:text-white transition-colors cursor-pointer">{l}</span></li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-slate-800 p-4">
              <div className="text-xs font-semibold text-white mb-1">Contact Us</div>
              <div className="text-xs text-slate-400">admin@oruyugam.com</div>
              <div className="text-xs text-slate-400 mt-1">+91 98765 43210</div>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} Yugam Consulting. All rights reserved.
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-white transition-colors cursor-pointer">Cookie Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// -------------------------------------------------------------------
// SITE LAYOUT (wraps every page)
// -------------------------------------------------------------------
export default function SiteLayout({ currentPage, onNavigate, onLogin, children }: {
  currentPage: SitePage; onNavigate: (page: SitePage) => void; onLogin: () => void; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white font-[Manrope,sans-serif]">
      <SiteNav currentPage={currentPage} onNavigate={onNavigate} onLogin={onLogin} />
      <main>{children}</main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
