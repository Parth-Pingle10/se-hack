import { useRef, useState, DragEvent } from "react";
import { UploadCloud, FileText, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  label: string;
  description?: string;
  onFile?: (file: File) => void;
}

export function UploadZone({ label, description, onFile }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    onFile?.(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setHover(false);
    handle(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      data-drag={hover}
      data-done={!!file}
      className="upload-zone group cursor-pointer p-7"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.xls,.xlsx,.pdf,.docx"
        onChange={(e) => handle(e.target.files?.[0])}
      />

      <div className="flex items-start gap-5">
        <div className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-250",
          file
            ? "bg-success/10 text-success"
            : hover
            ? "bg-accent/15 text-accent scale-110"
            : "bg-muted text-muted-foreground group-hover:text-accent group-hover:bg-accent/8"
        )}>
          {file ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <UploadCloud className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {description ?? "Drag and drop, or click to browse. CSV, XLSX, PDF, DOCX."}
          </p>

          {file && (
            <div className="mt-3.5 inline-flex items-center gap-2.5 text-xs text-foreground bg-success-soft/60 border border-success/20 rounded-lg px-3 py-2 fade-in">
              <FileText className="h-3.5 w-3.5 text-success" />
              <span className="truncate font-medium">{file.name}</span>
              <span className="ml-auto text-muted-foreground tabular-nums">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
