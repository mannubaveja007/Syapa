"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Award, ShieldAlert, Loader2, RefreshCw } from "lucide-react";

interface Turn {
  id: string;
  role: "user" | "client";
  content: string;
  turnIndex: number;
  createdAt: string;
}

interface SessionDetail {
  id: string;
  persona: string;
  difficulty: number;
  status: string;
  createdAt: string;
  turns: Turn[];
  scorecard?: any;
}

export default function SimulatorSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const turnsEndRef = useRef<HTMLDivElement>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/simulator/${sessionId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.id) {
        setSession(data);
        if (data.status === "COMPLETED" && data.scorecard) {
          router.push(`/scorecards/${data.id}`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.turns]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const message = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    // Optimistically add user turn
    const optimisticTurn: Turn = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: message,
      turnIndex: (session?.turns.length ?? 0),
      createdAt: new Date().toISOString(),
    };

    setSession((prev) => prev ? { ...prev, turns: [...prev.turns, optimisticTurn] } : null);

    try {
      const res = await fetch(`/api/simulator/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (data.reply) {
        const clientTurn: Turn = {
          id: `client_${Date.now()}`,
          role: "client",
          content: data.reply,
          turnIndex: data.turnIndex,
          createdAt: data.createdAt,
        };
        setSession((prev) => prev ? { ...prev, turns: [...prev.turns, clientTurn] } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleEndAndScore = async () => {
    if (evaluating) return;
    setEvaluating(true);

    try {
      const res = await fetch(`/api/simulator/${sessionId}/scorecard`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.scorecard) {
        router.push(`/scorecards/${sessionId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-xs text-muted">
        Loading simulation session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-base font-semibold text-foreground mb-2">Session not found</h2>
        <Link href="/simulator" className="text-xs text-muted hover:text-foreground underline active:opacity-80 focus-visible:ring-2">
          Back to simulator
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col h-[calc(100vh-4rem)]">
      {/* TOP HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
        <div>
          <Link
            href="/simulator"
            className="text-xs text-muted hover:text-foreground active:opacity-80 focus-visible:ring-2 inline-flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Abandon session</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-foreground capitalize">
              {session.persona.replace("_", " ")}
            </h1>
            <span className="text-[10px] border border-border px-1.5 py-0.5 rounded text-muted">
              Difficulty: {session.difficulty}/3
            </span>
            <span className="text-[10px] border border-[var(--success)]/30 text-[var(--success)] px-1.5 py-0.5 rounded">
              Grounded in project context
            </span>
          </div>
        </div>

        <button
          onClick={handleEndAndScore}
          disabled={evaluating || session.turns.length < 2}
          className="nowrap bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center gap-1.5 disabled:opacity-50"
        >
          {evaluating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" />
              <span>Scoring…</span>
            </>
          ) : (
            <>
              <Award className="w-3.5 h-3.5" />
              <span>Conclude</span>
            </>
          )}
        </button>
      </div>

      {/* CHAT MESSAGES SCROLL AREA */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-2">
        <AnimatePresence initial={false}>
          {session.turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex flex-col ${turn.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="text-[10px] text-muted mb-1 px-1">
                {turn.role === "user" ? "You (Freelancer)" : `Client (${session.persona.replace("_", " ")})`} • Turn {turn.turnIndex}
              </div>
              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-lg text-xs leading-relaxed ${
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground font-normal rounded-tr-none"
                    : "bg-surface border border-border text-foreground rounded-tl-none"
                }`}
              >
                <p className="whitespace-pre-line">{turn.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted py-2">
            <RefreshCw className="w-3 h-3 motion-safe:animate-spin text-muted" />
            <span>Bad Client is analyzing your reply and consulting brief…</span>
          </div>
        )}

        <div ref={turnsEndRef} />
      </div>

      {/* INPUT BAR */}
      <div className="pt-4 border-t border-border shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            required
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={sending || evaluating}
            placeholder="Type your negotiation reply (anchor price, defend boundaries, push for change orders)…"
            className="flex-1 px-3.5 py-2.5 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus-visible:ring-2 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || evaluating || !inputMessage.trim()}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-xs font-medium hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
