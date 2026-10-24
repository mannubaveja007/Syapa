"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  AlertTriangle,
  Play,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  ConversationProvider,
  useConversation,
  type Role,
} from "@elevenlabs/react";

interface Turn {
  role: "user" | "client";
  content: string;
}

interface SessionData {
  sessionId: string;
  channel: string;
  signedUrl: string | null;
  agentId: string;
  brief: string;
  briefWordCount: number;
  isMock: boolean;
  persona: string;
}

const ARCHETYPES = [
  {
    id: "mr_sharma",
    title: "Mr Sharma (Coaching Center)",
    clientName: "Mr Sharma",
    freelancerName: "Mannu",
    tag: "Scope Creeper",
    difficulty: 2,
    budgetCeiling: "₹15,000",
    hiddenAsks: ["online fee payment", "student login for notes", "Hindi version"],
    description: "Runs a class 9-12 coaching center. Wants a simple website with courses, teachers, results and contact form for ₹12,000, then pushes for student portals, fee payment, and Hindi localization without hosting.",
    defaultBrief: "Mr Sharma runs a coaching center for class 9 to 12 and wants a simple website with courses, teachers, results and a contact form. His stated budget is ₹12,000. He has not mentioned hosting.",
  },
  {
    id: "scope_creep_ceo",
    title: "Scope Creep CEO",
    tag: "Feature creep",
    description: "Constantly asks for extra unbudgeted screens, features, and rush revisions as “quick favors”.",
    defaultBrief: "SaaS redesign project: $6,000 budget for 4 core web views. Milestone 1 covers landing and auth.",
  },
  {
    id: "micromanaging_founder",
    title: "Micromanaging Founder",
    tag: "Intrusive oversight",
    description: "Demands daily 3-hour video updates, questions every line of code, and expects instant Slack replies.",
    defaultBrief: "API integration project: $4,500 fixed fee. 3 weeks to complete webhook receiver and database syncing.",
  },
  {
    id: "aggressive_cost_cutter",
    title: "Aggressive Cost Cutter",
    tag: "Rate pressure",
    description: "Claims offshore agencies bid 50% less, threatens to cancel, and tries to renegotiate fixed milestones.",
    defaultBrief: "Design system project: $8,000 for Figma tokens, component library, and documentation site.",
  },
  {
    id: "ghosting_lead",
    title: "Ghosting Enterprise Lead",
    tag: "Deliberate delay",
    description: "Goes dark for weeks, shifts acceptance criteria at the eleventh hour, and withholds signoff.",
    defaultBrief: "Migration project: $12,000 contract for migrating legacy monolith database to PostgreSQL with pgvector.",
  },
];

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export default function PracticeRoomPage() {
  const router = useRouter();

  // Setup state
  const [selectedArchetype, setSelectedArchetype] = useState(ARCHETYPES[0].id);
  const [briefSource, setBriefSource] = useState<"preset" | "custom" | "meeting">("preset");
  const [customBriefText, setCustomBriefText] = useState(ARCHETYPES[0].defaultBrief);
  const [recentMeetings, setRecentMeetings] = useState<Array<{ id: string; title: string; summary?: string }>>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState("");

  // Active Session state
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Fetch recent meetings for grounding option
  useEffect(() => {
    fetch("/api/meetings")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.meetings) {
          setRecentMeetings(data.meetings.slice(0, 5));
          if (data.meetings.length > 0) {
            setSelectedMeetingId(data.meetings[0].id);
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const activeArchetype = ARCHETYPES.find((a) => a.id === selectedArchetype) || ARCHETYPES[0];

  const handleArchetypeChange = (id: string) => {
    setSelectedArchetype(id);
    const arch = ARCHETYPES.find((a) => a.id === id);
    if (arch && briefSource === "preset") {
      setCustomBriefText(arch.defaultBrief);
    }
  };

  const currentBriefWordCount = countWords(customBriefText);

  const handleStartPractice = async () => {
    setError("");
    if (currentBriefWordCount > 500) {
      setError("Brief exceeds the 500-word limit. Please shorten before beginning.");
      return;
    }

    setIsLoadingSession(true);

    try {
      const payload: Record<string, any> = {
        persona: activeArchetype.title,
        difficulty,
      };

      if (briefSource === "meeting" && selectedMeetingId) {
        payload.meetingId = selectedMeetingId;
      } else {
        payload.customBrief = customBriefText;
      }

      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to initiate voice practice session");
      }

      const data = await res.json();
      setSessionData({
        ...data,
        persona: activeArchetype.title,
      });
    } catch (err: any) {
      setError(err.message || "Failed to start practice session");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleFinishSession = async (
    sessionId: string,
    elevenlabsConversationId: string | null,
    turns: Turn[]
  ) => {
    try {
      const res = await fetch(`/api/voice/session/${sessionId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elevenlabsConversationId,
          turns,
        }),
      });

      if (res.ok) {
        router.push(`/scorecards/${sessionId}`);
      } else {
        router.push("/simulator");
      }
    } catch {
      router.push("/simulator");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <style>{`
        .nowrap { white-space: nowrap; }
      `}</style>
      {/* PAGE HEADER */}
      <div className="pb-6 border-b border-border mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] border border-border px-2 py-0.5 rounded text-accent bg-surface-subtle">
            Voice practice room
          </span>
          <span className="text-xs text-muted">
            ElevenLabs Conversational AI
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Live voice negotiation practice
        </h1>
        <p className="text-xs text-muted mt-1 leading-relaxed max-w-2xl">
          Practice defending rates, rejecting scope creep, and holding firm deadlines in real-time dialogue. A ruthless scorecard grades your assertiveness and rewrites weak concessions.
        </p>
      </div>

      {error && (
        <div className="p-3 mb-6 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          {error}
        </div>
      )}

      {!sessionData ? (
        /* SETUP VIEW */
        <div className="space-y-8">
          {/* STEP 1: ARCHETYPE SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-foreground">
                1. Select client archetype
              </label>
              <span className="text-[11px] text-muted">
                Choose behavioral archetype
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ARCHETYPES.map((arch) => {
                const isSelected = arch.id === selectedArchetype;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => handleArchetypeChange(arch.id)}
                    className={`p-4 rounded-lg border text-left transition-colors active:opacity-80 focus-visible:ring-2 ${
                      isSelected
                        ? "border-foreground bg-surface shadow-sm"
                        : "border-border bg-surface-subtle hover:border-foreground/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {arch.title}
                      </span>
                      <span className="text-[10px] text-muted border border-border px-1.5 py-0.5 rounded">
                        {arch.tag}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {arch.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: GROUNDING BRIEF */}
          <div className="border border-border rounded-lg bg-surface p-5">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
              <div>
                <label className="text-xs font-semibold text-foreground block">
                  2. Grounding project brief
                </label>
                <span className="text-[11px] text-muted">
                  Strictly capped under 500 words
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setBriefSource("preset");
                    setCustomBriefText(activeArchetype.defaultBrief);
                  }}
                  className={`px-2.5 py-1 rounded text-xs active:opacity-80 focus-visible:ring-2 ${
                    briefSource === "preset"
                      ? "bg-foreground text-background font-medium"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Archetype preset
                </button>
                <button
                  type="button"
                  onClick={() => setBriefSource("custom")}
                  className={`px-2.5 py-1 rounded text-xs active:opacity-80 focus-visible:ring-2 ${
                    briefSource === "custom"
                      ? "bg-foreground text-background font-medium"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Custom text
                </button>
                {recentMeetings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBriefSource("meeting")}
                    className={`px-2.5 py-1 rounded text-xs active:opacity-80 focus-visible:ring-2 ${
                      briefSource === "meeting"
                        ? "bg-foreground text-background font-medium"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    From meeting
                  </button>
                )}
              </div>
            </div>

            {briefSource === "meeting" && recentMeetings.length > 0 ? (
              <div className="space-y-3">
                <label className="text-xs text-muted block">
                  Select recorded meeting to ground simulation against:
                </label>
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="w-full bg-surface-subtle border border-border text-foreground text-xs rounded-md p-2.5 outline-none focus-visible:ring-2"
                >
                  {recentMeetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted leading-relaxed">
                  The client agent will be primed with the executive summary and extracted work requests from this meeting.
                </p>
              </div>
            ) : (
              <div>
                <textarea
                  rows={4}
                  value={customBriefText}
                  onChange={(e) => setCustomBriefText(e.target.value)}
                  placeholder="Describe project deliverables, timeline, and budget…"
                  className="w-full bg-surface-subtle border border-border text-foreground text-xs rounded-md p-3 outline-none focus-visible:ring-2 font-mono leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="text-muted">
                    Injected brief size:
                  </span>
                  <span
                    className={
                      currentBriefWordCount > 500
                        ? "text-destructive font-medium"
                        : "text-muted"
                    }
                  >
                    <span>{currentBriefWordCount}</span> of 500 words
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: DIFFICULTY */}
          <div className="border border-border rounded-lg bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground block">
                3. Client aggression level
              </label>
              <span className="text-[11px] text-muted">
                Governs resistance to boundaries and frequency of scope asks
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border active:opacity-80 focus-visible:ring-2 ${
                    difficulty === lvl
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface-subtle text-muted hover:text-foreground"
                  }`}
                >
                  {lvl === 1 ? "Mild" : lvl === 2 ? "Hard" : "Ruthless"}
                </button>
              ))}
            </div>
          </div>

          {/* START BUTTON */}
          <button
            type="button"
            onClick={handleStartPractice}
            disabled={isLoadingSession || currentBriefWordCount > 500}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg text-xs font-semibold hover:bg-primary-hover active:opacity-80 focus-visible:ring-2 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" />
            <span>Start voice session</span>
          </button>
        </div>
      ) : (
        /* ACTIVE VOICE SPARRING ROOM */
        <ConversationProvider
          agentId={sessionData.agentId}
        >
          <ActiveVoiceRoom
            sessionData={sessionData}
            onCancel={() => setSessionData(null)}
            onFinish={(elevenlabsId, turns) =>
              handleFinishSession(sessionData.sessionId, elevenlabsId, turns)
            }
          />
        </ConversationProvider>
      )}
    </div>
  );
}

interface ActiveRoomProps {
  sessionData: SessionData;
  onCancel: () => void;
  onFinish: (elevenlabsId: string | null, turns: Turn[]) => Promise<void>;
}

function ActiveVoiceRoom({ sessionData, onCancel, onFinish }: ActiveRoomProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elevenlabsId, setElevenlabsId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mockUserTurnText, setMockUserTurnText] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Hook from ElevenLabs React SDK
  const conversation = useConversation({
    onConnect: ({ conversationId }: { conversationId: string }) => {
      setElevenlabsId(conversationId);
    },
    onDisconnect: () => {},
    onMessage: (msg: any) => {
      if (msg?.message) {
        setTurns((prev) => [
          ...prev,
          {
            role: msg.role === "user" ? "user" : "client",
            content: msg.message,
          },
        ]);
      }
    },
    onError: (err: any) => {
      console.warn("ElevenLabs conversation error:", err);
    },
  });

  const { status, isSpeaking, isMuted, setMuted } = conversation;

  // Session elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll transcript feed
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Connect to ElevenLabs on mount
  useEffect(() => {
    let active = true;

    async function initSession() {
      if (sessionData.signedUrl) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!active) return;
          conversation.startSession({
            signedUrl: sessionData.signedUrl,
          });
        } catch (err) {
          console.warn("Microphone access denied or session failed:", err);
        }
      }
    }

    initSession();

    return () => {
      active = false;
      try {
        conversation.endSession();
      } catch {}
    };
  }, [sessionData.signedUrl]);

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      conversation.endSession();
    } catch {}
    await onFinish(elevenlabsId, turns);
  };

  const handleAddMockTurn = () => {
    if (!mockUserTurnText.trim()) return;
    const userText = mockUserTurnText.trim();
    setTurns((prev) => [
      ...prev,
      { role: "user", content: userText },
      {
        role: "client",
        content: `Look, that sounds fine, but we need those extra screens ready by next Tuesday. If you can’t throw them in, I’ll need to re-evaluate our contract terms.`,
      },
    ]);
    setMockUserTurnText("");
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* STATUS BANNER */}
      <div className="border border-border rounded-lg bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              status === "connected"
                ? "bg-[var(--success)] motion-safe:animate-pulse motion-reduce:animate-none"
                : status === "connecting"
                ? "bg-amber-400 motion-safe:animate-pulse motion-reduce:animate-none"
                : "bg-muted"
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {sessionData.persona}
              </span>
              <span className="text-[10px] border border-border px-1.5 py-0.5 rounded text-muted">
                {status}
              </span>
            </div>
            <span className="text-[11px] text-muted">
              {isSpeaking ? "Client is speaking…" : "Listening to your response…"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-muted">
            {formatTimer(elapsedSeconds)}
          </span>

          <button
            type="button"
            onClick={() => setMuted(!isMuted)}
            className={`p-2 rounded-md border text-xs active:opacity-80 focus-visible:ring-2 ${
              isMuted
                ? "border-destructive text-destructive bg-destructive/10"
                : "border-border text-foreground hover:bg-surface-subtle"
            }`}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleFinish}
            disabled={isFinishing}
            className="bg-destructive text-destructive-foreground px-3.5 py-2 rounded-md text-xs font-semibold hover:opacity-90 active:opacity-80 focus-visible:ring-2 disabled:opacity-50 flex items-center gap-1.5 nowrap whitespace-nowrap"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End and grade</span>
          </button>
        </div>
      </div>

      {/* MOCK MODE NOTICE */}
      {sessionData.isMock && (
        <div className="p-3 rounded-md bg-surface-subtle border border-border text-xs text-muted flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-foreground block mb-0.5">
              Simulated voice environment
            </strong>
            Live audio streaming requires a valid ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in your environment. You can test dialogue exchanges below to generate a real scorecard.
          </div>
        </div>
      )}

      {/* GROUNDED BRIEF SUMMARY */}
      <div className="border border-border rounded-lg bg-surface p-4">
        <div className="flex items-center justify-between pb-2 border-b border-border mb-2.5">
          <span className="text-xs font-medium text-foreground">
            Injected project brief
          </span>
          <span className="text-[10px] text-muted">
            {sessionData.briefWordCount} words
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed font-mono">
          {sessionData.brief}
        </p>
      </div>

      {/* LIVE TRANSCRIPT FEED */}
      <div className="border border-border rounded-lg bg-surface p-4">
        <span className="text-xs font-medium text-foreground block mb-3">
          Voice dialogue feed
        </span>

        <div className="h-64 overflow-y-auto space-y-3 p-3 bg-surface-subtle rounded border border-border mb-4">
          {turns.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              Speak into your microphone to spar with the client…
            </div>
          ) : (
            turns.map((t, idx) => (
              <div
                key={idx}
                className={`p-3 rounded text-xs leading-relaxed max-w-[85%] ${
                  t.role === "user"
                    ? "ml-auto bg-surface border border-accent/30 text-foreground"
                    : "mr-auto bg-surface border border-border text-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span
                    className={`text-[10px] font-semibold ${
                      t.role === "user" ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {t.role === "user" ? "You (Freelancer)" : sessionData.persona}
                  </span>
                </div>
                <p>{t.content}</p>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* INPUT FOR DEMO / LOCAL TURNS */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={mockUserTurnText}
            onChange={(e) => setMockUserTurnText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMockTurn()}
            placeholder="Type your response to practice verbal reply…"
            className="flex-1 bg-surface-subtle border border-border text-foreground text-xs rounded-md p-2.5 outline-none focus-visible:ring-2"
          />
          <button
            type="button"
            onClick={handleAddMockTurn}
            className="bg-foreground text-background px-3 py-2 rounded-md text-xs font-medium active:opacity-80 focus-visible:ring-2 whitespace-nowrap"
          >
            Send turn
          </button>
        </div>
      </div>
    </div>
  );
}
