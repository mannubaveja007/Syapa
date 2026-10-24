import { z } from "zod";
import { MeetingRepository, DocumentChunkRepository, AiUsageRepository } from "@syapa/db";
import {
  llmClient,
  embeddingsClient,
  chunkTranscriptSegments,
  verifyAndFilterQuotes,
} from "@syapa/ai";

const RawLLMAnalysisSchema = z.object({
  summary: z.string().describe("A concise summary of the meeting, key discussion points, and agreements."),
  actionItems: z.array(z.string()).describe("Concrete next steps and action items."),
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
});

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
        droppedQuotesCount: 0,
      });
      return;
    }

    // 1. Assemble full transcript text for quote verification
    const fullTranscriptText = segments
      .map((s) => `[${s.speaker}]: ${s.text}`)
      .join("\n");

    // 2. Chunk transcript (~300-500 words with overlap)
    const chunks = chunkTranscriptSegments(segments, 350, 50);
    console.log(`[Pipeline] Created ${chunks.length} chunks for meeting ${meetingId}`);

    // 3. Batched embeddings: exactly ONE HTTP request for all chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embeddingsClient.embedBatch(chunkTexts);

    // 4. Store embedded chunks with pgvector(1024) and embeddingModel
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

    // 5. Ask LLM for summary, action items, work requests, and risky commitments
    const systemPrompt = `You are an elite freelance intelligence assistant analyzing a meeting transcript.
Extract the following in strict JSON:
1. summary: A factual summary of agreements and next steps.
2. actionItems: Array of concrete tasks.
3. requestedWork: Array of work items with EXACT verbatim quotes from the transcript.
4. riskyCommitments: Array of any free promises, scope giveaways, or vague concessions the freelancer ("You") made. Quote the exact phrase, explain the risk, and provide an assertive recommended alternative.`;

    const userPrompt = `Here is the meeting transcript:\n\n${fullTranscriptText}\n\nReturn strict JSON matching the schema.`;

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

    // 6. Deterministic quote verification in plain code for both requestedWork and riskyCommitments
    const { verified: verifiedWork, droppedCount: droppedWorkCount } = verifyAndFilterQuotes(
      rawAnalysis.requestedWork,
      fullTranscriptText
    );

    const { verified: verifiedRisks, droppedCount: droppedRiskCount } = verifyAndFilterQuotes(
      rawAnalysis.riskyCommitments ?? [],
      fullTranscriptText
    );

    const totalDroppedCount = droppedWorkCount + droppedRiskCount;

    console.log(
      `[Pipeline] Verified ${verifiedWork.length} work items, ${verifiedRisks.length} risky commitments. Dropped ${totalDroppedCount} ungrounded quotes.`
    );

    // 7. Save meeting analysis
    await MeetingRepository.saveMeetingAnalysis({
      meetingId,
      summary: rawAnalysis.summary,
      actionItems: rawAnalysis.actionItems,
      requestedWork: verifiedWork,
      riskyCommitments: verifiedRisks,
      droppedQuotesCount: totalDroppedCount,
    });

    console.log(`[Pipeline] Completed post-meeting analysis for meeting ${meetingId}`);
  } catch (err: any) {
    console.error(`[Pipeline] Failed processing meeting ${meetingId}:`, err);
    await MeetingRepository.updateStatus(meetingId, "FAILED");
    throw err;
  }
}
