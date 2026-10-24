import { z } from "zod";
import { MeetingRepository, DocumentChunkRepository, AiUsageRepository } from "@syapa/db";
import {
  llmClient,
  embeddingsClient,
  chunkTranscriptSegments,
  verifyAndFilterQuotes,
} from "@syapa/ai";

const RawLLMAnalysisSchema = z.object({
  summary: z.string().describe("A concise executive summary of the meeting agreements, discussions, and decisions."),
  actionItems: z.array(z.string()).describe("Concrete next steps and action items for both parties."),
  requestedWork: z.array(
    z.object({
      task: z.string().describe("Description of the work or feature requested"),
      quote: z.string().describe("EXACT verbatim quote from the transcript proving the request"),
      speaker: z.enum(["You", "Others"]).optional(),
      isScopeCreep: z.boolean().describe("Whether this request lies outside typical initial scope"),
    })
  ).describe("List of all specific work items requested during the meeting"),
  riskyCommitments: z.array(
    z.object({
      quote: z.string().describe("EXACT verbatim quote of a promise or ambiguous concession made by the freelancer"),
      risk: z.string().describe("Why this commitment creates financial or scope risk"),
      recommendedReply: z.string().describe("A more assertive, professional alternative wording"),
    })
  ).default([]).describe("Flagged free promises, scope giveaways, or vague commitments made by the freelancer"),
  suggestions: z.array(
    z.object({
      title: z.string().describe("Short punchy title for this negotiation/scope advice"),
      description: z.string().describe("Detailed advice on how to handle the situation professionally"),
      category: z.enum(["SCOPE_BOUNDARY", "PRICE_ANCHOR", "PROCESS_AGREEMENT", "FOLLOW_UP"]).describe("Category of advice"),
      exactQuote: z.string().nullable().optional().describe("Verbatim quote from transcript motivating this advice"),
      recommendedAction: z.string().describe("Immediate concrete action to take (e.g. email template or change order proposal)"),
      priority: z.number().int().min(1).max(5).default(1).describe("1 = highest priority, 5 = lowest"),
    })
  ).default([]).describe("Actionable negotiation and boundary coaching suggestions"),
  crossMeetingPatterns: z.array(
    z.object({
      pattern: z.string().describe("Recurring theme, request, or habit observed across multiple meetings"),
      risk: z.string().describe("Cumulative risk to the project timeline or relationship"),
      advice: z.string().describe("How the freelancer should break the pattern and take control"),
    })
  ).default([]).describe("Patterns detected when comparing against past meeting records"),
});

class AsyncJobQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = false;

  enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.processNext();
  }

  private async processNext() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const nextTask = this.queue.shift();
    if (nextTask) {
      try {
        await nextTask();
      } catch (err) {
        console.error("[AsyncJobQueue] Background pipeline job failed:", err);
      } finally {
        this.running = false;
        this.processNext();
      }
    }
  }
}

export const pipelineJobQueue = new AsyncJobQueue();

export function queueMeetingProcessing(meetingId: string, userId: string) {
  pipelineJobQueue.enqueue(() => processMeetingEnded(meetingId, userId));
}

