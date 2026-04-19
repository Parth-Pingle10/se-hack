import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Trash2, BrainCircuit, Loader2, Globe,
} from "lucide-react";
import { chatWithAI, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ledgerspy:chat:history";
const MAX_HISTORY = 60;

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch { return []; }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch { /* quota errors — silently skip */ }
}

function Bubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 mb-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent/10 text-accent border border-accent/20"
        )}
      >
        {isUser ? "U" : <BrainCircuit className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 text-foreground border border-border rounded-tl-sm"
        )}
      >
        <span className="whitespace-pre-wrap">{msg.content}</span>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => { saveHistory(messages); }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setStreaming(true);
    setStreamingText("");

    let accumulated = "";

    await chatWithAI(
      text,
      nextHistory,
      (token) => { accumulated += token; setStreamingText(accumulated); },
      () => {
        setMessages((prev) => [...prev, { role: "assistant", content: accumulated, timestamp: Date.now() }]);
        setStreaming(false);
        setStreamingText("");
      },
      (err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠ Error: ${err}`, timestamp: Date.now() }]);
        setStreaming(false);
        setStreamingText("");
      }
    );
  }, [input, streaming, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearHistory = () => { setMessages([]); localStorage.removeItem(STORAGE_KEY); };

  const suggestions = [
    "Summarise the audit findings",
    "Which vendors are most risky?",
    "Why were anomalies flagged?",
    "List unmatched transactions",
  ];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI Audit Assistant"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "transition-all duration-300 hover:scale-110 hover:shadow-2xl",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[380px] max-h-[580px] flex flex-col",
          "card-elevated rounded-2xl overflow-hidden",
          "transition-all duration-300 origin-bottom-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-90 pointer-events-none"
        )}
        style={{ boxShadow: "0 24px 64px -12px hsl(222 28% 11% / 0.25)" }}
      >
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">AI Audit Assistant</p>
              <p className="text-[10px] text-primary-foreground/70 mt-0.5 flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" />
                RAG · Multilingual · Mistral
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={clearHistory} title="Clear conversation"
                className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)}
              className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-background min-h-0">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                <BrainCircuit className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Audit Assistant</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask me anything about your financial data.<br />
                  I answer based on your uploaded CSV data.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors border border-border">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

          {streaming && (
            <Bubble msg={{ role: "assistant", content: streamingText, timestamp: Date.now() }} isStreaming />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-border p-3 bg-card shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about anomalies, vendors, reconciliation… (any language)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 leading-relaxed max-h-28 overflow-y-auto"
              style={{ minHeight: "40px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 112)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                input.trim() && !streaming
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Powered by Mistral via Ollama · History saved locally
          </p>
        </div>
      </div>
    </>
  );
}
