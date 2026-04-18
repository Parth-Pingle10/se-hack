// LedgerSpy analyst settings — persisted to localStorage.
import { useEffect, useState, useCallback } from "react";

export const SETTINGS_KEY = "ledgerspy:settings";

export type LedgerSpySettings = {
  match: {
    exactMin: number;   // 0..100
    partialMin: number; // 0..100
  };
  risk: {
    outlier: number;          // 0..100 (sensitivity)
    benfordTolerance: number; // 0..100
    amountThreshold: number;  // currency
  };
  modules: {
    benford: boolean;
    fuzzy: boolean;
    anomalies: boolean;
    reconciliation: boolean;
    riskNetwork: boolean;
    monteCarlo: boolean;
  };
};

export const defaultSettings: LedgerSpySettings = {
  match:   { exactMin: 90, partialMin: 70 },
  risk:    { outlier: 65, benfordTolerance: 15, amountThreshold: 50000 },
  modules: { benford: true, fuzzy: true, anomalies: true, reconciliation: true, riskNetwork: true, monteCarlo: true },
};

export function loadSettings(): LedgerSpySettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed,
      match:   { ...defaultSettings.match,   ...(parsed.match   ?? {}) },
      risk:    { ...defaultSettings.risk,    ...(parsed.risk    ?? {}) },
      modules: { ...defaultSettings.modules, ...(parsed.modules ?? {}) },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: LedgerSpySettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("ledgerspy:settings-updated"));
}

export function useSettings() {
  const [settings, setSettings] = useState<LedgerSpySettings>(loadSettings);

  useEffect(() => {
    const refresh = () => setSettings(loadSettings());
    window.addEventListener("ledgerspy:settings-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ledgerspy:settings-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const update = useCallback((s: LedgerSpySettings) => {
    saveSettings(s);
    setSettings(s);
  }, []);

  return { settings, update };
}
