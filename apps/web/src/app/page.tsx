import Link from "next/link";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ArrowRight, Mic, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20">
        {/* HERO SECTION */}
        <section className="mb-20">
          <div className="max-w-2xl mb-8">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground mb-4">
              Defend your scope and pricing
            </h1>
            <p className="text-base sm:text-lg text-muted mb-8 leading-relaxed">
              Record client meetings live and practice negotiations against grounded AI simulations.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover inline-flex items-center gap-2"
              >
                <span>Start practicing now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-surface-subtle"
              >
                View dashboard
              </Link>
            </div>
          </div>

          {/* REAL PRODUCT SIGNATURE: DUAL-FACED DEMONSTRATION */}
          <div className="border border-border rounded-lg bg-surface overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* LEFT: Live Audio Capture Demonstration */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="w-2 h-2 rounded-full bg-[var(--success)] motion-safe:animate-pulse" />
                    <span className="font-mono text-[11px]">audio_stream_active</span>
                  </div>
                  <span className="text-xs text-muted">16 kHz mono PCM16</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-surface-subtle border border-border">
                    <span className="text-muted block text-[11px] mb-1">[Others • Client 14:02:18]</span>
                    <p className="text-foreground">
                      Could you also throw in a mobile app build for next week? It should not take much extra work.
                    </p>
                  </div>
                  <div className="p-3 rounded bg-surface-subtle border border-border">
                    <span className="text-muted block text-[11px] mb-1">[You • Freelancer 14:02:29]</span>
                    <p className="text-foreground">
                      Mobile requires dedicated architecture. That is outside our current brief and requires a change order.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>Dual-stream tab + mic capture</span>
                <span className="text-foreground">ElevenLabs Scribe STT</span>
              </div>
            </div>

            {/* RIGHT: Bad Client Simulator Demonstration */}
            <div className="p-6 flex flex-col justify-between bg-surface-subtle/50">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    <span>Bad client simulation</span>
                  </div>
                  <span className="text-xs border border-border px-2 py-0.5 rounded text-muted">Difficulty: 3/3</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-surface border border-border">
                    <span className="text-destructive font-medium block text-[11px] mb-1">Bad Client (Scope Creeper)</span>
                    <p className="text-foreground leading-relaxed">
                      “If you are going to charge extra for basic mobile views, we may have to reconsider the entire engagement. Other freelancers include this as standard.”
                    </p>
                  </div>
                  <div className="p-3 rounded bg-surface border border-border">
                    <span className="text-muted font-medium block text-[11px] mb-1">Negotiation Scorecard (Turn 4)</span>
                    <p className="text-foreground leading-relaxed">
                      Boundary held firmly on turn 3 (+8 trust). Price anchor preserved at $5,000 baseline.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>Grounded retrieval</span>
                <span className="text-foreground">70% vector + 30% text rank</span>
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOW PIPELINE SECTIONS */}
        <section className="mb-20">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-2">
              How the platform protects your work
            </h2>
            <p className="text-sm text-muted">
              From real-time meeting transcription to structured negotiation training.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg border border-border bg-surface">
              <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center mb-4">
                <Mic className="w-4 h-4 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">1. Browser tab & mic recording</h3>
              <p className="text-xs text-muted leading-relaxed">
                Chrome MV3 extension captures both audio channels independently, streaming 16 kHz PCM16 to ElevenLabs Scribe over WebSocket.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border bg-surface">
              <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center mb-4">
                <FileText className="w-4 h-4 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">2. Quote-verified extraction</h3>
              <p className="text-xs text-muted leading-relaxed">
                Post-meeting pipeline chunks transcripts, embeds with pgvector, and extracts scope requests. Non-existent quotes are deterministically dropped.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border bg-surface">
              <div className="w-8 h-8 rounded bg-surface-subtle border border-border flex items-center justify-center mb-4">
                <ShieldAlert className="w-4 h-4 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">3. Bad Client sparring partner</h3>
              <p className="text-xs text-muted leading-relaxed">
                Practice against 5 distinct client personas armed with hidden asks and patience meters, concluding in an unsparing negotiation scorecard.
              </p>
            </div>
          </div>
        </section>

        {/* REVIEWS & SCORECARD ANATOMY */}
        <section className="p-6 sm:p-8 rounded-lg border border-border bg-surface mb-20">
          <div className="max-w-xl mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Actionable negotiation scorecards
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              Every simulation concludes with a complete post-mortem. We reveal the client’s hidden patience timeline, free concessions conceded, and three high-leverage rewrites.
            </p>
          </div>

          <div className="border border-border rounded bg-surface-subtle p-4 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] text-muted">
              <span>Scorecard #8812</span>
              <span>Overall Score: 78/100</span>
            </div>
            <div>
              <span className="text-muted block text-[11px] mb-1">Turn 3 Weakness:</span>
              <p className="text-foreground">“I can try to see if we can fit that in without charging extra.”</p>
            </div>
            <div>
              <span className="text-foreground font-semibold block text-[11px] mb-1">Recommended Rewrite:</span>
              <p className="text-foreground">“We can certainly include that feature. Let me send a change order with the revised timeline and additional cost.”</p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="text-center py-10 border-t border-border">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Ready to train against difficult clients?
          </h2>
          <p className="text-xs text-muted mb-6 max-w-md mx-auto">
            Connect your extension, upload your briefs, and never get ambushed on scope again.
          </p>
          <Link
            href="/register"
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-xs font-medium hover:bg-primary-hover inline-flex items-center gap-2"
          >
            <span>Create free local account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      </div>
    </SmoothScroll>
  );
}
