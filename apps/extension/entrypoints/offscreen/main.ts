import { get, set, del } from "idb-keyval";

interface CommittedSegment {
  speaker: "You" | "Others";
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

let activeMeetingId: string | null = null;
let activeApiToken: string | null = null;
let tabAudioStream: MediaStream | null = null;
let micAudioStream: MediaStream | null = null;
let tabAudioContext: AudioContext | null = null;
let micAudioContext: AudioContext | null = null;
let tabWs: WebSocket | null = null;
let micWs: WebSocket | null = null;
let flushIntervalId: any = null;
let meterIntervalId: any = null;
let meetingStartTime = 0;
let tabVolumeLevel = 0;
let micVolumeLevel = 0;

const QUEUE_KEY = "syapa_pending_segments";

// Convert Float32 audio samples to 16-bit PCM ArrayBuffer
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output.buffer;
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Fetch single-use realtime token from Web App
async function fetchSttToken(apiToken: string): Promise<{ token: string; isMock: boolean }> {
  try {
    const res = await fetch("http://localhost:3000/api/stt/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": apiToken,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[Offscreen] Failed to fetch STT token, falling back to mock mode:", err);
    return { token: "dev_mock_sutkn", isMock: true };
  }
}

// Save committed segment to local IndexedDB queue
async function queueCommittedSegment(segment: CommittedSegment) {
  try {
    const existing = (await get<CommittedSegment[]>(QUEUE_KEY)) || [];
    existing.push(segment);
    await set(QUEUE_KEY, existing);

    // Notify sidepanel of committed segment
    chrome.runtime.sendMessage({
      type: "LIVE_TRANSCRIPT_COMMITTED",
      segment,
    });
  } catch (err) {
    console.error("[Offscreen] Error saving to IndexedDB queue:", err);
  }
}

// Flush pending segments to web backend every 5 seconds
async function flushSegments() {
  if (!activeMeetingId || !activeApiToken) return;

  try {
    const queue = (await get<CommittedSegment[]>(QUEUE_KEY)) || [];
    if (queue.length === 0) return;

    console.log(`[Offscreen] Flushing ${queue.length} segments to meeting ${activeMeetingId}`);
    const res = await fetch(`http://localhost:3000/api/meetings/${activeMeetingId}/segments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": activeApiToken,
      },
      body: JSON.stringify({ segments: queue }),
    });

    if (res.ok) {
      await del(QUEUE_KEY);
      console.log("[Offscreen] Segments successfully flushed and local queue cleared");
    }
  } catch (err) {
    console.warn("[Offscreen] Flush failed (offline or network error), retaining in queue:", err);
  }
}

async function startCapture(streamId: string, meetingId: string, apiToken: string) {
  activeMeetingId = meetingId;
  activeApiToken = apiToken;
  meetingStartTime = Date.now();

  const { token, isMock } = await fetchSttToken(apiToken);

  // 1. Capture Tab Audio
  try {
    tabAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      } as any,
      video: false,
    });
  } catch (err) {
    console.error("[Offscreen] Failed to capture tab audio:", err);
  }

  // 2. Capture Microphone Audio
  try {
    micAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
  } catch (err) {
    console.error("[Offscreen] Failed to capture mic audio:", err);
  }

  // Setup WebSocket / STT for Tab Audio ("Others")
  setupStreamProcessor(tabAudioStream, "Others", token, isMock);

  // Setup WebSocket / STT for Mic Audio ("You")
  setupStreamProcessor(micAudioStream, "You", token, isMock);

  // Start periodic 5s flush loop
  flushIntervalId = setInterval(flushSegments, 5000);

  // Broadcast volume levels every 200ms
  meterIntervalId = setInterval(() => {
    chrome.runtime.sendMessage({
      type: "AUDIO_LEVEL_UPDATE",
      tabVolume: tabVolumeLevel,
      micVolume: micVolumeLevel,
    });
  }, 200);
}

function setupStreamProcessor(
  stream: MediaStream | null,
  speaker: "You" | "Others",
  token: string,
  isMock: boolean
) {
  if (!stream) return;

  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);

  // ScriptProcessor or AudioWorklet for resampling and chunk streaming
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioCtx.destination);

  let ws: WebSocket | null = null;

  if (!isMock && token && !token.startsWith("dev_mock")) {
    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${token}&audio_format=pcm_16000`;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const elapsed = Date.now() - meetingStartTime;

          if (data.message_type === "partial_transcript" && data.text) {
            chrome.runtime.sendMessage({
              type: "LIVE_TRANSCRIPT_PARTIAL",
              speaker,
              text: data.text,
            });
          } else if (data.message_type === "committed_transcript" && data.text) {
            queueCommittedSegment({
              speaker,
              text: data.text,
              startTimeMs: Math.max(0, elapsed - 4000),
              endTimeMs: elapsed,
            });
          }
        } catch (e) {
          console.error(e);
        }
      };
    } catch (e) {
      console.error("[Offscreen] WebSocket connection error:", e);
    }
  }

