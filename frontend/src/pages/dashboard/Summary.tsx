import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { InsightCard } from "@/components/InsightCard";
import { GlobalInsightPanel } from "@/components/GlobalInsightPanel";
import {
  FileText, Copy, Download, CheckCircle2, AlertTriangle, Eye, Loader2, Save, AlertCircle, Lightbulb,
  Bold, Italic, List, ListOrdered, Heading1, Heading2, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { 
  generateAuditMemo, 
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

const MEMO_KEY = "ledgerspy:session:memo";
const INSIGHTS_KEY = "ledgerspy:session:insights";

// Extract structured insights from Ollama-generated markdown memo
function extractInsightsFromMemo(markdown: string): {
  summary: string[];
  findings: string[];
  risks: string[];
  recommendations: string[];
} {
  const sections = {
    summary: [] as string[],
    findings: [] as string[],
    risks: [] as string[],
    recommendations: [] as string[],
  };

  // Split by headers
  const parts = markdown.split(/^##\s+/m);
  
  parts.forEach((part) => {
    const lines = part.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    
    const header = lines[0].toLowerCase();
    const content = lines.slice(1).filter(l => l.trim() && !l.startsWith('-'));
    
    if (header.includes('summary') || header.includes('procedures')) {
      sections.summary = content.slice(0, 3);
    } else if (header.includes('finding')) {
      sections.findings = content
        .filter(l => l.startsWith('-') || l.startsWith('•'))
        .map(l => l.replace(/^[-•]\s*/, ''))
        .slice(0, 5);
    } else if (header.includes('risk') || header.includes('highlight')) {
      sections.risks = content
        .filter(l => l.startsWith('-') || l.startsWith('•'))
        .map(l => l.replace(/^[-•]\s*/, ''))
        .slice(0, 5);
    } else if (header.includes('recommendation')) {
      sections.recommendations = content
        .filter(l => l.startsWith('-') || l.startsWith('•'))
        .map(l => l.replace(/^[-•]\s*/, ''))
        .slice(0, 3);
    }
  });

  return sections;
}
function markdownToHtml(markdown: string): string {
  let html = markdown
    // Escape existing HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap paragraphs
  if (!html.startsWith("<h")) {
    html = `<p>${html}</p>`;
  }

  // Fix paragraph wrapping
  html = html.replace(/(<h[12]>)/g, "</p>$1").replace(/(<\/h[12]>)/g, "$1<p>");
  html = html.replace(/<p><\/p>/g, "");

  return html;
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
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  // Analysis data states
  const [benford, setBenford] = useState<BenfordResult | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult | null>(null);
  const [fuzzy, setFuzzy] = useState<FuzzyResult | null>(null);
  const [recon, setRecon] = useState<ReconResult | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  
  // LLM-generated insights
  const [llmInsights, setLlmInsights] = useState<{
    summary: string[];
    findings: string[];
    risks: string[];
    recommendations: string[];
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(MEMO_KEY)) {
      setGenerated(true);
      const savedInsights = localStorage.getItem(INSIGHTS_KEY);
      if (savedInsights) {
        try {
          setLlmInsights(JSON.parse(savedInsights));
        } catch {
          // Ignore parse errors
        }
      }
    }
    // Fetch all analysis data on mount
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setDataLoading(true);
    try {
      const [benfordData, anomalyData, fuzzyData, reconData, mcData] = await Promise.all([
        fetchBenford().catch(() => null),
        fetchAnomalies().catch(() => null),
        fetchFuzzy().catch(() => null),
        fetchReconciliation().catch(() => null),
        fetchMonteCarlo().catch(() => null),
      ]);
      
      setBenford(benfordData);
      setAnomalies(anomalyData);
      setFuzzy(fuzzyData);
      setRecon(reconData);
      setMonteCarlo(mcData);
    } catch (err) {
      console.error("Failed to load analysis data:", err);
    } finally {
      setDataLoading(false);
    }
  };

  // Generate dynamic insights based on fetched data
  const generateInsights = (): string[] => {
    const insights: string[] = [];
    
    if (anomalies && anomalies.total_flagged > 0) {
      const pct = ((anomalies.total_flagged / anomalies.total_records) * 100).toFixed(1);
      insights.push(`${anomalies.total_flagged} anomalous transactions detected (${pct}% of ledger)`);
    }
    
    if (fuzzy && fuzzy.flagged_pairs > 0) {
      insights.push(`${fuzzy.flagged_pairs} vendor name similarity matches flagged (potential duplicates)`);
    }
    
    if (recon) {
      const matchPct = ((recon.matched / recon.total) * 100).toFixed(1);
      insights.push(`Bank reconciliation: ${matchPct}% matched, ${recon.unmatched} unmatched items`);
    }
    
    if (benford && benford.significant_digits.length > 0) {
      insights.push(`Benford's Law: ${benford.significant_digits.length} digits deviate significantly`);
    }
    
    if (monteCarlo && monteCarlo.survival_rate < 95) {
      insights.push(`Cash flow projection: ${(monteCarlo.survival_rate).toFixed(1)}% survival rate over ${monteCarlo.chart_data.length} months`);
    }
    
    return insights.length > 0 ? insights : ["Analyzing audit data..."];
  };

  // Generate dynamic findings from data
  const generateFindings = (): string[] => {
    const findings: string[] = [];
    
    if (benford) {
      const score = benford.benford_score;
      findings.push(`Benford's Law risk score: ${score}/100 (${benford.band} band)`);
      if (benford.significant_digits.length > 0) {
        const digits = benford.significant_digits.slice(0, 3).map(d => d.digit).join(", ");
        findings.push(`Significant deviations detected in digits: ${digits}`);
      }
    }
    
    if (fuzzy && fuzzy.flagged_pairs > 0) {
      findings.push(`${fuzzy.flagged_pairs} vendor pair(s) with similarity > 0.70 identified`);
      if (fuzzy.vendor_clusters.length > 0) {
        findings.push(`${fuzzy.vendor_clusters.length} vendor cluster(s) suggest potential master data issues`);
      }
    }
    
    if (anomalies && anomalies.anomalies.length > 0) {
      const topAnomaly = anomalies.anomalies[0];
      findings.push(`Highest anomaly risk: ${topAnomaly.vendor} on ${topAnomaly.date} ($${topAnomaly.amount.toFixed(2)})`);
    }
    
    return findings.length > 0 ? findings : ["Analyzing findings..."];
  };

  // Generate dynamic risks from data
  const generateRisks = (): string[] => {
    const risks: string[] = [];
    
    if (anomalies && anomalies.anomalies.length > 0) {
      const highRiskCount = anomalies.anomalies.filter(a => a.risk > 0.7).length;
      if (highRiskCount > 0) {
        risks.push(`${highRiskCount} transaction(s) classified as high-risk (risk > 0.7)`);
      }
      const topAmounts = anomalies.anomalies
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 2)
        .map(a => `$${a.amount.toFixed(2)} to ${a.vendor}`)
        .join("; ");
      if (topAmounts) risks.push(`Highest exposure amounts: ${topAmounts}`);
    }
    
    if (recon && recon.unmatched > 0) {
      risks.push(`${recon.unmatched} unmatched reconciliation items requiring investigation`);
    }
    
    if (benford && benford.benford_score > 60) {
      risks.push(`Elevated Benford deviation pressure - possible digit manipulation patterns`);
    }
    
    if (monteCarlo && monteCarlo.insolvency_risk > 10) {
      risks.push(`Cash flow stress test indicates ${monteCarlo.insolvency_risk.toFixed(1)}% insolvency risk`);
    }
    
    return risks.length > 0 ? risks : ["Analyzing risks..."];
  };

  // Generate dynamic observations from data
  const generateObservations = (): string[] => {
    const obs: string[] = [];
    
    if (recon) {
      obs.push(`Overall ledger-to-bank alignment: ${((recon.matched / recon.total) * 100).toFixed(1)}% fully matched`);
    }
    
    if (fuzzy) {
      obs.push(`Vendor master data quality: ${fuzzy.total_vendors} total vendors analyzed`);
    }
    
    if (anomalies) {
      const avgRisk = (anomalies.anomalies.reduce((s, a) => s + a.risk, 0) / anomalies.anomalies.length).toFixed(2);
      obs.push(`Average transaction anomaly score: ${avgRisk} across ${anomalies.total_records} records`);
    }
    
    obs.push(`Audit scope: Multiple forensic procedures including Benford, fuzzy matching, and reconciliation`);
    
    return obs.length > 0 ? obs : ["Analysis data available"];
  };

  const generate = async () => {
    setLoading(true);
    setGeneratingInsights(true);
    setError(null);
    try {
      const result = await generateAuditMemo();
      
      // Extract insights from the memo
      const insights = extractInsightsFromMemo(result.memo);
      setLlmInsights(insights);
      localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
      
      // Convert markdown to HTML for the editor
      const html = markdownToHtml(result.memo);
      localStorage.setItem(MEMO_KEY, html);
      setGenerated(true);
      toast.success("Audit memo generated successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate memo";
      setError(message);
      toast.error(message);
      console.error("Error generating memo:", err);
    } finally {
      setLoading(false);
      setGeneratingInsights(false);
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

          {/* Findings sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section icon={CheckCircle2} tone="text-success" title="Key Findings" items={generateFindings()} />
            <Section icon={AlertTriangle} tone="text-warning" title="Risk Highlights" items={generateRisks()} />
            <Section icon={Eye} tone="text-accent" title="Observations" items={generateObservations()} />
          </div>
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
                Ensure Ollama is running with qwen2.5:3b model and all analyses are available.
              </p>
            </div>
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
  icon: Icon, tone, title, items, loading = false,
}: { icon: LucideIcon; tone: string; title: string; items: string[]; loading?: boolean }) {
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
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
        </div>
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
