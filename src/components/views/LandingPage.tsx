// =====================================================================
// LANDING PAGE — Multi-page marketing site router
// Pages: Home, Features, Pipeline, Smart Capture, Invoicing, Analytics, Pricing, Contact
// =====================================================================

import { useState, useEffect } from "react";
import SiteLayout, { SitePage } from "../landing/SiteLayout";
import HomePage from "../landing/HomePage";
import FeaturesPage from "../landing/FeaturesPage";
import PipelinePage from "../landing/PipelinePage";
import SmartCapturePage from "../landing/SmartCapturePage";
import InvoicingPage from "../landing/InvoicingPage";
import AnalyticsPage from "../landing/AnalyticsPage";
import PricingPage from "../landing/PricingPage";
import ContactPage from "../landing/ContactPage";

export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [currentPage, setCurrentPage] = useState<SitePage>("home");

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  const navigate = (page: string) => setCurrentPage(page as SitePage);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage onLogin={onLogin} onNavigate={navigate} />;
      case "features":
        return <FeaturesPage onLogin={onLogin} />;
      case "pipeline":
        return <PipelinePage onLogin={onLogin} />;
      case "smart-capture":
        return <SmartCapturePage onLogin={onLogin} />;
      case "invoicing":
        return <InvoicingPage onLogin={onLogin} />;
      case "analytics":
        return <AnalyticsPage onLogin={onLogin} />;
      case "pricing":
        return <PricingPage onLogin={onLogin} />;
      case "contact":
        return <ContactPage onLogin={onLogin} />;
      default:
        return <HomePage onLogin={onLogin} onNavigate={(p: string) => navigate(p)} />;
    }
  };

  return (
    <SiteLayout currentPage={currentPage} onNavigate={navigate} onLogin={onLogin}>
      {renderPage()}
    </SiteLayout>
  );
}
