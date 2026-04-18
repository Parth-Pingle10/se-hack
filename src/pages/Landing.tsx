import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, BarChart3, Search, GitCompare } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen landing-bg relative overflow-hidden flex flex-col items-center justify-center">
      {/* Subtle grid pattern overlay */}
      <div className="landing-grid absolute inset-0 pointer-events-none" />

      {/* Decorative orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, hsl(174 55% 38%), transparent 70%)" }} />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, hsl(224 50% 24%), transparent 70%)" }} />

      {/* Main content */}
      <div className={`relative z-10 flex flex-col items-center text-center px-6 transition-all duration-1000 ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}>
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-1.5 shadow-sm">
          <Shield className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-muted-foreground tracking-wide">
            Offline-First · Fully Private · Audit-Ready
          </span>
        </div>

        {/* Logo */}
        <Logo size="lg" />

        {/* Tagline */}
        <p className="mt-5 text-base text-muted-foreground max-w-md leading-relaxed">
          Forensic Financial Intelligence for Auditors
        </p>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { icon: BarChart3, label: "Benford Analysis" },
            { icon: GitCompare, label: "Fuzzy Matching" },
            { icon: Search, label: "Anomaly Detection" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-3.5 py-2 shadow-sm">
              <Icon className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => navigate("/upload")}
          size="lg"
          className="mt-10 gap-2.5 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          Start Analysis
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="mt-4 text-[11px] text-muted-foreground/70">
          No signup required · Data never leaves your browser
        </p>
      </div>

      {/* Version stamp */}
      <div className="absolute bottom-6 text-[11px] text-muted-foreground/40">
        LedgerSpy v0.1
      </div>
    </div>
  );
}
