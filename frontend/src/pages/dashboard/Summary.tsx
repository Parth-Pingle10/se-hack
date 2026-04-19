import { useEffect, useState, useCallback, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Chatbot } from "@/components/Chatbot";
import {
  FileText, Copy, Download, CheckCircle2, AlertTriangle, Eye, Loader2, Save, AlertCircle, Lightbulb,
  Bold, Italic, List, ListOrdered, Heading1, Heading2, BrainCircuit, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  streamSectionAnalysis,
  streamGenerateAuditMemo,
  fetchBenford,
  fetchAnomalies,
  fetchFuzzy,
  fetchReconciliation,
  fetchMonteCarlo,
  type BenfordResult,
  type AnomalyResult,
  type FuzzyResult,
  type ReconResult,
  type MonteCarloResult,
} from "@/lib/api";

const MEMO_KEY     = "ledgerspy:session:memo";
const INSIGHTS_KEY = "ledgerspy:session:insights";

// Analysis data states (Ollama via POST /analysis/section)
interface AiSections {
  findings:     string[];
  risks:        string[];
  observations: string[];
  /** Final executive conclusion paragraph from the "conclusion" section */
  conclusion:   string;
}

type SectionStreamBuf = {
  findings: string;
  risks: string;
  observations: string;
  conclusion: string;
};

const EMPTY_SECTION_STREAM: SectionStreamBuf = {
  findings: "",
  risks: "",
  observations: "",
  conclusion: "",
};

function parseSectionBullets(raw: string): string[] {
  const t = raw.trim();
  if (!t || /\[Error:/i.test(t)) return [];
  const bullets = t
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-•*]/.test(line))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (bullets.length) return bullets;
  return [t];
}


/** Plain-text audit memo → safe HTML for TipTap (backend uses plain text, not Markdown). */
function plainTextMemoToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return "<p><em>(Empty memo)</em></p>";
  return `<div class="memo-plaintext whitespace-pre-wrap text-sm leading-relaxed">${esc(t)}</div>`;
}

const memoHtml = `
<h1>LedgerSpy Audit Memo</h1>
<p><em>Period under review: November–December 2024</em></p>

<h2>Summary of Procedures</h2>
<p>LedgerSpy was used to perform digital analytics across the provided ledger and bank statement files. Procedures included Benford's Law conformity testing on leading digits, fuzzy string similarity matching across the vendor master file, statistical outlier detection on transaction amounts, and a line-by-line bank reconciliation.</p>

<h2>Key Findings</h2>
<p>The leading-digit distribution exhibits a material deviation at digits 7 and 9, with a chi-square statistic above the expected threshold. Nine vendor pairs were flagged with a similarity score above 0.70, several of which appear to be duplicate vendor records originating from inconsistent data entry. Six transactions were classified as anomalous, three of which fall in the high-risk band.</p>

<h2>Risk Highlights</h2>
<ul>
  <li>Single $184,320.55 disbursement to Acme Corp (≈14× historical mean).</li>
  <li>$49,999.00 payment to Globex Inc — just-below-threshold pattern.</li>
  <li>Vendor master modification preceded a payment to Wayne Enterprises by &lt;24 hours.</li>
</ul>

<h2>Recommendation</h2>
<p>Management should investigate the high-risk transactions identified, reconcile the flagged duplicate vendor records, and review controls around vendor master maintenance and payment approval thresholds.</p>

<p><em>Prepared with LedgerSpy v0.1</em></p>
`.trim();

