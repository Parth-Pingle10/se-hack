import { useState, useRef, useCallback } from "react";
import { BrainCircuit, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { streamInsight } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AiInsightBlockProps {
  endpoint: string;       // e.g. "/insights/benford"
  label?: string;
  className?: string;
  autoExpand?: boolean;
}

/**
 * Reusable component that streams AI-generated insights from a backend endpoint.
 * Shows a button → streams tokens live → displays final insight text.
 */
export function AiInsightBlock({
  endpoint,
  label = "Generate AI Insight",
  className,
  autoExpand = true,
}: AiInsightBlockProps) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef(false);

  const generate = useCallback(async () => {
    setStreaming(true);
    setText("");
    setError(null);
    setExpanded(autoExpand);
    abortRef.current = false;
    let accumulated = "";

    await streamInsight(
      endpoint,
      (token) => {
        if (abortRef.current) return;
        accumulated += token;
        setText(accumulated);
      },
      () => { setStreaming(false); },
      (err) => { setStreaming(false); setError(err); }
    );
  }, [endpoint, autoExpand]);

  const hasContent = text.length > 0;

  return (
    <div className={cn("card-elevated border border-border mt-4", className)}>
      {/* Header row */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-accent/[0.03]">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <BrainCircuit className="h-3.5 w-3.5 text-accent" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            AI Explainable Insight
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && !streaming && (
            <button onClick={() => setExpanded((e) => !e)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          {hasContent && !streaming && (
            <button onClick={generate}
              className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
          )}
          {!hasContent && !streaming && (
            <button onClick={generate}
              className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent/80 transition-colors px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/15">
              <BrainCircuit className="h-3.5 w-3.5" />
              {label}
            </button>
          )}
          {streaming && (
            <span className="flex items-center gap-1.5 text-xs text-accent font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating…
            </span>
          )}
        </div>
      </div>

      {/* Content area */}
      {error && (
        <div className="px-5 py-3 text-xs text-destructive bg-destructive/5">
          ⚠ {error}
        </div>
      )}

      {(streaming || (hasContent && expanded)) && (
        <div className="px-5 py-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono bg-muted/10 max-h-72 overflow-y-auto">
          {text}
          {streaming && (
            <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  );
}
