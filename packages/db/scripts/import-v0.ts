import dotenv from "dotenv";
import path from "node:path";
import { Client } from "pg";
import { z } from "zod";

// Load .env.local first, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { prisma } from "../src/client";
import { DocumentChunkRepository } from "../src/repositories/chunk.repository";
import {
  llmClient,
  embeddingsClient,
  chunkTranscriptSegments,
  verifyAndFilterQuotes,
} from "../../ai/src";

interface V0TranscriptItem {
  speaker?: string;
  text?: string;
  start?: number;
  end?: number;
}

interface V0MeetingRow {
  id: string;
  title: string;
  duration_seconds?: number;
  durationSeconds?: number;
  transcript?: any;
  summary?: string;
  action_items?: any;
  actionItems?: any;
  created_at?: Date;
  createdAt?: Date;
}

const GemmaAnalysisSchema = z.object({
  summary: z.string(),
  actionItems: z.array(z.string()).default([]),
  suggestions: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      category: z.enum(["SAY", "AVOID", "RISK", "SCOPE_BOUNDARY", "PRICE_ANCHOR", "PROCESS_AGREEMENT", "ACTION"]),
      exactQuote: z.string().nullable().optional(),
      recommendedAction: z.string(),
      priority: z.number().int().min(1).max(5).default(1),
    })
  ).default([]),
});

