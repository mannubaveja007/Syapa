import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, ExternalLink, ShieldAlert, Key, CheckCircle2, RefreshCw } from "lucide-react";

interface TranscriptSegment {
  speaker: "You" | "Others";
  text: string;
  startTimeMs: number;
  endTimeMs: number;
}

export function App() {
  const [mode, setMode] = useState<"idle" | "recording" | "ended">("idle");
  const [apiToken, setApiToken] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Client Strategy Call");
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [partialTranscript, setPartialTranscript] = useState<{ speaker: string; text: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micVolume, setMicVolume] = useState(0);
  const [tabVolume, setTabVolume] = useState(0);
  const [error, setError] = useState("");
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load saved API token from chrome.storage.local
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["syapa_api_token", "syapa_consent"], (res) => {
        if (res.syapa_api_token) setApiToken(res.syapa_api_token);
        if (res.syapa_consent) setConsentAcknowledged(res.syapa_consent);
      });
    }

    // Listen for events from offscreen processor
    const listener = (msg: any) => {
      if (msg.type === "LIVE_TRANSCRIPT_COMMITTED") {
        setSegments((prev) => [...prev, msg.segment]);
        setPartialTranscript(null);
      } else if (msg.type === "LIVE_TRANSCRIPT_PARTIAL") {
        setPartialTranscript({ speaker: msg.speaker, text: msg.text });
      } else if (msg.type === "AUDIO_LEVEL_UPDATE") {
        setTabVolume(msg.tabVolume || 0);
        setMicVolume(msg.micVolume || 0);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Timer loop while recording
  useEffect(() => {
    let timer: any = null;
    if (mode === "recording") {
      timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, partialTranscript]);

  const saveApiToken = (token: string) => {
    setApiToken(token);
    chrome.storage.local.set({ syapa_api_token: token });
  };

  const handleStartRecording = async () => {
    setError("");
    if (!apiToken.trim()) {
      setError("Please provide a Syapa API token from the Web App settings.");
      return;
    }
    if (!consentAcknowledged) {
      setError("Please acknowledge the participant consent reminder first.");
      return;
    }

    try {
      // 1. Create meeting in web app
      const createRes = await fetch("http://localhost:3000/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": apiToken.trim(),
        },
        body: JSON.stringify({ title: meetingTitle.trim() || "Client Strategy Call" }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to connect to Syapa backend at http://localhost:3000");
      }

      const { meeting } = await createRes.json();
      setCurrentMeetingId(meeting.id);
      setSegments([]);
      setElapsedSeconds(0);

      // 2. Instruct background script to start tab capture
      chrome.runtime.sendMessage(
        {
          type: "START_RECORDING",
          meetingId: meeting.id,
          apiToken: apiToken.trim(),
        },
        (res) => {
          if (chrome.runtime.lastError || !res?.success) {
            setError(res?.error || chrome.runtime.lastError?.message || "Capture failed");
          } else {
            setMode("recording");
          }
        }
      );
    } catch (err: any) {
      setError(err.message || "Could not reach Syapa local server");
    }
  };

  const handleStopRecording = () => {
    chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, () => {
      setMode("ended");
    });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: 16 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: "var(--radius)", backgroundColor: "var(--fg)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", fontFamily: "var(--font-mono)" }}>
            S
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Syapa Recorder</span>
        </div>

        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", color: mode === "recording" ? "var(--destructive)" : "var(--muted)" }}>
          {mode.toUpperCase()}
        </span>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: "var(--radius)", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--destructive)", fontSize: 11, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* IDLE VIEW */}
      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* API TOKEN */}
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
              Syapa Personal API Token
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => saveApiToken(e.target.value)}
              placeholder="syp_..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <a
                href="http://localhost:3000/settings"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
              >
                Get API token from Web App →
              </a>
            </div>
          </div>

          {/* MEETING TITLE */}
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
              Meeting Title
            </label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g. Discovery Call with Acme Corp"
              style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)", outline: "none" }}
            />
          </div>

          {/* CONSENT REMINDER */}
          <div style={{ padding: 12, borderRadius: "var(--radius)", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ShieldAlert size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                <strong style={{ color: "var(--fg)", display: "block", marginBottom: 2 }}>Consent Reminder</strong>
                Ensure all participants in this meeting are informed and have consented to live audio transcription.
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", fontSize: 11 }}>
              <input
                type="checkbox"
                checked={consentAcknowledged}
                onChange={(e) => {
                  setConsentAcknowledged(e.target.checked);
                  chrome.storage.local.set({ syapa_consent: e.target.checked });
                }}
              />
              <span>I have obtained consent from all parties</span>
            </label>
          </div>

          {/* START BUTTON */}
          <button
            onClick={handleStartRecording}
            style={{ width: "100%", padding: "10px", backgroundColor: "var(--fg)", color: "var(--bg)", border: "none", borderRadius: "var(--radius)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Mic size={15} />
            <span>Start Tab & Mic Recording</span>
          </button>
        </div>
      )}

      {/* RECORDING VIEW */}
      {mode === "recording" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* STATS & METERS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12, borderRadius: "var(--radius)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", display: "block" }}>RECORDING TIME</span>
              <span style={{ fontSize: 16, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--fg)" }}>{formatTimer(elapsedSeconds)}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                <span>MIC (You)</span>
                <span>{micVolume}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: "var(--border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${micVolume}%`, backgroundColor: "var(--accent)", transition: "width 0.1s linear" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                <span>TAB (Others)</span>
                <span>{tabVolume}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: "var(--border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${tabVolume}%`, backgroundColor: "var(--success)", transition: "width 0.1s linear" }} />
              </div>
            </div>
          </div>

          {/* LIVE TRANSCRIPT FEED */}
          <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)", backgroundColor: "var(--surface)", padding: 10, display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {segments.length === 0 && !partialTranscript && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 11, margin: "auto" }}>
                Listening for dialogue on tab and microphone...
              </div>
            )}

            {segments.map((s, idx) => (
              <div key={idx} style={{ padding: 8, borderRadius: 4, backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: s.speaker === "You" ? "var(--accent)" : "var(--fg)" }}>
                    {s.speaker}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                    {Math.round(s.startTimeMs / 1000)}s
                  </span>
                </div>
                <p style={{ color: "var(--fg)", lineHeight: 1.4 }}>{s.text}</p>
              </div>
            ))}

            {partialTranscript && (
              <div style={{ padding: 8, borderRadius: 4, backgroundColor: "transparent", border: "1px dashed var(--border)", fontSize: 11, opacity: 0.8 }}>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--muted)", display: "block", marginBottom: 2 }}>
                  {partialTranscript.speaker} (speaking...)
                </span>
                <p style={{ color: "var(--muted)", fontStyle: "italic" }}>{partialTranscript.text}</p>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* STOP BUTTON */}
          <button
            onClick={handleStopRecording}
            style={{ width: "100%", padding: "10px", backgroundColor: "var(--destructive)", color: "#ffffff", border: "none", borderRadius: "var(--radius)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Square size={14} fill="#ffffff" />
            <span>Stop & Send to Syapa</span>
          </button>
        </div>
      )}

      {/* ENDED VIEW */}
      {mode === "ended" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 16, borderRadius: "var(--radius)", backgroundColor: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
            <CheckCircle2 size={32} color="var(--success)" style={{ margin: "0 auto 8px" }} />
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Meeting Recorded</h3>
            <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, marginBottom: 12 }}>
              Audio streams committed and flushed to Syapa. Post-meeting pipeline is analyzing summary, action items, and scope requests.
            </p>
            <span style={{ display: "inline-block", fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 4, backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--muted)" }}>
              {segments.length} segments saved
            </span>
          </div>

          {currentMeetingId && (
            <a
              href={`http://localhost:3000/meetings/${currentMeetingId}`}
              target="_blank"
              rel="noreferrer"
              style={{ width: "100%", padding: "10px", backgroundColor: "var(--fg)", color: "var(--bg)", borderRadius: "var(--radius)", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <span>Open Meeting in Web App</span>
              <ExternalLink size={14} />
            </a>
          )}

          <button
            onClick={() => {
              setMode("idle");
              setSegments([]);
            }}
            style={{ width: "100%", padding: "8px", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--fg)", borderRadius: "var(--radius)", cursor: "pointer" }}
          >
            Record Another Meeting
          </button>
        </div>
      )}
    </div>
  );
}
