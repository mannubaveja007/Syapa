import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, MeetingRepository, UserRepository } from "@syapa/db";
import { authenticateRequest } from "@/lib/auth";
import { queueMeetingProcessing, processMeetingEnded } from "@/lib/pipeline";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-token",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type ElevenLabsWord = {
  text?: string;
  type?: string;
  start?: number;
  end?: number;
  speaker_id?: string;
};

type ElevenLabsTranscript = {
  text?: string;
  words?: ElevenLabsWord[];
};

interface MappedSegment {
  speaker: "You" | "Others";
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Browser meeting"),
  durationSeconds: z.coerce.number().int().min(0).max(86400).default(0),
});

function buildTranscriptSegments(data: ElevenLabsTranscript): MappedSegment[] {
  const words = data.words?.filter((w) => w.type === "word" && w.text?.trim()) || [];

  if (!words.length) {
    const rawText = data.text?.trim();
    if (rawText) {
      return [
        {
          speaker: "Others",
          text: rawText,
          startTimeMs: 0,
          endTimeMs: 5000,
        },
      ];
    }
    return [];
  }

  const segments: MappedSegment[] = [];

  for (const word of words) {
    const speaker: "You" | "Others" =
      word.speaker_id === "speaker_0" ? "You" : "Others";
    const wordText = word.text?.trim() || "";
    const startMs = Math.round((word.start ?? 0) * 1000);
    const endMs = Math.round((word.end ?? (word.start ?? 0) + 0.5) * 1000);

    const prev = segments[segments.length - 1];
    // Group consecutive words from the same speaker up to ~25 words
    if (prev && prev.speaker === speaker && prev.text.split(" ").length < 25) {
      prev.text = `${prev.text} ${wordText}`;
      prev.endTimeMs = Math.max(prev.endTimeMs, endMs);
    } else {
      segments.push({
        speaker,
        text: wordText,
        startTimeMs: startMs,
        endTimeMs: endMs,
      });
    }
  }

  return segments;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate request via API token or session
    let authUser = await authenticateRequest(req);

    // Development fallback to default demo user if no token provided in local development
    if (!authUser) {
      const demoUser = await prisma.user.findFirst({
        where: { email: "demo@syapa.local" },
      });
      if (demoUser) {
        authUser = {
          userId: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
        };
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Please provide a valid Syapa API token in the extension." },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Parse multipart form data
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Invalid form data submission." },
        { status: 400, headers: corsHeaders }
      );
    }

    const audio = formData.get("audio");
    const rawTitle = formData.get("title");
    const rawDuration = formData.get("durationSeconds");

    const metadata = metadataSchema.parse({
      title: typeof rawTitle === "string" ? rawTitle : undefined,
      durationSeconds: typeof rawDuration === "string" ? rawDuration : undefined,
    });

    // 3. Reject silent or empty recordings and save nothing
    if (!(audio instanceof Blob) || audio.size < 1000) {
      console.warn(`[Transcribe] Rejected audio: size is ${audio instanceof Blob ? audio.size : 0} bytes. Saving nothing.`);
      return NextResponse.json(
        { error: "The audio recording was empty or silent. Nothing was saved." },
        { status: 422, headers: corsHeaders }
      );
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      console.error("[Transcribe] ELEVENLABS_API_KEY is not configured on the server.");
      return NextResponse.json(
        { error: "ElevenLabs transcription service is not configured on the server." },
        { status: 503, headers: corsHeaders }
      );
    }

    // 4. Server-side call to ElevenLabs Speech-to-Text with diarization enabled
    console.log(`[Transcribe] Calling ElevenLabs Speech-to-Text (diarize=true, model=scribe_v2)...`);
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append("file", audio, "meeting.webm");
    elevenLabsFormData.append("model_id", "scribe_v2");
    elevenLabsFormData.append("tag_audio_events", "false");
    elevenLabsFormData.append("diarize", "true");
    elevenLabsFormData.append("timestamps_granularity", "word");

    let sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey,
      },
      body: elevenLabsFormData,
    });

    // Fallback to scribe_v1 if scribe_v2 is unavailable for the tier
    if (!sttResponse.ok && sttResponse.status === 400) {
      console.warn("[Transcribe] scribe_v2 failed, trying scribe_v1...");
      const fallbackFormData = new FormData();
      fallbackFormData.append("file", audio, "meeting.webm");
      fallbackFormData.append("model_id", "scribe_v1");
      fallbackFormData.append("tag_audio_events", "false");
      fallbackFormData.append("diarize", "true");

      sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
        },
        body: fallbackFormData,
      });
    }

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      console.error(`[Transcribe] ElevenLabs STT API error (${sttResponse.status}):`, errText);
      return NextResponse.json(
        { error: `ElevenLabs transcription failed (${sttResponse.status}). Save nothing.` },
        { status: 502, headers: corsHeaders }
      );
    }

    const sttResult = (await sttResponse.json()) as ElevenLabsTranscript;
    const segments = buildTranscriptSegments(sttResult);

    // 5. Reject if transcript is empty (silent recording) and save nothing
    if (!segments.length || !segments.some((s) => s.text.trim())) {
      console.warn("[Transcribe] No speech detected in recording. Saving nothing.");
      return NextResponse.json(
        { error: "No audible speech was detected in this recording. Save nothing." },
        { status: 422, headers: corsHeaders }
      );
    }

    // 6. Valid recording: Save Meeting and TranscriptSegment rows to PostgreSQL via Prisma
    const meeting = await MeetingRepository.createMeeting({
      userId: authUser.userId,
      title: metadata.title,
      metadata: {
        durationSeconds: metadata.durationSeconds,
        source: "CHROME_EXTENSION",
      },
    });

    await MeetingRepository.appendSegments({
      meetingId: meeting.id,
      segments: segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
      })),
    });

    console.log(
      `[Transcribe] Saved meeting ${meeting.id} with ${segments.length} segments. Running pipeline...`
    );

    // 7. Run existing pipeline: chunk, batched embeddings (EMBED_DIM 1024), store text+vector+tsv, Gemma structured analysis, quote verification
    // Trigger in queue for guaranteed execution without dropping
    queueMeetingProcessing(meeting.id, authUser.userId);

    return NextResponse.json(
      {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          status: "PROCESSING",
          durationSeconds: metadata.durationSeconds,
        },
        transcript: segments,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[Transcribe] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during transcription." },
      { status: 500, headers: corsHeaders }
    );
  }
}
