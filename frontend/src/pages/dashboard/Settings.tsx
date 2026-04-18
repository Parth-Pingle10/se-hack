import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSettings, defaultSettings, type LedgerSpySettings } from "@/lib/settings";
import { RotateCcw, Save } from "lucide-react";

export default function Settings() {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState<LedgerSpySettings>(settings);

  const setMatch    = (k: keyof LedgerSpySettings["match"],   v: number)  => setDraft({ ...draft, match:    { ...draft.match,    [k]: v } });
  const setRisk     = (k: keyof LedgerSpySettings["risk"],    v: number)  => setDraft({ ...draft, risk:     { ...draft.risk,     [k]: v } });
  const setModule   = (k: keyof LedgerSpySettings["modules"], v: boolean) => setDraft({ ...draft, modules:  { ...draft.modules,  [k]: v } });

  const onSave = () => {
    // Keep partial < exact for sane thresholds.
    const cleaned: LedgerSpySettings = {
      ...draft,
      match: {
        exactMin:   Math.max(draft.match.partialMin + 1, draft.match.exactMin),
        partialMin: Math.min(draft.match.partialMin, draft.match.exactMin - 1),
      },
    };
    update(cleaned);
    setDraft(cleaned);
    toast.success("Settings Applied");
  };

  const onReset = () => {
    setDraft(defaultSettings);
  };

  return (
    <div className="space-y-6 max-w-4xl stagger-children">
      {/* Matching Thresholds */}
      <Section
        title="Matching Thresholds"
        subtitle="Define the similarity bands used when comparing vendors and transactions."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThresholdRow
            label="Exact Match (≥)"
            description="Pairs scoring above this threshold are treated as confident matches."
            value={draft.match.exactMin}
            onChange={(v) => setMatch("exactMin", v)}
            min={50} max={100} suffix="%"
          />
          <ThresholdRow
            label="Partial Match (≥)"
            description="Pairs above this threshold are flagged for analyst review."
            value={draft.match.partialMin}
            onChange={(v) => setMatch("partialMin", v)}
            min={30} max={99} suffix="%"
          />
        </div>
        <div className="mt-5 rounded-xl bg-muted/30 border border-border px-5 py-3.5 text-xs text-muted-foreground">
          Current bands:
          <span className="ml-2 font-bold text-foreground">{draft.match.exactMin}–100% Match</span>
          <span className="mx-2 text-border">·</span>
          <span className="font-bold text-foreground">{draft.match.partialMin}–{draft.match.exactMin - 1}% Partial</span>
          <span className="mx-2 text-border">·</span>
          <span className="font-bold text-foreground">&lt;{draft.match.partialMin}% Flag</span>
        </div>
      </Section>

      {/* Risk Sensitivity */}
      <Section
        title="Risk Sensitivity"
        subtitle="Tune how aggressively the analyzers surface anomalies."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThresholdRow
            label="Outlier detection sensitivity"
            description="Higher values surface more borderline transactions."
            value={draft.risk.outlier}
            onChange={(v) => setRisk("outlier", v)}
            min={0} max={100} suffix=""
          />
          <ThresholdRow
            label="Benford deviation tolerance"
            description="Lower values flag smaller deviations from expected distribution."
            value={draft.risk.benfordTolerance}
            onChange={(v) => setRisk("benfordTolerance", v)}
            min={1} max={50} suffix="%"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-semibold text-foreground">Transaction amount anomaly threshold</Label>
            <p className="text-xs text-muted-foreground mt-1">Single-transaction value above which the row is auto-flagged.</p>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="text-sm text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                min={0}
                value={draft.risk.amountThreshold}
                onChange={(e) => setRisk("amountThreshold", Number(e.target.value) || 0)}
                className="h-10 max-w-[180px] text-sm tabular-nums rounded-lg"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Module Toggles */}
      <Section
        title="Active Analyzers"
        subtitle="Enable or disable specific analytical modules for this engagement."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleRow label="Benford Analysis"      checked={draft.modules.benford}        onChange={(v) => setModule("benford", v)} />
          <ToggleRow label="Fuzzy Matching"        checked={draft.modules.fuzzy}          onChange={(v) => setModule("fuzzy", v)} />
          <ToggleRow label="Anomaly Detection"     checked={draft.modules.anomalies}      onChange={(v) => setModule("anomalies", v)} />
          <ToggleRow label="Reconciliation Checks" checked={draft.modules.reconciliation} onChange={(v) => setModule("reconciliation", v)} />
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-background/80 backdrop-blur-sm py-4 -mx-1 px-1 rounded-xl">
        <Button variant="outline" onClick={onReset} className="gap-2 rounded-lg">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
        </Button>
        <Button onClick={onSave} className="gap-2 rounded-lg shadow-sm">
          <Save className="h-3.5 w-3.5" /> Save Settings
        </Button>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card-elevated">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function ThresholdRow({
  label, description, value, onChange, min, max, suffix,
}: {
  label: string; description: string; value: number; onChange: (n: number) => void;
  min: number; max: number; suffix: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <span className="text-sm font-bold tabular-nums text-accent">{value}{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="mt-4"
      />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background px-5 py-4 transition-colors duration-200 hover:bg-muted/30">
      <Label className="text-sm font-semibold text-foreground cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
