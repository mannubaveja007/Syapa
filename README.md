# Syapa 🛡️
> A precision freelance intelligence platform combining a Chrome Manifest V3 meeting recorder with server-side speaker diarization, grounded negotiation coaching, and real-time Conversational AI client sparring.

---

## Architecture Overview

```
                                      +---------------------------------------------+
                                      |            Browser (Chrome MV3)             |
                                      +---------------------------------------------+
                                      |                                             |
                                      |   [Active Tab Audio]   [Microphone Audio]   |
                                      |           |                    |            |
                                      |           +---------+----------+            |
                                      |                     |                       |
                                      |                     v                       |
                                      |       AudioContext Stream Mixer             |
                                      |       (Tab Audio routed to speakers)        |
                                      |                     |                       |
                                      |                     v                       |
                                      |     MediaRecorder (audio/webm;codecs=opus)  |
                                      |                     |                       |
                                      +---------------------|-----------------------+
                                                            |
                                                            | POST /api/meetings/transcribe
                                                            | (x-api-token: syp_...)
                                                            v
+-----------------------------------------------------------------------------------+
|                            Syapa Web App (Next.js 14)                             |
|                               http://localhost:3000                               |
+-----------------------------------------------------------------------------------+
|  POST /api/meetings/transcribe   --> Validates audio, calls ElevenLabs STT        |
|                                      Server-side only (diarize=true, scribe_v2)   |
|                                      Rejects empty/silent audio (HTTP 422)        |
|                                      Saves TranscriptSegments (You / Others)      |
|                                      Triggers asynchronous post-meeting pipeline  |
|  GET  /api/meetings/:id/analysis --> Polls status, executive summary & top 3      |
|                                      tactical negotiation suggestions             |
|  POST /api/context               --> Chunks & embeds Project Briefs & SOWs        |
|  POST /api/voice/session         --> Initiates ElevenLabs Conversational AI voice |
|                                      sparring session (<500-word injected brief)  |
|  POST /api/simulator/:id/message --> 70% vector + 30% tsvector hybrid search     |
|                                      Gemma agent response with hidden client state|
|  POST /api/simulator/:id/scorecard-> Evaluates concessions, boundaries & rewrites |
+-----------------------------------------------------------------------------------+
                                   |                                 |
                                   v                                 v
    +-----------------------------------------+   +-----------------------------------+
    |      PostgreSQL + pgvector (Neon)       |   |      Local & Cloud AI Engines     |
    +-----------------------------------------+   +-----------------------------------+
    | - DocumentChunk (vector(1024) + HNSW)   |   | - STT: ElevenLabs Scribe v2       |
    | - Full-Text GIN Index (tsvector)        |   |   (Server-side speaker diarize)   |
    | - Meeting & TranscriptSegment           |   | - LLM: Gemma 4 via Ollama / OR    |
    | - MeetingAnalysis & Suggestion          |   |   (concurrency 1, backoff, queue) |
    | - SimulationSession & Scorecard         |   | - Embeddings: nomic-embed-text    |
    | - AiUsage (tokens, latency, cost log)   |   |   (batched, fixed 1024-dim, HNSW) |
    |                                         |   | - Voice Agent: ElevenLabs ConvAI  |
    +-----------------------------------------+   +-----------------------------------+
```

---

## Monorepo Structure

