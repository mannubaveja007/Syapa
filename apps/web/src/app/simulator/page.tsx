"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Play, ArrowRight, Award, Clock, FileText, CheckCircle2 } from "lucide-react";

interface ContextDoc {
  id: string;
  title: string;
  type: "BRIEF" | "CHAT";
}

interface MeetingItem {
  id: string;
  title: string;
}

interface SimulationSessionItem {
  id: string;
  persona: string;
  difficulty: number;
  status: string;
  createdAt: string;
  scorecard?: { overallScore: number; createdAt: string } | null;
  _count?: { turns: number };
}

const PERSONAS = [
  {
    id: "scope_creeper",
    name: "Scope Creeper",
    desc: "Starts friendly, then casually piles on mobile apps, admin panels, and 24/7 maintenance without budget.",
    difficultyHint: "Tests your ability to issue change orders.",
  },
  {
    id: "budget_haggler",
    name: "Budget Haggler",
    desc: "Quotes fictional cheaper competitors, demands 30% discounts for 'exposure', and delays payment terms.",
    difficultyHint: "Tests your price anchoring and willingness to walk.",
  },
  {
    id: "ghost_payer",
    name: "Ghost Payer",
    desc: "Refuses to pay deposits upfront and demands raw Figma and git repos before releasing final invoices.",
    difficultyHint: "Tests your contract enforcement and milestone gates.",
  },
  {
    id: "micromanager",
    name: "Micromanager",
    desc: "Demands daily 8:30 AM video syncs, approval for every pull request, and screenshots with time logs.",
    difficultyHint: "Tests professional boundary setting.",
  },
  {
    id: "vague_brief",
    name: "Vague Brief",
    desc: "Rejects polished work because it 'does not have the right vibe' and changes direction mid-stream.",
    difficultyHint: "Tests requirements elicitation and sign-off locks.",
  },
];

export default function SimulatorLaunchPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SimulationSessionItem[]>([]);
  const [docs, setDocs] = useState<ContextDoc[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Configuration state
  const [selectedPersona, setSelectedPersona] = useState("scope_creeper");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [selectedBrief, setSelectedBrief] = useState<string>("");
  const [selectedChat, setSelectedChat] = useState<string>("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/simulator").then((r) => r.json()),
      fetch("/api/context").then((r) => r.json()),
      fetch("/api/meetings").then((r) => r.json()),
    ])
      .then(([simData, ctxData, meetData]) => {
        if (simData.sessions) setSessions(simData.sessions);
        if (ctxData.contexts) setDocs(ctxData.contexts);
        if (meetData.meetings) setMeetings(meetData.meetings);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleStartSimulation = async () => {
    if (starting) return;
    setStarting(true);

    try {
      const res = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedPersona,
          difficulty,
          briefId: selectedBrief || undefined,
          chatLogId: selectedChat || undefined,
          includeMeetingIds: selectedMeetingId ? [selectedMeetingId] : undefined,
        }),
      });

      const data = await res.json();
      if (data.session) {
        router.push(`/simulator/${data.session.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="pb-6 border-b border-border mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
          Bad Client Negotiation Simulator
        </h1>
        <p className="text-xs text-muted mt-1">
          Simulated difficult client negotiations grounded in your real brief and meeting transcripts, scored with unsparing critiques.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* LAUNCH CONFIGURATION */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: CHOOSE PERSONA */}
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-xs text-muted mb-3 font-medium">1. Select client persona</h2>
            <div className="space-y-2.5">
              {PERSONAS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPersona(p.id)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors active:opacity-90 ${
                    selectedPersona === p.id
                      ? "border-primary bg-surface-subtle"
                      : "border-border hover:bg-surface-subtle/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted">{p.difficultyHint}</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 2: DIFFICULTY */}
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-xs text-muted mb-3 font-medium">2. Select difficulty level</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { level: 1, label: "Level 1: Novice", note: "Mild pushback, willing to listen" },
                { level: 2, label: "Level 2: Seasoned", note: "Aggressive haggling and hidden asks" },
                { level: 3, label: "Level 3: Ruthless", note: "Zero patience, weaponizes ambiguity" },
              ].map((d) => (
                <button
                  key={d.level}
                  type="button"
                  onClick={() => setDifficulty(d.level as 1 | 2 | 3)}
                  className={`p-3 rounded-md border text-left transition-colors active:opacity-90 focus-visible:ring-2 ${
                    difficulty === d.level
                      ? "border-primary bg-surface-subtle"
                      : "border-border hover:bg-surface-subtle/50"
                  }`}
                >
                  <span className="block text-xs font-semibold text-foreground mb-1">{d.label}</span>
                  <span className="block text-[11px] text-muted">{d.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 3: GROUNDED CONTEXT */}
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-xs text-muted mb-3 font-medium">3. Ground in real context (hybrid search)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-muted mb-1">Project Brief</label>
                <select
                  value={selectedBrief}
                  onChange={(e) => setSelectedBrief(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-surface-subtle border border-input text-foreground text-xs focus-visible:ring-2"
                >
                  <option value="">No brief attached (Generic negotiation)</option>
                  {docs.filter((d) => d.type === "BRIEF").map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted mb-1">Past Meeting Transcript</label>
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-surface-subtle border border-input text-foreground text-xs focus-visible:ring-2"
                >
                  <option value="">No past meeting attached</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartSimulation}
            disabled={starting}
            className="w-full py-3 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{starting ? "Initializing agent session…" : "Start Negotiation Sparring"}</span>
          </button>
        </div>

        {/* PAST SCORECARDS HISTORY */}
        <div className="border border-border rounded-lg bg-surface p-5">
          <h2 className="text-xs text-muted mb-3 font-medium">Recent scorecards</h2>

          {loading ? (
            <div className="py-10 text-center text-xs text-muted">Loading history…</div>
          ) : sessions.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">
              No sparring sessions yet. Launch your first negotiation above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground capitalize">
                        {s.persona.replace("_", " ")}
                      </span>
                      <span className="text-[10px] border border-border px-1.5 rounded text-muted">
                        Level {s.difficulty}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {s.scorecard ? (
                    <Link
                      href={`/scorecards/${s.id}`}
                      className="text-xs font-mono px-2 py-1 rounded border border-accent/30 bg-accent/10 text-accent hover:underline flex items-center gap-1"
                    >
                      <Award className="w-3 h-3" />
                      <span>{s.scorecard.overallScore}/100</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/simulator/${s.id}`}
                      className="text-xs text-muted hover:text-foreground underline"
                    >
                      Resume
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
