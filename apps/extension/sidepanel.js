const app = document.querySelector("#app");
const API_URL = "http://localhost:3000/api/meetings/transcribe";

let mode = "idle";
let startedAt = 0;
let timerId = null;
let pollTimerId = null;
let recorder = null;
let capture = null;
let chunks = [];
let lastResult = null;
let lastError = null;
let apiToken = "";
let analysisData = null;

// Load API token from chrome storage
if (typeof chrome !== "undefined" && chrome.storage?.local) {
  chrome.storage.local.get(["syapa_api_token"], (res) => {
    if (res.syapa_api_token) {
      apiToken = res.syapa_api_token;
    }
  });
}

function saveToken(val) {
  apiToken = val.trim();
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ syapa_api_token: apiToken });
  }
}

function elapsed() {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  window.clearTimeout(timerId);

  if (mode === "idle") {
    app.innerHTML = `
      <div class="card">
        ${lastError ? `<div class="error" role="alert">${escapeHtml(lastError)}</div>` : ""}
        <div class="eyebrow">Ready to capture</div>
        <h1>Record meeting dialogue</h1>
        <p class="note">Capture this browser tab and microphone in one focused workspace.</p>

        <div class="token-field">
          <label style="display:block; font-size:10px; color:var(--muted); margin-bottom:4px;">
            Syapa API token
          </label>
          <input
            type="password"
            id="token-input"
            class="token-input"
            value="${escapeHtml(apiToken)}"
            placeholder="syp_…"
          />
        </div>

        <button class="primary nowrap" id="start">Start recording</button>
        <a href="http://localhost:3000/dashboard" target="_blank" class="button secondary nowrap">
          Open dashboard
        </a>
        <div class="consent">
          Ensure all participants consent to meeting audio recording before beginning.
        </div>
      </div>
    `;

    const tokenInput = document.querySelector("#token-input");
    if (tokenInput) {
      tokenInput.onchange = (e) => saveToken(e.target.value);
    }

    const startBtn = document.querySelector("#start");
    if (startBtn) {
      startBtn.onclick = startRecording;
    }
    return;
  }

  if (mode === "recording") {
    const barHeights = [18, 31, 46, 24, 38, 54, 29, 44, 22, 50, 35, 27, 47, 32, 41, 25];
    const barsHtml = barHeights
      .map((h) => `<span class="bar" style="height:${h}px"></span>`)
      .join("");

    app.innerHTML = `
      <div class="card">
        <div class="status">
          <span class="live"><i class="dot"></i> Recording</span>
          <span class="timer">${elapsed()}</span>
        </div>
        <div class="bars">${barsHtml}</div>
        <div class="transcript-box">
          <div>
            <div class="speaker">Live capture</div>
            <div class="line">Capturing tab audio and microphone…</div>
          </div>
        </div>
        <button class="danger nowrap" id="stop">Stop recording</button>
      </div>
    `;

    const stopBtn = document.querySelector("#stop");
    if (stopBtn) {
      stopBtn.onclick = stopRecording;
    }

    timerId = window.setTimeout(render, 1000);
    return;
  }

  if (mode === "processing") {
    app.innerHTML = `
      <div class="card">
        <div class="eyebrow">Processing recording</div>
        <h1>Transcribing audio…</h1>
        <p class="note">Transcribing with ElevenLabs diarization and generating AI analysis.</p>
      </div>
    `;
    return;
  }

  // Ended state
  const meeting = lastResult?.meeting;
  const meetingId = meeting?.id;
  const summary =
    analysisData?.analysis?.summary ||
    meeting?.summary ||
    "Meeting saved. Awaiting executive summary…";

  const suggestions = analysisData?.analysis?.suggestions || [];
  const topSuggestions = suggestions.slice(0, 3);

  let suggestionsHtml = "";
  if (topSuggestions.length > 0) {
    suggestionsHtml = `
      <div class="suggestions">
        <div style="font-size:10px; color:var(--muted); font-weight:600;">
          TOP COACHING SUGGESTIONS (${topSuggestions.length})
        </div>
        ${topSuggestions
          .map(
            (s) => `
          <div class="suggestion-card">
            <div class="suggestion-cat">${escapeHtml(s.category)}</div>
            <div class="suggestion-title">${escapeHtml(s.title)}</div>
            ${s.exactQuote ? `<div style="font-style:italic; color:var(--muted); margin-bottom:2px;">“${escapeHtml(s.exactQuote)}”</div>` : ""}
            <div class="suggestion-action">→ ${escapeHtml(s.recommendedAction)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  app.innerHTML = `
    <div class="card">
      <div class="eyebrow">Recording saved</div>
      <h1>${escapeHtml(meeting?.title || "Meeting recording")}</h1>
      <p class="note">${escapeHtml(summary)}</p>

      ${suggestionsHtml}

      ${
        meetingId
          ? `<a href="http://localhost:3000/meetings/${meetingId}" target="_blank" class="button primary nowrap">
               Open full analysis
             </a>`
          : ""
      }
      <button class="secondary nowrap" id="again">Record another</button>
    </div>
  `;

  const againBtn = document.querySelector("#again");
  if (againBtn) {
    againBtn.onclick = () => {
      window.clearTimeout(pollTimerId);
      lastResult = null;
      lastError = null;
      analysisData = null;
      mode = "idle";
      render();
    };
  }
}

async function createCaptureStream() {
  // Capture display (tab) audio + video
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });

  // Capture user microphone audio
  const microphoneStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  // Tab audio source
  if (displayStream.getAudioTracks().length) {
    const tabSource = audioContext.createMediaStreamSource(displayStream);
    tabSource.connect(destination);
    // Route tab audio to speakers so user can hear call
    tabSource.connect(audioContext.destination);
  }

  // Mic source
  const micSource = audioContext.createMediaStreamSource(microphoneStream);
  micSource.connect(destination);

  // Stop video track since we only record audio
  displayStream.getVideoTracks().forEach((track) => track.stop());

  return {
    stream: destination.stream,
    stop() {
      displayStream.getTracks().forEach((track) => track.stop());
      microphoneStream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
    },
  };
}