```
Syapa/
├── apps/
│   ├── web/                     # Next.js 14 App Router, Hallmark CSS, Tailwind, Lenis
│   │   ├── src/app/             # Pages: dashboard, meetings/[id], practice, simulator, settings
│   │   │   └── api/             # API routes: meetings/transcribe, meetings/[id]/analysis, voice, auth
│   │   ├── src/lib/             # Auth, Pipeline, Quote Verification, AI clients
│   │   └── src/components/      # UI components, layout, visualizer
│   └── extension/               # Plain Chrome MV3 Extension (instant <5ms load, zero build step)
│       ├── manifest.json        # MV3 manifest with sidePanel API & host_permissions
│       ├── background.js        # Service worker for side panel action click
│       ├── sidepanel.html       # Hallmark-compliant side panel interface
│       ├── sidepanel.js         # Dual-channel audio capture, recorder, STT dispatch, analysis polling
│       └── icons/               # Syapa branded icons (16, 32, 48, 128)
├── packages/
│   ├── shared/                  # Universal Zod schemas, validation, TypeScript types
│   ├── db/                      # Prisma ORM, PostgreSQL + pgvector schemas, SQL migrations
│   │   ├── src/repositories/    # Meeting, Chunk, Token, Simulation, and Usage repositories
│   │   ├── src/scripts/seed.ts  # 4 demo meetings with scope-creep and free-promise moments
│   │   └── src/scripts/clear-demo.ts # One-command demo wipe
│   └── ai/                      # Gemma LLM client (with 429 backoff), 1024-dim Embeddings, Chunker, Quotes
├── .env.example                 # Environment variables specification
└── pnpm-workspace.yaml          # Monorepo workspace definition
```

---

## Core Capabilities

### 1. Plain Chrome MV3 Extension (`apps/extension`)
- **Fastest Chrome Load Time (<5 ms)**: Implemented as a clean, plain Manifest V3 extension. Zero bundling or transpilation overhead. Load unpacked directly in Chrome.
- **Dual-Channel Audio Capture**: Uses `navigator.mediaDevices.getDisplayMedia` for tab audio and `navigator.mediaDevices.getUserMedia` for microphone audio. Combines both streams via `AudioContext` and routes tab audio to speakers so you can hear call participants without feedback loops.
- **Ended State Analysis Polling**: Automatically polls `GET /api/meetings/:id/analysis`, displaying the executive summary and top 3 tactical suggestions with direct links to the web app.

### 2. Server-Side Speech-to-Text with Speaker Diarization
- **Strict Key Protection**: `ELEVENLABS_API_KEY` remains strictly on the server; the Chrome extension never touches or exposes third-party AI keys.
- **Speaker Diarization**: Sends audio to ElevenLabs (`model_id: "scribe_v2"`, `diarize: "true"`). Maps `speaker_0` to `"You"` and conversation partners to `"Others"`.
- **Empty/Silent Audio Rejection**: Recordings with no detectable audio (<1000 bytes or empty transcript) are rejected with HTTP 422, saving nothing to the database.

### 3. Post-Meeting Intelligence Pipeline
- **Fixed 1024-Dimension Embeddings**: Chunks transcript into 350-word sliding windows and sends **exactly ONE batched request** per meeting to the embeddings engine. Truncates and L2-normalizes to `vector(1024)` and persists `embeddingModel` per chunk.
- **HNSW Index on pgvector**: Uses `hnsw ("embedding" vector_cosine_ops)` combined with GIN `tsvector` indexes for sub-10ms hybrid search.
- **Deterministic Quote Verification**: A structured Gemma call identifies scope creep and risky commitments. Plain-code string matching verifies that quotes are 100% verbatim from the transcript; ungrounded or hallucinated quotes are automatically filtered and logged.

### 4. Conversational AI Practice Room & "Mr Sharma" Agent
- **Official ElevenLabs Conversational AI SDK**: Uses `@elevenlabs/react` (`ConversationProvider`, `useConversation`) with signed WebSocket sessions.
- **Featured Client Archetype — Mr Sharma (Coaching Center Scope Creeper)**:
  - **Persona**: Runs a Class 9–12 coaching center.
  - **Stated Budget**: ₹12,000 | **Ceiling**: ₹15,000 | **Difficulty**: 2.
  - **Hidden Asks**: Online student fee payment gateway, student login portal for PDF notes, Hindi language localization.
  - **Brief**: Injected brief is strictly capped under 500 words.
- **Meeting Page Tab**: Integrated "Voice sparring agent" tab directly on every meeting detail page (`/meetings/:id`) to spar against that specific meeting's client persona.

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: `v20+` or `v22+`
- **pnpm**: `v10+`
- **PostgreSQL**: With `pgvector` enabled (Local or Neon)
- **Ollama**:
  ```bash
  ollama run gemma4:12b
  ollama pull nomic-embed-text
  ```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Review core variables in `.env`:
