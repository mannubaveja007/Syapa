"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Mic, ArrowUpRight, Play, Clock, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface MeetingItem {
  id: string;
  title: string;
  status: "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  summary?: string | null;
  droppedQuotesCount: number;
  createdAt: string;
  _count?: { segments: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/meetings");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.meetings) setMeetings(data.meetings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() || "Client Discovery Call" }),
      });
      const data = await res.json();
      if (data.meeting) {
        router.push(`/meetings/${data.meeting.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            Meetings & Transcripts
          </h1>
          <p className="text-xs text-muted mt-1">
            Browse live captured client sessions, action item summaries, and grounded scope extracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/simulator"
            className="border border-border text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-surface-subtle inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch simulator</span>
          </Link>
          <Link
            href="/settings"
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary-hover inline-flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Extension setup</span>
          </Link>
        </div>
      </div>

      {/* QUICK START MEETING FORM */}
      <div className="border border-border rounded-lg bg-surface p-4 sm:p-5 mb-8">
        <form onSubmit={handleCreateMeeting} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New meeting title (e.g. Acme Corp Sprint Review)…"
            className="flex-1 px-3 py-2 text-xs rounded-md bg-surface-subtle border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-medium hover:bg-primary-hover active:opacity-90 focus-visible:ring-2 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create new meeting</span>
          </button>
        </form>
      </div>

      {/* MEETINGS LIST */}
      {loading ? (
        <div className="py-20 text-center text-xs text-muted">
          Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <FileText className="w-8 h-8 text-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No recorded meetings yet</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-4">
            Connect the Chrome extension or create a meeting session above to start recording client dialogue.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-surface divide-y divide-border overflow-hidden">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-subtle/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {m.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      m.status === "COMPLETED"
                        ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
                        : m.status === "PROCESSING"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400 motion-safe:animate-pulse"
                        : m.status === "RECORDING"
                        ? "border-accent/30 bg-accent/10 text-accent motion-safe:animate-pulse"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(m.createdAt).toLocaleDateString()} at {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  {m._count && (
                    <span>{m._count.segments} transcript segments</span>
                  )}
                  {m.droppedQuotesCount > 0 && (
                    <span className="text-amber-500 text-[11px]">
                      {m.droppedQuotesCount} hallucinated quotes dropped
                    </span>
                  )}
                </div>

                {m.summary && (
                  <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
                    {m.summary}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <Link
                  href={`/meetings/${m.id}`}
                  className="border border-border text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-surface-subtle inline-flex items-center gap-1"
                >
                  <span>Open meeting</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
