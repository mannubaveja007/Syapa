import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (apiKey && apiKey.trim()) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey.trim(),
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          token: data.token,
          isMock: false,
        });
      }

      const errText = await response.text();
      console.warn("[STT Token] ElevenLabs single-use token request failed:", response.status, errText);
    } catch (err: any) {
      console.warn("[STT Token] Error calling ElevenLabs API:", err?.message || err);
    }
  }

  // Graceful fallback for local development without live ElevenLabs credit
  return NextResponse.json({
    token: `dev_mock_sutkn_${Date.now()}`,
    isMock: true,
    warning: "Running in mock STT mode (provide a valid ELEVENLABS_API_KEY in .env for production speech-to-text).",
  });
}