export async function processMeetingEnded(meetingId: string, userId: string) {
  console.log(`[Pipeline] Starting post-meeting processing for meeting ${meetingId}...`);
  await MeetingRepository.updateStatus(meetingId, "PROCESSING", new Date());

  try {
    const segments = await MeetingRepository.getSegmentsByMeetingId(meetingId);

    if (!segments || segments.length === 0) {
      console.log(`[Pipeline] Meeting ${meetingId} has no transcript segments. Marking completed.`);
      await MeetingRepository.saveMeetingAnalysis({
        meetingId,
        summary: "No audio transcript recorded during this meeting.",
        actionItems: [],
        requestedWork: [],
        riskyCommitments: [],
        patterns: [],
        suggestions: [],
        droppedQuotesCount: 0,
      });
      return;
    }

    // 1. Assemble full transcript text for quote verification
    const fullTranscriptText = segments
      .map((s) => `[${s.speaker}]: ${s.text}`)
      .join("\n");

    // 2. Fetch past completed meetings for cross-meeting pattern detection
    const pastMeetings = await MeetingRepository.getPastCompletedMeetings(userId, meetingId, 3);
    const pastContextStr = pastMeetings.length > 0
      ? `\n\nPAST COMPLETED MEETINGS FOR THIS FREELANCER (USE TO DETECT CROSS-MEETING PATTERNS):\n` +
        pastMeetings.map((pm, idx) => `[Past Meeting ${idx + 1}: "${pm.title}"]\nSummary: ${pm.summary || "N/A"}\nRisky Commitments: ${JSON.stringify(pm.riskyCommitments || [])}`).join("\n\n")
      : "\n\nNo past meetings recorded for cross-meeting pattern detection.";

    // 3. Chunk transcript (~300-500 words with overlap)
    const chunks = chunkTranscriptSegments(segments, 350, 50);
    console.log(`[Pipeline] Created ${chunks.length} chunks for meeting ${meetingId}`);

    // 4. Batched embeddings: exactly ONE HTTP request for all chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embeddingsClient.embedBatch(chunkTexts);

    // 5. Store embedded chunks with pgvector(1024) and embeddingModel
    for (let i = 0; i < chunks.length; i++) {
      await DocumentChunkRepository.storeChunk({
        userId,
        meetingId,
        contextType: "MEETING_CHUNK",
        chunkIndex: chunks[i].chunkIndex,
        content: chunks[i].content,
        metadata: chunks[i].metadata,
        embedding: embeddings[i],
        embeddingModel: embeddingsClient.getModel(),
      });
    }

    // 6. Single Gemma call with JSON-schema output
    const systemPrompt = `You are an elite freelance intelligence assistant analyzing a meeting transcript.
Extract the following in strict JSON:
1. summary: A factual executive summary of agreements, discussions, and next steps.
2. actionItems: Array of concrete tasks.
3. requestedWork: Array of work items with EXACT verbatim quotes from the transcript.
4. riskyCommitments: Array of any free promises, scope giveaways, or vague concessions the freelancer ("You") made. Quote the exact phrase, explain the risk, and provide an assertive recommended alternative.
5. suggestions: Array of high-leverage tactical suggestions (top 3-5) categorized by SCOPE_BOUNDARY, PRICE_ANCHOR, PROCESS_AGREEMENT, or FOLLOW_UP. Include exact verbatim quote if applicable and concrete recommended action.
6. crossMeetingPatterns: Array of recurring client habits or freelancer vulnerabilities identified across the current call and past meetings.`;

    const userPrompt = `Here is the current meeting transcript:\n\n${fullTranscriptText}\n\n${pastContextStr}\n\nReturn strict JSON matching the schema.`;

    const rawAnalysis = await llmClient.structuredOutput(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      RawLLMAnalysisSchema,
      "MeetingAnalysisSchema",
      {
        callType: "MEETING_ANALYSIS",
        onUsage: async (u) => {
          await AiUsageRepository.logUsage(u);
        },
      }
    );

    // 7. Deterministic quote verification in plain code
    const { verified: verifiedWork, droppedCount: droppedWorkCount } = verifyAndFilterQuotes(
      rawAnalysis.requestedWork,
      fullTranscriptText
    );

    const { verified: verifiedRisks, droppedCount: droppedRiskCount } = verifyAndFilterQuotes(
      rawAnalysis.riskyCommitments ?? [],
      fullTranscriptText
    );

    // Verify suggestions quotes
    let droppedSuggestionQuotesCount = 0;
    const verifiedSuggestions = (rawAnalysis.suggestions ?? []).map((s) => {
      if (s.exactQuote && s.exactQuote.trim()) {
        const quoteTrimmed = s.exactQuote.trim().toLowerCase();
        const transcriptLower = fullTranscriptText.toLowerCase();
        if (!transcriptLower.includes(quoteTrimmed)) {
          droppedSuggestionQuotesCount++;
          return { ...s, exactQuote: null };
        }
      }
      return s;
    });

    const totalDroppedCount = droppedWorkCount + droppedRiskCount + droppedSuggestionQuotesCount;

    console.log(
      `[Pipeline] Verified ${verifiedWork.length} work items, ${verifiedRisks.length} risky commitments, ${verifiedSuggestions.length} suggestions. Dropped ${totalDroppedCount} ungrounded quotes.`
    );

    // 8. Save meeting analysis, suggestions, and cross-meeting patterns
    await MeetingRepository.saveMeetingAnalysis({
      meetingId,
      summary: rawAnalysis.summary,
      actionItems: rawAnalysis.actionItems,
      requestedWork: verifiedWork,
      riskyCommitments: verifiedRisks,
      patterns: rawAnalysis.crossMeetingPatterns ?? [],
      suggestions: verifiedSuggestions,
      droppedQuotesCount: totalDroppedCount,
    });

    console.log(`[Pipeline] Completed post-meeting analysis for meeting ${meetingId}`);
  } catch (err: any) {
    console.error(`[Pipeline] Failed processing meeting ${meetingId}:`, err);
    await MeetingRepository.updateStatus(meetingId, "FAILED");
    throw err;
  }
}
