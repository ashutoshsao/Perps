import { useEffect } from "react";
import { LandingHeader } from "../components/landing/LandingHeader";
import { Hero } from "../components/landing/Hero";
import { TechnicalSection } from "../components/landing/TechnicalSection";
import { LandingFooter } from "../components/landing/LandingFooter";

export function LandingPage() {
  useEffect(() => {
    document.title = "Nebula — Perpetual Futures Exchange";
  }, []);

  return (
    <div className="bg-grain min-h-screen bg-bg text-text">
      <LandingHeader />
      <Hero />
      <TechnicalSection />
      <LandingFooter />
    </div>
  );
}
