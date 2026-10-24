"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";

interface ConcessionItem {
  quote: string;
  turnIndex: number;
  critique: string;
}

interface BoundaryItem {
  quote: string;
  turnIndex: number;
  praise: string;
}

interface PriceAnchoring {
  initialOffer: string;
  finalAgreed: string;
  rating: "Strong" | "Moderate" | "Weak";
  notes: string;
}

interface VaguePromise {
  quote: string;
  turnIndex: number;
  risk: string;
}

interface RewriteItem {
  turnIndex: number;
  originalReply: string;
  recommendedRewrite: string;
  rationale: string;
}

interface ScorecardData {
  id: string;
  overallScore: number;
  summary: string;
  freeConcessions: ConcessionItem[];
  boundariesHeld: BoundaryItem[];
  priceAnchoring: PriceAnchoring;
  vaguePromises: VaguePromise[];
  rewrites: RewriteItem[];
  createdAt: string;
}

interface SessionData {
  id: string;
  persona: string;
  difficulty: number;
  status: string;
  scorecard: ScorecardData;
  revealedHiddenState?: {
    finalPatience: number;
    finalTrust: number;
    budgetCeiling: number;
    hiddenAsks: string[];
  };
}

export default function ScorecardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/simulator/${sessionId}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((session) => {
        if (session && session.scorecard) {
          setData(session);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-xs text-muted">
        Loading scorecard report…
      </div>
    );
  }

  if (!data || !data.scorecard) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-base font-semibold text-foreground mb-2">Scorecard not found</h2>
        <Link href="/simulator" className="text-xs text-muted hover:text-foreground underline active:opacity-80 focus-visible:ring-2">
          Back to simulator
        </Link>
      </div>
    );
  }

  const { scorecard, revealedHiddenState } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <Link
            href="/simulator"
            className="text-xs text-muted hover:text-foreground active:opacity-80 focus-visible:ring-2 inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to simulator</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
              Negotiation Scorecard
            </h1>
            <span className="text-xs border border-border px-2 py-0.5 rounded text-muted capitalize">
              {data.persona.replace("_", " ")} • Level {data.difficulty}
            </span>
          </div>
        </div>

        <Link
          href="/simulator"
          className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary-hover active:opacity-80 focus-visible:ring-2 inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Practice again</span>
        </Link>
      </div>

      {/* OVERALL SCORE & SUMMARY */}
      <div className="border border-border rounded-lg bg-surface p-6 sm:p-8 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="md:col-span-1 text-center md:text-left border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6">
          <span className="text-xs text-muted block mb-1">Overall rating</span>
          <div className="text-4xl sm:text-5xl font-semibold text-foreground tracking-tight">
            {scorecard.overallScore}<span className="text-base text-muted font-normal">/100</span>
          </div>
        </div>

        <div className="md:col-span-3">
          <h2 className="text-sm font-semibold text-foreground mb-2">Executive Evaluation</h2>
          <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
            {scorecard.summary}
          </p>
        </div>
      </div>

      {/* REVEALED HIDDEN STATE (BEHIND THE CURTAIN) */}
      {revealedHiddenState && (
        <div className="border border-border rounded-lg bg-surface-subtle p-5 mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <span className="text-xs font-medium text-muted">Client internal state (previously hidden)</span>
            <span className="text-[11px] text-muted">Post-mortem review</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mb-4">
            <div>
              <span className="text-muted block text-[11px]">Final Client Patience</span>
              <span className="text-foreground text-sm font-semibold">{revealedHiddenState.finalPatience}/100</span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Final Client Trust</span>
              <span className="text-foreground text-sm font-semibold">{revealedHiddenState.finalTrust}/100</span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Max Budget Ceiling</span>
              <span className="text-foreground text-sm font-semibold">${revealedHiddenState.budgetCeiling}</span>
            </div>
          </div>

          <div>
            <span className="text-muted text-[11px] block mb-2">Hidden asks the client attempted to sneak in:</span>
            <ul className="space-y-1.5">
              {revealedHiddenState.hiddenAsks.map((ask, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  <span>{ask}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* PRICE ANCHORING */}
      {scorecard.priceAnchoring && (
        <div className="border border-border rounded-lg bg-surface p-5 mb-8">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <h2 className="text-sm font-semibold text-foreground">Price Anchoring Assessment</h2>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border ${
                scorecard.priceAnchoring.rating === "Strong"
                  ? "border-[var(--success)]/30 text-[var(--success)]"
                  : scorecard.priceAnchoring.rating === "Moderate"
                  ? "border-amber-500/30 text-amber-400"
                  : "border-destructive/30 text-destructive"
              }`}
            >
              {scorecard.priceAnchoring.rating} Anchoring
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            {scorecard.priceAnchoring.notes}
          </p>
        </div>
      )}

      {/* 3 HIGH-LEVERAGE REWRITES (CRITICAL REQUIREMENT) */}
      <div className="border border-border rounded-lg bg-surface p-5 mb-8">
        <div className="pb-3 border-b border-border mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            3 High-Leverage Rewrites of Your Weakest Replies
          </h2>
          <p className="text-xs text-muted">
            Exact phrasing to defend your pricing and shut down scope creep in real situations.
          </p>
        </div>

        <div className="space-y-6">
          {scorecard.rewrites.map((rw, idx) => (
            <div key={idx} className="border border-border rounded p-4 bg-surface-subtle">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted pb-2 border-b border-border mb-3">
                <span>REWRITE #{idx + 1} (CITING TURN {rw.turnIndex})</span>
              </div>
              <div className="mb-3">
                <span className="text-[11px] text-muted block mb-1">What you said:</span>
                <p className="text-xs text-foreground font-mono bg-surface p-2.5 rounded border border-border">
                  "{rw.originalReply}"
                </p>
              </div>
              <div className="mb-3">
                <span className="text-[11px] text-accent font-semibold block mb-1">Recommended assertiveness rewrite:</span>
                <p className="text-xs text-foreground font-mono bg-surface p-2.5 rounded border border-accent/40 font-medium">
                  "{rw.recommendedRewrite}"
                </p>
              </div>
              <p className="text-xs text-muted leading-relaxed italic">
                Strategic Rationale: {rw.rationale}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FREE CONCESSIONS & BOUNDARIES HELD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FREE CONCESSIONS */}
        <div className="border border-border rounded-lg bg-surface p-5">
          <h2 className="text-xs text-muted mb-3 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span>Free concessions given ({scorecard.freeConcessions.length})</span>
          </h2>
          {scorecard.freeConcessions.length === 0 ? (
            <p className="text-xs text-muted">No free concessions conceded. Excellent discipline!</p>
          ) : (
            <div className="space-y-3">
              {scorecard.freeConcessions.map((c, idx) => (
                <div key={idx} className="p-3 rounded bg-surface-subtle border border-border text-xs">
                  <span className="text-[10px] text-muted block mb-1">Turn {c.turnIndex}:</span>
                  <blockquote className="text-foreground mb-1.5">“{c.quote}”</blockquote>
                  <p className="text-muted text-[11px] leading-relaxed">{c.critique}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOUNDARIES HELD */}
        <div className="border border-border rounded-lg bg-surface p-5">
          <h2 className="text-xs text-muted mb-3 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
            <span>Boundaries held ({scorecard.boundariesHeld.length})</span>
          </h2>
          {scorecard.boundariesHeld.length === 0 ? (
            <p className="text-xs text-muted">No explicit boundaries recorded in this session.</p>
          ) : (
            <div className="space-y-3">
              {scorecard.boundariesHeld.map((b, idx) => (
                <div key={idx} className="p-3 rounded bg-surface-subtle border border-border text-xs">
                  <span className="text-[10px] text-muted block mb-1">Turn {b.turnIndex}:</span>
                  <blockquote className="text-foreground mb-1.5">“{b.quote}”</blockquote>
                  <p className="text-muted text-[11px] leading-relaxed">{b.praise}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