async function startRecording() {
  lastError = null;
  try {
    capture = await createCaptureStream();
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    recorder = new MediaRecorder(capture.stream, { mimeType });
    chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = finishRecording;
    recorder.start(1000);
    startedAt = Date.now();
    mode = "recording";
    render();
  } catch (error) {
    lastError =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "Chrome blocked capture. Choose a tab, enable Share audio, and allow microphone access."
        : "Unable to start capture. Check tab and microphone permissions.";
    mode = "idle";
    render();
  }
}

function stopRecording() {
  if (!recorder || recorder.state !== "recording") return;
  recorder.stop();
  capture?.stop();
  recorder = null;
  capture = null;
  mode = "processing";
  render();
}

async function pollAnalysis(meetingId) {
  if (!meetingId) return;
  let attempts = 0;

  async function check() {
    try {
      const headers = {};
      if (apiToken) headers["x-api-token"] = apiToken;
      const res = await fetch(`http://localhost:3000/api/meetings/${meetingId}/analysis`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        analysisData = data;
        if (data.status === "COMPLETED" || data.analysis?.suggestions?.length) {
          render();
          return;
        }
      }
    } catch {
      // Retry
    }

    attempts++;
    if (attempts < 25 && mode === "ended") {
      pollTimerId = window.setTimeout(check, 2500);
    }
  }

  check();
}

async function finishRecording() {
  try {
    const audio = new Blob(chunks, { type: "audio/webm" });
    if (audio.size < 1000) {
      throw new Error(
        "The recording was empty or silent. Share a tab with audio and speak into your microphone."
      );
    }

    const formData = new FormData();
    formData.append("audio", audio, "meeting.webm");
    formData.append("title", "Browser Strategy Call");
    formData.append(
      "durationSeconds",
      String(Math.round((Date.now() - startedAt) / 1000))
    );

    const headers = {};
    if (apiToken) {
      headers["x-api-token"] = apiToken;
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Transcription failed (${response.status})`);
    }

    lastResult = result;
    lastError = null;
    mode = "ended";
    render();

    if (result.meeting?.id) {
      pollAnalysis(result.meeting.id);
    }
  } catch (error) {
    lastError =
      error instanceof Error
        ? error.message
        : "Unable to transcribe and save this meeting.";
    mode = "idle";
    render();
  }
}

render();
