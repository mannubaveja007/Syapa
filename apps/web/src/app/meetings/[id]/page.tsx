"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle2, AlertTriangle, Play, RefreshCw, Square } from "lucide-react";

interface Segment {
  id: string;
  speaker: "You" | "Others";
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

interface RequestedWorkItem {
  task: string;
  quote: string;
  speaker?: "You" | "Others";
  isScopeCreep: boolean;
}

interface MeetingDetail {
  id: string;
  title: string;
  status: "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  summary?: string | null;
  actionItems?: string[] | null;
  requestedWork?: RequestedWorkItem[] | null;
  droppedQuotesCount: number;
  createdAt: string;
  segments: Segment[];
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  const fetchMeeting = async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.meeting) {
        setMeeting(data.meeting);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();

    // Auto-poll if meeting is RECORDING or PROCESSING
    const interval = setInterval(() => {
      if (meeting?.status === "RECORDING" || meeting?.status === "PROCESSING") {
        fetchMeeting();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);

  const handleEndMeeting = async () => {
    if (ending) return;
    setEnding(true);

    try {
      await fetch(`/api/meetings/${meetingId}/end`, { method: "POST" });
      await fetchMeeting();
    } catch (err) {
      console.error(err);
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center text-xs font-mono text-muted">
        Loading meeting details...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h2 className="text-base font-semibold text-foreground mb-2">Meeting not found</h2>
        <Link href="/dashboard" className="text-xs text-muted hover:text-foreground underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* BACK NAVIGATION & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to meetings</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
              {meeting.title}
            </h1>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                meeting.status === "COMPLETED"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : meeting.status === "PROCESSING"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse"
                  : meeting.status === "RECORDING"
                  ? "border-accent/30 bg-accent/10 text-accent animate-pulse"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {meeting.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {meeting.status === "RECORDING" && (
            <button
              onClick={handleEndMeeting}
              disabled={ending}
              className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{ending ? "Processing pipeline..." : "End meeting & analyze"}</span>
            </button>
          )}

          {meeting.status === "PROCESSING" && (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Embedding & verifying quotes...</span>
            </div>
          )}

          <Link
            href={`/simulator?meetingId=${meeting.id}`}
            className="border border-border text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-surface-subtle inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Spar against this meeting</span>
          </Link>
        </div>
      </div>

      {/* POST-MEETING ANALYSIS (IF COMPLETED) */}
      {meeting.status === "COMPLETED" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* SUMMARY */}
          <div className="md:col-span-2 border border-border rounded-lg bg-surface p-5">
            <h2 className="text-xs font-mono text-muted mb-3">AI EXECUTIVE SUMMARY (GEMMA 4)</h2>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
              {meeting.summary || "No summary generated."}
            </p>
          </div>

          {/* ACTION ITEMS */}
          <div className="border border-border rounded-lg bg-surface p-5">
            <h2 className="text-xs font-mono text-muted mb-3">ACTION ITEMS</h2>
            {meeting.actionItems && Array.isArray(meeting.actionItems) && meeting.actionItems.length > 0 ? (
              <ul className="space-y-2">
                {meeting.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No action items flagged.</p>
            )}
          </div>
        </div>
      )}

      {/* REQUESTED WORK LIST WITH VERIFIED QUOTES */}
      {meeting.status === "COMPLETED" && meeting.requestedWork && meeting.requestedWork.length > 0 && (
        <div className="border border-border rounded-lg bg-surface p-5 mb-10">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Extracted Work Requests & Scope Creep
              </h2>
              <p className="text-xs text-muted">
                Every task is strictly grounded with exact quotes from the transcript.
              </p>
            </div>
            {meeting.droppedQuotesCount > 0 && (
              <span className="text-[11px] font-mono text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded">
                {meeting.droppedQuotesCount} hallucinated quotes dropped
              </span>
            )}
          </div>

          <div className="divide-y divide-border">
            {meeting.requestedWork.map((item, idx) => (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{item.task}</span>
                    {item.isScopeCreep && (
                      <span className="text-[10px] font-mono border border-destructive/30 bg-destructive/10 text-destructive px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Scope creep</span>
                      </span>
                    )}
                  </div>
                  <blockquote className="text-xs font-mono text-muted bg-surface-subtle border-l-2 border-border pl-2.5 py-1 rounded-r mt-1">
                    "{item.quote}"
                  </blockquote>
                </div>
                {item.speaker && (
                  <span className="text-[11px] font-mono text-muted shrink-0">
                    Speaker: {item.speaker}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSCRIPT SEGMENT VIEWER */}
      <div className="border border-border rounded-lg bg-surface p-5">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Full Transcript ({meeting.segments.length} segments)
          </h2>
          <span className="text-xs font-mono text-muted">
            ElevenLabs Scribe Realtime
          </span>
        </div>

        {meeting.segments.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">
            No transcript segments recorded yet. If the meeting is live, speak into your mic or capture tab audio.
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {meeting.segments.map((seg) => (
              <div
                key={seg.id}
                className={`p-3 rounded-md border text-xs ${
                  seg.speaker === "You"
                    ? "bg-surface-subtle border-border/80 ml-4 sm:ml-8"
                    : "bg-surface border-border mr-4 sm:mr-8"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`font-semibold text-[11px] font-mono ${
                      seg.speaker === "You" ? "text-accent" : "text-foreground"
                    }`}
                  >
                    {seg.speaker}
                  </span>
                  <span className="text-[10px] font-mono text-muted">
                    {formatMs(seg.startTimeMs)} - {formatMs(seg.endTimeMs)}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed">{seg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
