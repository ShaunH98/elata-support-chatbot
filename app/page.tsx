"use client";

import { useEffect, useRef, useState } from "react";

type Confidence = "high" | "medium" | "low";

interface ProductRec {
  name: string;
  reason: string;
  confidence: Confidence;
  source: string;
}

interface InformationalReply {
  mode: "informational";
  answer: string;
  sources?: { label: string; page: number }[];
  notes?: string;
}

interface RecommendationReply {
  mode: "recommendation";
  products: ProductRec[];
  notes?: string;
}

type AssistantPayload = InformationalReply | RecommendationReply;

interface UserMessage {
  role: "user";
  content: string;
}
interface AssistantMessage {
  role: "assistant";
  payload: AssistantPayload;
}
type Message = UserMessage | AssistantMessage;

const SUGGESTED_QUESTIONS = [
  "Which Elata mattress is suitable for a Stage 3 pressure injury?",
  "What does a flashing red light on the E600 pump mean?",
  "Which product fits a patient weighing 160 kg?",
  "How do I do a CPR release on the mattress?",
  "What's the difference between the E400 and E500?",
];

const GREETING: AssistantMessage = {
  role: "assistant",
  payload: {
    mode: "informational",
    answer:
      "Hi — I'm the Elata Support Assistant. I can help with the Elata® range (E300 foam, E400/E500 hybrid, E600/E700 alternating air) using the official user manuals and brochures.\n\nAsk about alarms, modes, setup, cleaning, or product selection (e.g. \"which mattress for a Stage 3 patient at 150 kg?\"). If a question is outside the documentation, I'll let you know.",
    sources: [],
    notes: "",
  },
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);

    const userMsg: UserMessage = { role: "user", content: trimmed };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      // Build the API payload from the conversation. The API expects
      // {role, content} only — convert assistant messages back to a
      // text representation for short context.
      const apiMessages = next.map((m) => {
        if (m.role === "user") return { role: "user", content: m.content };
        return { role: "assistant", content: serialiseAssistant(m.payload) };
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      // 429 (rate limit) comes back as a well-formed assistant message
      // explaining the limit, so treat it as success rather than throwing.
      if (!res.ok && res.status !== 429) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const payload = (await res.json()) as AssistantPayload;
      setMessages((m) => [...m, { role: "assistant", payload }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-elata-paper">
      <header className="w-full border-b border-elata-line bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-elata-orange flex items-center justify-center text-white font-semibold text-sm tracking-tight">
              EL
            </div>
            <div>
              <div
                className="text-base font-semibold text-elata-ink leading-tight"
                style={{ fontFamily: '"Fraunces", serif' }}
              >
                Elata Support
              </div>
              <div className="text-xs text-elata-muted">
                Enable Lifecare · AI assistant
              </div>
            </div>
          </div>
          <a
            href="tel:1300370370"
            className="text-xs sm:text-sm text-elata-muted hover:text-elata-ink transition-colors"
          >
            Need a human?{" "}
            <span className="font-medium text-elata-ink">1300 370 370</span>
          </a>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl flex flex-col">
        <div
          ref={scrollRef}
          className="chat-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          {messages.map((m, i) =>
            m.role === "user" ? (
              <UserBubble key={i} text={m.content} />
            ) : (
              <AssistantBubble key={i} payload={m.payload} />
            ),
          )}

          {sending && (
            <div className="flex items-start gap-3">
              <Avatar />
              <div className="flex items-center gap-1 px-3 py-3 bg-white border border-elata-line rounded-2xl rounded-tl-sm">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-elata-muted" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-elata-muted" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-elata-muted" />
              </div>
            </div>
          )}

          {messages.length === 1 && !sending && (
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-elata-muted mb-2 ml-10">
                Try asking
              </div>
              <div className="flex flex-wrap gap-2 ml-10">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs sm:text-[13px] px-3 py-2 bg-white border border-elata-line rounded-full hover:border-elata-orange hover:text-elata-orange transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-elata-line bg-white/80 backdrop-blur px-4 sm:px-6 py-4">
          <div className="flex items-end gap-3 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about an alarm, mode, setup step, or which product to use…"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none px-4 py-3 text-sm bg-white border border-elata-line rounded-2xl focus:outline-none focus:border-elata-orange focus:ring-2 focus:ring-elata-orange/20 disabled:opacity-60 max-h-32"
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="px-5 py-3 bg-elata-orange text-white text-sm font-medium rounded-2xl hover:bg-elata-orange/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              Send
            </button>
          </div>
          <div className="text-[11px] text-elata-muted text-center mt-2 max-w-3xl mx-auto">
            Answers are based on official Elata documentation only. For clinical decisions, consult a qualified clinician. In an emergency, call your local emergency number.
          </div>
        </div>
      </div>
    </main>
  );
}

function Avatar() {
  return (
    <div className="w-7 h-7 shrink-0 rounded-full bg-elata-orange/10 border border-elata-orange/30 flex items-center justify-center text-[11px] font-medium text-elata-orange">
      EL
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%] bg-elata-ink text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-[14.5px] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ payload }: { payload: AssistantPayload }) {
  if (payload.mode === "recommendation") {
    return <RecommendationView rec={payload} />;
  }
  return <InformationalView info={payload} />;
}

function InformationalView({ info }: { info: InformationalReply }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] sm:max-w-[80%] space-y-2">
        <div className="bg-white border border-elata-line px-4 py-3 rounded-2xl rounded-tl-sm text-[14.5px] leading-relaxed whitespace-pre-wrap text-elata-ink">
          {info.answer}
        </div>
        {info.sources && info.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {info.sources.map((s, i) => (
              <span key={i} className="cite-chip">
                {s.label} · p.{s.page}
              </span>
            ))}
          </div>
        )}
        {info.notes && info.notes.trim() !== "" && (
          <div className="text-[12px] text-elata-muted italic">
            {info.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationView({ rec }: { rec: RecommendationReply }) {
  const empty = !rec.products || rec.products.length === 0;
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="max-w-[85%] sm:max-w-[80%] w-full space-y-2">
        {empty ? (
          <div className="bg-white border border-elata-line px-4 py-3 rounded-2xl rounded-tl-sm text-[14.5px] leading-relaxed text-elata-ink">
            No product in the Elata range matches those criteria according to the documentation I have access to.
            {rec.notes && rec.notes !== "" ? (
              <div className="mt-2 text-[13px] text-elata-muted">{rec.notes}</div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="text-[12px] uppercase tracking-wider text-elata-muted">
              Matching products ({rec.products.length})
            </div>
            <div className="space-y-2">
              {rec.products.map((p, i) => (
                <ProductCard key={i} product={p} />
              ))}
            </div>
            {rec.notes && rec.notes.trim() !== "" && (
              <div className="text-[12px] text-elata-muted italic pt-1">
                {rec.notes}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: ProductRec }) {
  return (
    <div className="bg-white border border-elata-line rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div
          className="text-[15px] font-semibold text-elata-ink"
          style={{ fontFamily: '"Fraunces", serif' }}
        >
          {product.name}
        </div>
        <ConfidenceBadge level={product.confidence} />
      </div>
      <div className="text-[14px] text-elata-ink leading-relaxed">
        {product.reason}
      </div>
      {product.source && (
        <div className="mt-2 text-[11px] text-elata-muted">
          Source: {product.source}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ level }: { level: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-green-50 text-green-700 border-green-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[level] || styles.low}`}
    >
      {level} confidence
    </span>
  );
}

function serialiseAssistant(p: AssistantPayload): string {
  if (p.mode === "informational") return p.answer;
  if (!p.products || p.products.length === 0) {
    return `No matching products. ${p.notes || ""}`.trim();
  }
  return p.products
    .map((x) => `${x.name}: ${x.reason} (confidence: ${x.confidence}; source: ${x.source})`)
    .join("\n");
}