export async function inspectV0Database(v0DbUrl: string) {
  const client = new Client({ connectionString: v0DbUrl });
  await client.connect();

  try {
    // 1. Schema info
    const schemaRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'meetings'
      ORDER BY ordinal_position;
    `);

    console.log("\n================ V0 MEETINGS TABLE SCHEMA ================");
    console.table(schemaRes.rows);

    // 2. Sample row
    const sampleRes = await client.query(`
      SELECT * FROM meetings LIMIT 1;
    `);

    console.log("\n================ SAMPLE V0 ROW ================");
    if (sampleRes.rows.length === 0) {
      console.log("No rows found in v0 meetings table.");
      return { schema: schemaRes.rows, sample: null, hasSpeakerLabels: false };
    }

    const row = sampleRes.rows[0];
    const transcriptSample = typeof row.transcript === "string" 
      ? row.transcript.slice(0, 300) 
      : JSON.stringify(row.transcript).slice(0, 300);

    console.log({
      id: row.id,
      title: row.title,
      duration: row.duration_seconds ?? row.durationSeconds,
      summary: (row.summary || "").slice(0, 100) + "...",
      actionItems: row.action_items ?? row.actionItems,
      transcriptSample: transcriptSample + "...",
      created_at: row.created_at ?? row.createdAt,
    });

    // Check transcript format
    let hasSpeakerLabels = false;
    if (Array.isArray(row.transcript)) {
      hasSpeakerLabels = row.transcript.some((t: any) => Boolean(t.speaker || t.speaker_id));
    } else if (typeof row.transcript === "string") {
      hasSpeakerLabels = /^(You|Others|Speaker\s*\d+|[A-Za-z]+)\s*:/im.test(row.transcript);
    }

    console.log(`\nTranscript format: ${hasSpeakerLabels ? "Contains speaker labels" : "Plain text / no speaker labels (requires line fallback)"}`);
    return { schema: schemaRes.rows, sample: row, hasSpeakerLabels };
  } finally {
    await client.end();
  }
}

export async function importV0Meetings(v0DbUrl: string) {
  console.log("\n[Import-v0] Starting import from V0_DATABASE_URL...");
  const client = new Client({ connectionString: v0DbUrl });
  await client.connect();

  try {
    // Fetch all meetings from v0
    const res = await client.query<V0MeetingRow>(`SELECT * FROM meetings ORDER BY created_at ASC;`);
    console.log(`[Import-v0] Found ${res.rows.length} meetings in v0 database.`);

    // 1. Ensure demo user exists
    let demoUser = await prisma.user.findUnique({ where: { email: "demo@syapa.local" } });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          name: "Demo Freelancer",
          email: "demo@syapa.local",
          passwordHash: "$2a$10$wT1mX7g2YvW5t4Qp0u8eEe8kG3G4K5L6M7N8O9P0Q1R2S3T4U5V6W",
        },
      });
      console.log(`[Import-v0] Created demo user: ${demoUser.email} (${demoUser.id})`);
    }

    for (const v0Row of res.rows) {
      const v0Id = String(v0Row.id);
      const title = v0Row.title || "v0 Untitled Meeting";
      const durationSeconds = Number(v0Row.duration_seconds ?? v0Row.durationSeconds ?? 300);
      const durationMs = durationSeconds * 1000;
      const createdAt = v0Row.created_at ?? v0Row.createdAt ?? new Date();

      // Check idempotency: skip if already imported
      const existing = await prisma.meeting.findFirst({
        where: {
          metadata: {
            path: ["v0Id"],
            equals: v0Id,
          },
        },
      });

      if (existing) {
        console.log(`[Import-v0] Meeting "${title}" (v0Id: ${v0Id}) already imported as ${existing.id}. Skipping.`);
        continue;
      }

      console.log(`\n[Import-v0] Importing meeting: "${title}" (v0Id: ${v0Id})...`);

      // Parse transcript into segments
      const segmentsToInsert: Array<{
        speaker: "You" | "Others";
        text: string;
        startTimeMs: number;
        endTimeMs: number;
        estimated?: boolean;
      }> = [];

      let rawTranscript = v0Row.transcript;
      if (typeof rawTranscript === "string") {
        try {
          rawTranscript = JSON.parse(rawTranscript);
        } catch {
          // Keep as string
        }
      }

      if (Array.isArray(rawTranscript) && rawTranscript.length > 0) {
        for (let i = 0; i < rawTranscript.length; i++) {
          const item = rawTranscript[i];
          const rawSpeaker = item.speaker || item.speaker_id || "Others";
          const speaker: "You" | "Others" =
            rawSpeaker === "You" || rawSpeaker === "speaker_0" ? "You" : "Others";
          const text = (item.text || "").trim();
          if (!text) continue;

          const startMs = item.start != null ? Math.round(Number(item.start) * 1000) : i * 5000;
          const endMs = item.end != null ? Math.round(Number(item.end) * 1000) : (i + 1) * 5000;

          segmentsToInsert.push({
            speaker,
            text,
            startTimeMs: startMs,
            endTimeMs: Math.max(startMs + 500, endMs),
            estimated: item.start == null,
          });
        }
      } else if (typeof rawTranscript === "string" && rawTranscript.trim()) {
        const lines = rawTranscript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const totalChars = lines.reduce((acc, l) => acc + l.length, 0) || 1;
        let cumulativeChars = 0;

        for (const line of lines) {
          const lineStartFrac = cumulativeChars / totalChars;
          cumulativeChars += line.length;
          const lineEndFrac = cumulativeChars / totalChars;

          const match = line.match(/^(You|Others|Speaker\s*\d+|[A-Za-z]+)\s*:\s*(.*)$/i);
          let speaker: "You" | "Others" = "Others";
          let content = line;

          if (match) {
            const rawSpk = match[1].toLowerCase();
            speaker = rawSpk === "you" || rawSpk === "speaker 0" ? "You" : "Others";
            content = match[2].trim();
          }

          if (content) {
            segmentsToInsert.push({
              speaker,
              text: content,
              startTimeMs: Math.round(lineStartFrac * durationMs),
              endTimeMs: Math.round(lineEndFrac * durationMs),
              estimated: true,
            });
          }
        }
      } else {
        // Fallback default segment
        segmentsToInsert.push({
          speaker: "Others",
          text: "Meeting audio recording completed without detailed transcript.",
          startTimeMs: 0,
          endTimeMs: durationMs || 5000,
          estimated: true,
        });
      }

      // Create Meeting record
      const meeting = await prisma.meeting.create({
        data: {
          userId: demoUser.id,
          title,
          status: "PROCESSING",
          durationSeconds,
          startTime: createdAt,
          summary: v0Row.summary || "Imported v0 meeting summary",
          metadata: {
            source: "v0-demo",
            isDemo: true,
            v0Id,
            importedAt: new Date().toISOString(),
          },
        },
      });

      // Save segments
      await prisma.transcriptSegment.createMany({
        data: segmentsToInsert.map((s) => ({
          meetingId: meeting.id,
          speaker: s.speaker,
          text: s.text,
          startTimeMs: s.startTimeMs,
          endTimeMs: s.endTimeMs,
        })),
      });

      console.log(`[Import-v0] Created Meeting ${meeting.id} with ${segmentsToInsert.length} segments.`);

      // Map action items from v0
      const rawActionItems = v0Row.action_items ?? v0Row.actionItems ?? [];
      const actionItemsList: string[] = Array.isArray(rawActionItems)
        ? rawActionItems.map(String)
        : typeof rawActionItems === "string"
        ? [rawActionItems]
        : [];

      // Save initial MeetingAnalysis
      const analysis = await prisma.meetingAnalysis.create({
        data: {
          meetingId: meeting.id,
          summary: v0Row.summary || "Summary pending analysis.",
          actionItems: actionItemsList,
          requestedWork: [],
          riskyCommitments: [],
          droppedQuotesCount: 0,
        },
      });

      // Save action items as Suggestion type ACTION
      for (const item of actionItemsList) {
        await prisma.suggestion.create({
          data: {
            meetingAnalysisId: analysis.id,
            title: `Action: ${item.slice(0, 80)}`,
            description: item,
            category: "ACTION",
            recommendedAction: item,
            priority: 1,
          },
        });
      }

      // 3. Run Pipeline: Chunk -> Batched Embeddings (1024 fixed) -> Gemma Analysis (SAY / AVOID / RISK)
      console.log(`[Import-v0] Running AI pipeline on meeting ${meeting.id}...`);
      const chunks = chunkTranscriptSegments(segmentsToInsert, 350, 50);
      const chunkTexts = chunks.map((c) => c.content);

      // Batched OpenRouter embeddings call (EMBED_DIM 1024)
      console.log(`[Import-v0] Generating batched 1024 embeddings for ${chunks.length} chunks...`);
      const embeddings = await embeddingsClient.embedBatch(chunkTexts);

      for (let i = 0; i < chunks.length; i++) {
        await DocumentChunkRepository.storeChunk({
          userId: demoUser.id,
          meetingId: meeting.id,
          contextType: "MEETING_CHUNK",
          chunkIndex: i,
          content: chunks[i].content,
          metadata: {
            ...chunks[i].metadata,
            meetingTitle: title,
            source: "v0-demo",
            isDemo: true,
            v0Id,
          },
          embedding: embeddings[i],
          embeddingModel: embeddingsClient.getModel(),
        });
      }

      // One Gemma analysis call to extract SAY / AVOID / RISK coaching with quotes
      const fullTranscriptText = segmentsToInsert
        .map((s) => `[${s.speaker}]: ${s.text}`)
        .join("\n");

      console.log(`[Import-v0] Requesting Gemma analysis for SAY / AVOID / RISK suggestions...`);
      const prompt = `You are an elite contract negotiation coach for freelancers. Analyze this meeting transcript:
${fullTranscriptText}

Generate high-leverage negotiation coaching in strict JSON:
- summary: 2-3 sentence executive summary
- actionItems: list of concrete action items
- suggestions: array of coaching suggestions. Categorize each strictly as "SAY", "AVOID", "RISK", "SCOPE_BOUNDARY", or "PRICE_ANCHOR". For each, provide:
  - title: short punchy title
  - description: tactical coaching rationale
  - exactQuote: verbatim quote from transcript motivating this
  - recommendedAction: exact suggested script for what to say or change order proposal
  - priority: 1 to 3`;

      try {
        const gemmaResult = await llmClient.structuredOutput(
          [
            { role: "system", content: "You extract tactical negotiation suggestions (SAY, AVOID, RISK) grounded in meeting transcripts." },
            { role: "user", content: prompt },
          ],
          GemmaAnalysisSchema,
          "GemmaMeetingAnalysis"
        );

        // Deterministic quote verification
        let droppedCount = 0;
        const verifiedSuggestions = (gemmaResult.suggestions || []).map((s) => {
          if (s.exactQuote && s.exactQuote.trim()) {
            if (!fullTranscriptText.toLowerCase().includes(s.exactQuote.trim().toLowerCase())) {
              droppedCount++;
              return { ...s, exactQuote: null };
            }
          }
          return s;
        });

        // Update Meeting & Analysis
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: "COMPLETED",
            summary: gemmaResult.summary || v0Row.summary,
            actionItems: gemmaResult.actionItems.length > 0 ? gemmaResult.actionItems : actionItemsList,
            droppedQuotesCount: droppedCount,
          },
        });

        await prisma.meetingAnalysis.update({
          where: { id: analysis.id },
          data: {
            summary: gemmaResult.summary || v0Row.summary,
            actionItems: gemmaResult.actionItems.length > 0 ? gemmaResult.actionItems : actionItemsList,
            droppedQuotesCount: droppedCount,
          },
        });

        for (const s of verifiedSuggestions) {
          await prisma.suggestion.create({
            data: {
              meetingAnalysisId: analysis.id,
              title: s.title,
              description: s.description,
              category: s.category,
              exactQuote: s.exactQuote,
              recommendedAction: s.recommendedAction,
              priority: s.priority,
            },
          });
        }

        console.log(`[Import-v0] Saved ${verifiedSuggestions.length} verified suggestions (SAY/AVOID/RISK) for "${title}".`);
      } catch (err: any) {
        console.warn(`[Import-v0] Gemma analysis warning for meeting ${meeting.id}:`, err?.message || err);
        // Mark as completed even if AI call timed out
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: "COMPLETED" },
        });
      }
    }

    console.log("\n[Import-v0] Import completed successfully!");
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}

async function main() {
  const v0Url = process.env.V0_DATABASE_URL;
  if (!v0Url) {
    console.error("[Error] V0_DATABASE_URL is not set in .env.local or .env. Please provide V0_DATABASE_URL.");
    process.exit(1);
  }

  const mode = process.argv[2];
  if (mode === "--inspect") {
    await inspectV0Database(v0Url);
  } else {
    await inspectV0Database(v0Url);
    await importV0Meetings(v0Url);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[Fatal Error]", err);
    process.exit(1);
  });
}