```ini
# PostgreSQL with pgvector (Neon or local)
DATABASE_URL="postgresql://localhost:5432/syapa"
DIRECT_URL="postgresql://localhost:5432/syapa"

# LLM (Gemma 4 via Ollama or OpenRouter)
LLM_BASE_URL="http://localhost:11434/v1"
LLM_MODEL="gemma4:12b"
LLM_TIMEOUT_MS=90000

# OpenRouter Configuration (Cloud LLM & Embeddings Fallback)
OPENROUTER_API_KEY="sk-or-v1-..."
LLM_FALLBACK_MODELS="meta-llama/llama-3.3-70b-instruct:free,mistralai/mistral-7b-instruct:free"

# Embeddings (Fixed 1024 dimensions)
EMBED_BASE_URL="http://localhost:11434/v1"
EMBED_MODEL="nomic-embed-text"
EMBED_DIM=1024

# Speech-to-Text & Conversational AI (ElevenLabs)
ELEVENLABS_API_KEY="sk_..."
ELEVENLABS_AGENT_ID="agent_..."

# Authentication Secret
BETTER_AUTH_SECRET="syapa-super-secret-development-key-32chars"
```

### 3. Install Dependencies & Initialize Database
```bash
# Install workspace dependencies
pnpm install

# Push database schema & generate Prisma Client
pnpm db:push

# Apply HNSW vector index
pnpm --filter @syapa/db exec prisma db execute --file prisma/migrations/20261024000000_init_vector_hnsw/migration.sql --schema prisma/schema.prisma

# Seed 4 realistic demo meetings with scope creep & free promises
pnpm --filter @syapa/db seed
```

### 4. Start the Application
```bash
# Start Web Application (http://localhost:3000)
pnpm dev
```

### 5. Load the Chrome Extension
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `apps/extension` folder.
5. Click the **Syapa** extension icon on your Chrome toolbar to open the Side Panel.

---

## Demo Meetings & Seed Management

The database seed populates four comprehensive client meetings reflecting authentic freelance negotiation challenges:
1. **Launch planning sync**: Mid-sprint HubSpot automation and SMS drip campaign creep; unbilled weekend webhook free promise.
2. **E-Commerce Replatforming Strategy Call**: 50,000 legacy customer record migration creep; free ETL cleanup courtesy concession.
3. **Brand Identity & Design System Review**: 30 marketing collateral formats beyond scope; unbilled LinkedIn banner concession.
4. **Enterprise API Migration Check-in**: 24/7 99.99% uptime guarantee demand; informal holiday PagerDuty monitoring commitment.

### One-Command Demo Clear & Reseed:
```bash
# Remove all demo meetings, segments, and vector chunks
pnpm db:clear-demo

# Reseed fresh demo meetings
pnpm --filter @syapa/db seed
```

---

## Verification & Audit Commands

Run these commands to verify system health across all layers:

```bash
# 1. Audit Phase A fixes (EMBED_DIM check, batching, HNSW index, LLM fallback)
pnpm --filter @syapa/db exec tsx ../ai/src/test-fixes.ts

# 2. Sloplint Hallmark design system audit on extension side panel
node .agents/skills/hallmark/scripts/sloplint.mjs apps/extension/sidepanel.html

# 3. Typecheck web app
pnpm --filter web typecheck

# 4. Production build
pnpm build
```

---

## Design System & Hallmark Principles

The Syapa interface adheres to the **Hallmark v2.0.0** design standard:
- **Design Tokens**: All colors, fonts, and radii flow strictly through semantic tokens (WCAG AA compliant contrast).
- **Sloplint Clean**: Verified with `sloplint.mjs` (`0 FAIL, 0 REFLEX, 0 WARN`).
- **Typography & Motion**: Editorial typography with balanced headlines (`text-wrap: balance`), tabular figures, and reduced-motion respecting transitions.
