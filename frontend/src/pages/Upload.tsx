import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { UploadZone } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Settings2, History } from "lucide-react";

type Status = "idle" | "checking" | "ready";
type SettingsChoice = "previous" | "reconfigure" | null;
const SETTINGS_KEY = "ledgerspy:settings";

export default function Upload() {
  const navigate = useNavigate();
  const [ledger, setLedger] = useState<File | null>(null);
  const [bank, setBank] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<SettingsChoice>(null);

  const hasPreviousSettings = typeof window !== "undefined" && !!localStorage.getItem(SETTINGS_KEY);
  const canCheck = ledger && bank && status === "idle";

  const runCheck = () => {
    setStatus("checking");
    setScore(0);
    const target = 82;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 1400);
      setScore(Math.round(p * target));
      if (p < 1) requestAnimationFrame(tick);
      else setStatus("ready");
    };
    requestAnimationFrame(tick);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-6 sm:px-10 sticky top-0 z-20">
        <Logo />
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-2xl fade-in-up">
          {/* Step header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/8 px-3 py-1 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Step 1 of 2</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Upload Financial Data</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Provide the ledger and corresponding bank statement to begin the readiness check.
            </p>
          </div>

          {/* Upload zones */}
          <div className="space-y-4">
            <UploadZone label="Upload Ledger File"     description="Trial balance or general ledger export — CSV, XLSX, or PDF." onFile={setLedger} />
            <UploadZone label="Upload Bank Statement"  description="Period-matched bank statement file — CSV, XLSX, or PDF."      onFile={setBank} />
          </div>

          {/* Readiness check card */}
          {status !== "idle" && (
            <div className="mt-8 card-elevated p-6 fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Readiness Check</h3>
                {status === "checking" ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Scanning…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-success font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2.5 mb-3">
                <span className="text-4xl font-bold tabular-nums text-foreground">{score}%</span>
                <span className="text-xs text-muted-foreground">readiness score</span>
              </div>

              {/* Progress bar */}
              <div className="progress-premium">
                <div className="progress-fill" style={{ width: `${score}%` }} />
              </div>

              {status === "ready" && (
                <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs stagger-children">
                  <Indicator label="Missing values"  value="3"  tone="warn" />
                  <Indicator label="Duplicate rows"  value="2"  tone="warn" />
                  <Indicator label="Format issues"   value="0"  tone="ok"   />
                </ul>
              )}
            </div>
          )}

          {/* Settings choice */}
          {status === "ready" && (
            <div className="mt-6 card-elevated p-6 fade-in">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/8 px-3 py-1 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Step 2 of 2</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">Analysis Settings</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Choose how thresholds and risk sensitivity should be configured for this session.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => hasPreviousSettings && setChoice("previous")}
                  disabled={!hasPreviousSettings}
                  className={`text-left rounded-xl border-2 p-5 transition-all duration-250 disabled:opacity-40 disabled:cursor-not-allowed ${
                    choice === "previous"
                      ? "border-accent bg-accent/5 shadow-sm"
                      : "border-border bg-background hover:border-accent/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <History className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Use previous settings</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasPreviousSettings
                      ? "Apply the thresholds saved from your last session."
                      : "No saved settings found from a previous session."}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setChoice("reconfigure")}
                  className={`text-left rounded-xl border-2 p-5 transition-all duration-250 ${
                    choice === "reconfigure"
                      ? "border-accent bg-accent/5 shadow-sm"
                      : "border-border bg-background hover:border-accent/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Settings2 className="h-4 w-4 text-accent" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Reconfigure</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Adjust matching thresholds and risk sensitivity before running.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="mt-8 flex justify-end">
            {status === "ready" ? (
              <Button
                onClick={() =>
                  navigate(choice === "reconfigure" ? "/dashboard/settings" : "/dashboard/benford")
                }
                disabled={!choice}
                className="gap-2 rounded-xl px-6 shadow-sm hover:shadow-md transition-all duration-250"
              >
                {choice === "reconfigure" ? "Configure Settings" : "Proceed to Dashboard"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={runCheck} disabled={!canCheck} className="rounded-xl px-6 shadow-sm hover:shadow-md transition-all duration-250">
                {status === "checking" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking…</>
                ) : "Check Readiness"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 font-bold ${tone === "warn" ? "text-warning" : "text-success"}`}>
        {tone === "warn" ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
        {value}
      </span>
    </li>
  );
}