// Loading skeleton for initial data load
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Global Risk Overview skeleton */}
      <div className="card-elevated overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse mt-2" />
          </div>
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5">
              <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Insight card skeleton */}
      <div className="card-elevated p-6">
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Explainable Insights skeleton */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Summary() {
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  // Analysis data
  const [benford,    setBenford]    = useState<BenfordResult    | null>(null);
  const [anomalies,  setAnomalies]  = useState<AnomalyResult    | null>(null);
  const [fuzzy,      setFuzzy]      = useState<FuzzyResult      | null>(null);
  const [recon,      setRecon]      = useState<ReconResult      | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);

  // LLM-generated section bullets
  const [aiSections,       setAiSections]       = useState<AiSections | null>(null);
  const [sectionsLoading,  setSectionsLoading]  = useState(false);
  const [sectionsError,    setSectionsError]    = useState<string | null>(null);
  const sectionBuffersRef = useRef<SectionStreamBuf>({ ...EMPTY_SECTION_STREAM });
  const [sectionStreamPreview, setSectionStreamPreview] = useState<SectionStreamBuf>({ ...EMPTY_SECTION_STREAM });
  const [memoStreamText, setMemoStreamText] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(MEMO_KEY)) {
      setGenerated(true);
      const savedInsights = localStorage.getItem(INSIGHTS_KEY);
      if (savedInsights) {
        try {
          const parsed = JSON.parse(savedInsights) as Partial<AiSections>;
          setAiSections({
            findings:     Array.isArray(parsed.findings)     ? parsed.findings     : [],
            risks:        Array.isArray(parsed.risks)        ? parsed.risks        : [],
            observations: Array.isArray(parsed.observations) ? parsed.observations : [],
            conclusion:   typeof parsed.conclusion === "string" ? parsed.conclusion : "",
          });
        } catch { /* ignore */ }
      }
    }
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setDataLoading(true);
    try {
      const [benfordData, anomalyData, fuzzyData, reconData, mcData] = await Promise.all([
        fetchBenford().catch(()   => null),
        fetchAnomalies().catch(() => null),
        fetchFuzzy().catch(()     => null),
        fetchReconciliation().catch(() => null),
        fetchMonteCarlo().catch(() => null),
      ]);
      setBenford(benfordData);
      setAnomalies(anomalyData);
      setFuzzy(fuzzyData);
      setRecon(reconData);
      setMonteCarlo(mcData);
      // Auto-generate AI sections once data is available
      generateAiSections(benfordData, anomalyData, fuzzyData, reconData, mcData);
    } catch (err) {
      console.error("Failed to load analysis data:", err);
    } finally {
      setDataLoading(false);
    }
  };

  // Token-stream /analysis/section/stream for each panel (parallel; feels responsive)
  const generateAiSections = useCallback(async (
    b: BenfordResult | null,
    a: AnomalyResult | null,
    f: FuzzyResult   | null,
    r: ReconResult   | null,
    mc: MonteCarloResult | null,
  ) => {
    setSectionsLoading(true);
    setSectionsError(null);
    sectionBuffersRef.current = { ...EMPTY_SECTION_STREAM };
    setSectionStreamPreview({ ...EMPTY_SECTION_STREAM });
    const payloads = [b, a, f, r, mc] as const;

    const runStream = (section: keyof SectionStreamBuf, apiSection: "findings" | "risks" | "observations" | "conclusion") =>
      new Promise<void>((resolve, reject) => {
        streamSectionAnalysis(
          apiSection,
          ...payloads,
          (chunk) => {
            sectionBuffersRef.current[section] += chunk;
            setSectionStreamPreview({ ...sectionBuffersRef.current });
          },
          () => resolve(),
          (err) => reject(new Error(err)),
        );
      });

    try {
      const settled = await Promise.allSettled([
        runStream("findings", "findings"),
        runStream("risks", "risks"),
        runStream("observations", "observations"),
        runStream("conclusion", "conclusion"),
      ]);

      const buf = sectionBuffersRef.current;
      const sections: AiSections = {
        findings:     parseSectionBullets(buf.findings),
        risks:        parseSectionBullets(buf.risks),
        observations: parseSectionBullets(buf.observations),
        conclusion:   buf.conclusion.trim(),
      };

      const failMsg = (i: number) => {
        const s = settled[i];
        if (s.status === "rejected") {
          return s.reason instanceof Error ? s.reason.message : String(s.reason);
        }
        return "";
      };

      const anyContent =
        sections.findings.length ||
        sections.risks.length ||
        sections.observations.length ||
        sections.conclusion.length;

      if (!anyContent) {
        setAiSections(null);
        setSectionsError(
          failMsg(0) || failMsg(1) || failMsg(2) || failMsg(3) || "Failed to generate AI insights",
        );
        return;
      }

      const partial = settled.some((s) => s.status === "rejected");
      setSectionsError(
        partial ? "One or more streams failed — ensure Ollama is running (try: ollama pull phi3:3.8b)." : null,
      );

      setAiSections(sections);
      localStorage.setItem(INSIGHTS_KEY, JSON.stringify(sections));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate AI insights";
      setSectionsError(msg);
    } finally {
      setSectionStreamPreview({ ...EMPTY_SECTION_STREAM });
      setSectionsLoading(false);
    }
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMemoStreamText("");
    let full = "";
    try {
      await streamGenerateAuditMemo(
        (chunk) => {
          full += chunk;
          setMemoStreamText(full);
        },
        () => {
          const t = full.trim();
          if (!t) {
            setError("Received an empty memo from the server.");
            toast.error("Empty memo");
            return;
          }
          const html = plainTextMemoToHtml(t);
          localStorage.setItem(MEMO_KEY, html);
          setGenerated(true);
          toast.success("Audit memo streamed from Ollama");
        },
        (message) => {
          setError(message);
          toast.error(message);
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate memo";
      setError(message);
      toast.error(message);
      console.error("Error generating memo:", err);
    } finally {
      setMemoStreamText("");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 stagger-children">
      {dataLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* <GlobalInsightPanel/> */}

          {/* <InsightCard insights={generatingInsights ? ["Generating insights from Ollama..."] : llmInsights?.summary?.length ? llmInsights.summary : generateInsights()} /> */}

          {/* Explainable Insights Section */}
          {/* <div className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-accent-soft">
                <Lightbulb className="h-4 w-4 text-accent" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Explainable Insights</h3>
            </div>
            <div className="space-y-3">
              {generatingInsights ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
                </div>
              ) : llmInsights && llmInsights.summary.length > 0 ? (
                <div className="space-y-3">
                  {llmInsights.summary.map((insight, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                      {insight}
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {benford && `Benford's Law analysis shows a ${benford.band.toLowerCase()} risk band with chi-square statistic of ${benford.chi_square.toFixed(2)}.`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fuzzy && fuzzy.flagged_pairs > 0 && `Fuzzy matching identified ${fuzzy.flagged_pairs} vendor pairs with similarity scores ≥0.70, indicating possible duplicate master records.`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {anomalies && `Statistical isolation detected ${anomalies.total_flagged} anomalies using Isolation Forest with ${((anomalies.total_flagged / anomalies.total_records) * 100).toFixed(2)}% contamination threshold.`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recon && `Reconciliation analysis achieved ${((recon.matched / recon.total) * 100).toFixed(1)}% match rate; remaining ${recon.unmatched} item(s) require attention.`}
                  </p>
                </>
              )}
            </div>
          </div> */}

          {/* Findings sections — AI-powered (Benford + anomalies + fuzzy + recon + MC context) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section
              icon={CheckCircle2} tone="text-success" title="Key Findings"
              items={aiSections?.findings ?? []}
              loading={sectionsLoading}
              streamText={sectionsLoading ? sectionStreamPreview.findings : undefined}
              error={!sectionsLoading && !aiSections ? sectionsError : null}
            />
            <Section
              icon={AlertTriangle} tone="text-warning" title="Risk Highlights"
              items={aiSections?.risks ?? []}
              loading={sectionsLoading}
              streamText={sectionsLoading ? sectionStreamPreview.risks : undefined}
              error={!sectionsLoading && !aiSections ? sectionsError : null}
            />
            <Section
              icon={Eye} tone="text-accent" title="Observations"
              items={aiSections?.observations ?? []}
              loading={sectionsLoading}
              streamText={sectionsLoading ? sectionStreamPreview.observations : undefined}
              error={!sectionsLoading && !aiSections ? sectionsError : null}
            />
          </div>

          {/* Final conclusion — same analysis payload, dedicated Ollama prompt */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-accent-soft">
                <Lightbulb className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">Executive conclusion</h3>
                {sectionsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {((!sectionsLoading && (aiSections?.conclusion?.length ?? 0) > 0) || (sectionsLoading && sectionStreamPreview.conclusion)) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5">
                    <BrainCircuit className="h-2.5 w-2.5" /> Ollama stream
                  </span>
                )}
              </div>
            </div>
            {sectionsLoading && sectionStreamPreview.conclusion ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-accent/60 pl-3">
                {sectionStreamPreview.conclusion}
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent/70 animate-pulse align-middle rounded-sm" aria-hidden />
              </p>
            ) : sectionsLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
                <p className="text-[11px] text-muted-foreground">Streaming conclusion from Benford, anomaly, fuzzy, and reconciliation context…</p>
              </div>
            ) : !aiSections?.conclusion ? (
              <p className="text-xs text-muted-foreground italic">
                {sectionsError && !aiSections
                  ? "Could not load conclusion."
                  : "Upload ledger and bank data and open this page to generate the final conclusion."}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {aiSections.conclusion}
              </p>
            )}
          </div>

          {/* Retry / partial warning */}
          {sectionsError && !sectionsLoading && (
            <div
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                aiSections ? "border-amber-500/25 bg-amber-500/5" : "border-destructive/20 bg-destructive/5"
              }`}
            >
              <AlertCircle className={`h-4 w-4 shrink-0 ${aiSections ? "text-amber-600" : "text-destructive"}`} />
              <p className={`text-sm flex-1 ${aiSections ? "text-amber-800 dark:text-amber-200" : "text-destructive"}`}>
                {sectionsError}
              </p>
              <Button
                variant="outline" size="sm"
                onClick={() => generateAiSections(benford, anomalies, fuzzy, recon, monteCarlo)}
              >
                Retry AI analysis
              </Button>
            </div>
          )}
        </>
      )}

      {/* Audit memo editor */}
      <div className="card-elevated p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Audit Memo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate, edit, and export the narrative summary powered by AI.
            </p>
          </div>
          {!generated && (
            <Button onClick={generate} disabled={loading} className="gap-2 rounded-xl shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate Audit Memo"}
            </Button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Generation Failed</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Ensure Ollama is running at <code className="text-[10px]">http://localhost:11434</code> with{" "}
                <code className="text-[10px]">phi3:3.8b</code> (default) or set <code className="text-[10px]">OLLAMA_MODEL</code>.
              </p>
            </div>
          </div>
        )}

        {loading && memoStreamText && (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 max-h-[240px] overflow-auto">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Live stream</p>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{memoStreamText}</pre>
          </div>
        )}

        {generated && <MemoEditor />}
      </div>
    </div>
  );
}

function MemoEditor() {
  const initial = (typeof window !== "undefined" && localStorage.getItem(MEMO_KEY)) || memoHtml;
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initial,
    editorProps: {
      attributes: {
        class: "prose-memo focus:outline-none min-h-[420px]",
      },
    },
  });

  if (!editor) return null;

  const save = () => {
    localStorage.setItem(MEMO_KEY, editor.getHTML());
    toast.success("Memo saved");
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(editor.getText());
    toast.success("Memo copied to clipboard");
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineHeight = 14; // pixels
    let yPosition = margin;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LedgerSpy Audit Memo", margin, yPosition);
    yPosition += 24;

    // Content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    // Get HTML content and convert to text with formatting
    const htmlContent = editor.getHTML();
    
    // Parse HTML to extract text with proper formatting
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    
    const processNode = (node: any): string[] => {
      const lines: string[] = [];
      
      if (node.nodeType === 3) { // Text node
        const text = node.textContent.trim();
        if (text) {
          lines.push(text);
        }
      } else if (node.nodeType === 1) { // Element node
        const tag = node.tagName.toLowerCase();
        
        if (tag === "h1" || tag === "h2" || tag === "h3") {
          if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
          lines.push(node.textContent.trim());
          lines.push("");
        } else if (tag === "p") {
          const text = node.textContent.trim();
          if (text) {
            lines.push(text);
            lines.push("");
          }
        } else if (tag === "li") {
          const text = node.textContent.trim();
          if (text) {
            lines.push("• " + text);
          }
        } else if (tag === "ul" || tag === "ol") {
          node.childNodes.forEach((child: any) => {
            lines.push(...processNode(child));
          });
          lines.push("");
        } else if (tag === "br") {
          lines.push("");
        } else {
          node.childNodes.forEach((child: any) => {
            lines.push(...processNode(child));
          });
        }
      }
      
      return lines;
    };

    const contentLines = processNode(tempDiv);
    
    // Add content to PDF with page breaks
    contentLines.forEach((line: string) => {
      if (!line) {
        yPosition += lineHeight * 0.5;
      } else {
        // Check if it's a heading (simple heuristic)
        const isHeading = line.length > 0 && line.length < 60 && /^[A-Z][A-Za-z\s&]+$/.test(line);
        
        if (isHeading) {
          if (yPosition > margin + 20) yPosition += 8;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
        }

        // Split long lines to fit width
        const wrappedLines = doc.splitTextToSize(line, width);
        
        // Check if we need a new page
        const requiredHeight = wrappedLines.length * lineHeight;
        if (yPosition + requiredHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        // Draw the lines
        wrappedLines.forEach((wrappedLine: string) => {
          doc.text(wrappedLine, margin, yPosition);
          yPosition += lineHeight;
        });
      }
    });

    doc.save("ledgerspy-audit-memo.pdf");
    setPdfDownloaded(true);
    toast.success("Audit memo downloaded successfully");
  };

  if (pdfDownloaded) {
    return (
      <div className="mt-6 fade-in">
        <div className="rounded-xl border border-border bg-success/5 p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Audit Memo Saved</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Your audit memo has been successfully downloaded as <span className="font-medium">ledgerspy-audit-memo.pdf</span>
          </p>
          <Button onClick={() => setPdfDownloaded(false)} variant="outline" className="gap-2 rounded-lg">
            <FileText className="h-4 w-4" /> Back to editing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 fade-in">
      <Toolbar editor={editor} />
      <div className="rounded-b-xl border border-t-0 border-border bg-background px-7 py-6 max-h-[520px] overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={copyText} className="gap-2 rounded-lg">
          <Copy className="h-3.5 w-3.5" /> Copy text
        </Button>
        <Button variant="outline" size="sm" onClick={save} className="gap-2 rounded-lg">
          <Save className="h-3.5 w-3.5" /> Save edited version
        </Button>
        <Button size="sm" onClick={downloadPdf} className="gap-2 rounded-lg shadow-sm">
          <Download className="h-3.5 w-3.5" /> Download as PDF
        </Button>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = "h-8 w-8 p-0 rounded-md data-[state=on]:bg-accent/10 data-[state=on]:text-accent";
  return (
    <div className="flex items-center gap-1 border border-b-0 border-border rounded-t-xl bg-muted/30 px-3 py-2">
      <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn} aria-label="Heading 1">
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn} aria-label="Heading 2">
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Separator orientation="vertical" className="h-5 mx-1.5" />
      <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} className={btn} aria-label="Bold">
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} className={btn} aria-label="Italic">
        <Italic className="h-4 w-4" />
      </Toggle>
      <Separator orientation="vertical" className="h-5 mx-1.5" />
      <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} className={btn} aria-label="Bullet list">
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} className={btn} aria-label="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </Toggle>
    </div>
  );
}

function Section({
  icon: Icon, tone, title, items, loading = false, streamText, error = null,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  items: string[];
  loading?: boolean;
  /** Live token stream from Ollama while `loading` */
  streamText?: string;
  error?: string | null;
}) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
          tone === "text-success" ? "bg-success-soft" :
          tone === "text-warning" ? "bg-warning-soft" :
          "bg-accent-soft"
        }`}>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {!loading && items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5">
              <BrainCircuit className="h-2.5 w-2.5" /> AI
            </span>
          )}
        </div>
      </div>
      {loading && streamText ? (
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-accent/50 pl-3 min-h-[4.5rem]">
          {streamText}
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent/70 animate-pulse align-middle rounded-sm" aria-hidden />
        </div>
      ) : loading ? (
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
          <p className="text-[11px] text-muted-foreground">Connecting to Ollama…</p>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Upload data to generate AI analysis.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t, i) => (
            <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2.5">
              <span className="text-muted-foreground/40 mt-1 text-xs">●</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Chatbot wired into Summary page ─────────────────────────────────────────
// (Also mounted globally in DashboardLayout — this is a backup reference)
export { Chatbot };