  // Audio chunk handler
  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);

    // Compute simple RMS volume level
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);
    const volume = Math.min(100, Math.round(rms * 250));

    if (speaker === "You") micVolumeLevel = volume;
    else tabVolumeLevel = volume;

    // Convert to 16 kHz PCM16
    const pcm16 = floatTo16BitPCM(inputData);

    if (ws && ws.readyState === WebSocket.OPEN) {
      const base64 = arrayBufferToBase64(pcm16);
      ws.send(JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: base64,
        commit: false,
      }));
    }
  };

  // Mock simulation runner if in local dev mock mode
  if (isMock) {
    let mockTick = 0;
    const mockInterval = setInterval(() => {
      if (!activeMeetingId) {
        clearInterval(mockInterval);
        return;
      }
      mockTick++;

      const samples = speaker === "You"
        ? [
            "I checked our timeline, and the baseline milestone delivers on Friday.",
            "Any custom Flutter mobile builds require a separate change order and budget.",
            "We agreed to cap revisions at two rounds to maintain schedule certainty.",
          ]
        : [
            "Could we also add an export feature and dark mode to this initial sprint?",
            "Our executives want to know if mobile support can be included for free.",
            "Let's make sure the delivery includes full editable design files.",
          ];

      if (mockTick % 3 === 0) {
        const text = samples[Math.floor(Math.random() * samples.length)];
        const elapsed = Date.now() - meetingStartTime;

        // Emit partial first
        chrome.runtime.sendMessage({
          type: "LIVE_TRANSCRIPT_PARTIAL",
          speaker,
          text: text.slice(0, Math.floor(text.length / 2)) + "...",
        });

        // Then commit
        setTimeout(() => {
          if (activeMeetingId) {
            queueCommittedSegment({
              speaker,
              text,
              startTimeMs: Math.max(0, elapsed - 3000),
              endTimeMs: elapsed,
            });
          }
        }, 1200);
      }
    }, 4500);
  }
}

async function stopCapture() {
  console.log("[Offscreen] Stopping audio capture and flushing remaining segments...");

  // Final flush
  await flushSegments();

  if (flushIntervalId) clearInterval(flushIntervalId);
  if (meterIntervalId) clearInterval(meterIntervalId);

  tabAudioStream?.getTracks().forEach((t) => t.stop());
  micAudioStream?.getTracks().forEach((t) => t.stop());

  tabAudioContext?.close().catch(() => {});
  micAudioContext?.close().catch(() => {});

  tabWs?.close();
  micWs?.close();

  // Notify web backend that meeting ended
  if (activeMeetingId && activeApiToken) {
    try {
      await fetch(`http://localhost:3000/api/meetings/${activeMeetingId}/end`, {
        method: "POST",
        headers: { "x-api-token": activeApiToken },
      });
    } catch (err) {
      console.error("[Offscreen] Failed to notify meeting end:", err);
    }
  }

  activeMeetingId = null;
  activeApiToken = null;
}

// Runtime message listener
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_OFFSCREEN_CAPTURE") {
    startCapture(msg.streamId, msg.meetingId, msg.apiToken);
  } else if (msg.type === "STOP_OFFSCREEN_CAPTURE") {
    stopCapture();
  }
});
