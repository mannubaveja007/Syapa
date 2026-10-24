import { z } from "zod";
import { MeetingRepository, DocumentChunkRepository } from "@syapa/db";
import {
  llmClient,
  embeddingsClient,
  chunkTranscriptSegments,
  verifyAndFilterQuotes,
} from "@syapa/ai";
import { RequestedWorkItemSchema } from "@syapa/shared";

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

    // 3. Embed chunks in batch
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embeddingsClient.embedBatch(chunkTexts);

    // 4. Store embedded chunks with pgvector
    for (let i = 0; i < chunks.length; i++) {
      await DocumentChunkRepository.storeChunk({
        userId,
        meetingId,
        contextType: "MEETING_CHUNK",
        chunkIndex: chunks[i].chunkIndex,
        content: chunks[i].content,
        metadata: chunks[i].metadata,
        embedding: embeddings[i],
      });
    }

    // 5. Ask Gemma 4 for summary, action items, and work requests with exact quotes
    const systemPrompt = `You are a precision meeting analysis assistant for freelancers.
Analyze the provided meeting transcript. Extract:
1. summary: A factual 2-3 paragraph summary of the meeting.
2. actionItems: An array of concrete next steps.
3. requestedWork: An array of work requests, each containing:
   - task: description of the task
   - quote: an EXACT VERBATIM quote from the transcript supporting this request. Do NOT alter or paraphrase any words in the quote.
   - speaker: "You" or "Others"
   - isScopeCreep: boolean indicating if this is an extra or creeping demand.`;

    const userPrompt = `Here is the meeting transcript:\n\n${fullTranscriptText}\n\nProvide the analysis in strict JSON matching the schema.`;

    const rawAnalysis = await llmClient.structuredOutput(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      RawLLMAnalysisSchema,
      "MeetingAnalysisSchema"
    );

    // 6. Deterministic quote verification in plain code
    const { verified: verifiedWork, droppedCount } = verifyAndFilterQuotes(
      rawAnalysis.requestedWork,
      fullTranscriptText
    );

    console.log(
      `[Pipeline] Verified ${verifiedWork.length} work items. Dropped ${droppedCount} ungrounded quotes.`
    );

    // 7. Save meeting analysis
    await MeetingRepository.saveMeetingAnalysis({
      meetingId,
      summary: rawAnalysis.summary,
      actionItems: rawAnalysis.actionItems,
      requestedWork: verifiedWork,
      droppedQuotesCount: droppedCount,
    });

    console.log(`[Pipeline] Completed processing for meeting ${meetingId}`);
  } catch (err: any) {
    console.error(`[Pipeline] Failed processing meeting ${meetingId}:`, err);
    await MeetingRepository.updateStatus(meetingId, "FAILED");
    throw err;
  }
}
