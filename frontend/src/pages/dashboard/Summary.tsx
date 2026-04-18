import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { auditSummary } from "@/lib/mockData";
import { InsightCard } from "@/components/InsightCard";
import { GlobalInsightPanel } from "@/components/GlobalInsightPanel";
import {
  FileText, Copy, Download, CheckCircle2, AlertTriangle, Eye, Loader2, Save,
  Bold, Italic, List, ListOrdered, Heading1, Heading2, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const MEMO_KEY = "ledgerspy:session:memo";

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

export default function Summary() {
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(MEMO_KEY)) {
      setGenerated(true);
    }
  }, []);

  const generate = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setGenerated(true); }, 700);
  };

  return (
    <div className="space-y-6 stagger-children">
      <GlobalInsightPanel />

      <InsightCard
        insights={[
          "Three high-risk transactions account for over $194,000 of aggregate exposure.",
          "Vendor naming similarity suggests possible duplication across nine pairs.",
          "Bank reconciliation coverage is 94.6%; mismatches concentrate in December.",
        ]}
      />

      {/* Findings sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section icon={CheckCircle2} tone="text-success" title="Key Findings"  items={auditSummary.findings} />
        <Section icon={AlertTriangle} tone="text-warning" title="Risk Highlights" items={auditSummary.risks} />
        <Section icon={Eye}            tone="text-accent"  title="Observations"   items={auditSummary.observations} />
      </div>

      {/* Audit memo editor */}
      <div className="card-elevated p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Audit Memo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate, edit, and export the narrative summary.
            </p>
          </div>
          {!generated && (
            <Button onClick={generate} disabled={loading} className="gap-2 rounded-xl shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate Audit Memo"}
            </Button>
          )}
        </div>

        {generated && <MemoEditor />}
      </div>
    </div>
  );
}

function MemoEditor() {
  const initial = (typeof window !== "undefined" && localStorage.getItem(MEMO_KEY)) || memoHtml;

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
    const margin = 56;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const text = editor.getText();
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("LedgerSpy Audit Memo", margin, margin);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(text.replace(/^LedgerSpy Audit Memo\n?/, ""), width);
    doc.text(lines, margin, margin + 24);
    doc.save("ledgerspy-audit-memo.pdf");
  };

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
  icon: Icon, tone, title, items,
}: { icon: LucideIcon; tone: string; title: string; items: string[] }) {
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
      <ul className="space-y-3">
        {items.map((t, i) => (
          <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2.5">
            <span className="text-muted-foreground/40 mt-1 text-xs">●</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
