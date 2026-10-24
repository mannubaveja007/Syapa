# Syapa 🛡️
> A precision freelance intelligence platform combining a Chrome Manifest V3 dual-channel meeting recorder with a grounded "Bad Client" negotiation sparring simulator.

---

## Architecture Overview

```
                                      +---------------------------------------------+
                                      |            Browser (Chrome MV3)             |
                                      +---------------------------------------------+
                                      |                                             |
                                      |   [Active Tab Audio]   [Microphone Audio]   |
                                      |           |                    |            |
                                      |           v                    v            |
                                      |   +-------------------------------------+   |
                                      |   |   Offscreen Document (AudioContext) |   |
                                      |   |   Resamples to 16 kHz mono PCM16    |   |
                                      |   +-------------------------------------+   |
                                      |           |                    |            |
                                      |           v                    v            |
                                      |   [WebSocket "Others"]  [WebSocket "You"]   |
                                      |           |                    |            |
                                      +-----------|--------------------|------------+
                                                  |                    |
                                                  v                    v
                                      +---------------------------------------------+
                                      |      ElevenLabs Scribe Realtime STT         |
                                      |      (wss://api.elevenlabs.io/v1/...)       |
                                      +---------------------------------------------+
                                                  |
                                                  | Live committed segments (5s flush)
                                                  v
+-----------------------------------------------------------------------------------+
|                            Syapa Web App (Next.js 14)                             |
|                               http://localhost:3000                               |
+-----------------------------------------------------------------------------------+
|  POST /api/meetings/:id/segments  --> Stores segments in PostgreSQL               |
|  POST /api/meetings/:id/end       --> Triggers asynchronous post-meeting pipeline |
|  POST /api/context                --> Chunks & embeds Project Briefs & Slack logs |
|  POST /api/simulator/:id/message  --> 70% vector + 30% tsvector hybrid search     |
|                                       Gemma 4 agent response with secret state    |
|  POST /api/simulator/:id/scorecard--> Evaluates concessions, boundaries & rewrites|
+-----------------------------------------------------------------------------------+
                                                  |
                                 +----------------+----------------+
                                 |                                 |
                                 v                                 v
    +-----------------------------------------+   +-----------------------------------+
    |      PostgreSQL + pgvector (Neon)       |   |      Local & Cloud AI Engines     |
    +-----------------------------------------+   +-----------------------------------+
    | - DocumentChunk (embedding vector)      |   | - LLM: Gemma 4 via Ollama         |
    | - Full-Text GIN Index (tsvector)        |   |   (http://localhost:11434/v1)     |
    | - Meeting & TranscriptSegment           |   | - Embeddings: OpenRouter / Ollama |
    | - SimulationSession (hidden state)      |   |   (Qwen / nomic-embed-text)       |
    | - SimulationTurn & Scorecard            |   +-----------------------------------+
    +-----------------------------------------+
```

---

## Monorepo Structure

```
Syapa/
├── apps/
│   ├── web/                     # Next.js 14 App Router, Hallmark CSS, Tailwind, Lenis
│   │   ├── src/app/             # Pages: landing, login, dashboard, meetings, simulator, etc.
│   │   ├── src/lib/             # Auth, Pipeline, Quote Verification, DB client
│   │   └── src/components/      # Navbar, SmoothScroll, UI components
│   └── extension/               # Chrome MV3 Extension built with WXT + React
│       ├── entrypoints/
│       │   ├── background.ts    # Service worker (tabCapture stream IDs, offscreen launcher)
│       │   ├── offscreen.html   # Offscreen document host
│       │   ├── offscreen/       # AudioContext resampler, dual WebSocket, 5s queue flusher
│       │   └── sidepanel/       # React UI (idle, recording timer & meter, ended summary)
├── packages/
│   ├── shared/                  # Universal Zod schemas, validation, TypeScript types
│   ├── db/                      # Prisma ORM, PostgreSQL + pgvector schemas, raw SQL repos
│   └── ai/                      # Gemma 4 LLM client, OpenRouter/Ollama Embeddings, Chunker, Quotes
├── .env.example                 # Environment variables specification
└── pnpm-workspace.yaml          # Monorepo workspaces definition
```

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: `v20+` or `v22+` (Node v26 supported)
- **pnpm**: `v10+` or `v11+`
- **PostgreSQL**: With `pgvector` extension (Local Postgres or Neon Serverless)
- **Ollama**: Running locally with `gemma4:12b` pulled:
  ```bash
  ollama run gemma4:12b
  ollama pull nomic-embed-text # For local fallback embeddings
  ```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```

Review key configuration:
```ini
# PostgreSQL with pgvector (Neon or local)
DATABASE_URL="postgresql://localhost:5432/syapa"
DIRECT_URL="postgresql://localhost:5432/syapa"

# LLM (Gemma 4 served by Ollama OpenAI-compatible endpoint)
LLM_BASE_URL="http://localhost:11434/v1"
LLM_MODEL="gemma4:12b"

# Embeddings (OpenRouter or local Ollama)
# For OpenRouter:
# EMBED_BASE_URL="https://openrouter.ai/api/v1"
# EMBED_API_KEY="sk-or-v1-..."
# EMBED_MODEL="openai/text-embedding-3-small"
# EMBED_DIM=1536
#
# For Local Ollama:
EMBED_BASE_URL="http://localhost:11434/v1"
EMBED_API_KEY=""
EMBED_MODEL="nomic-embed-text"
EMBED_DIM=768

# Speech-to-Text (ElevenLabs Scribe Realtime)
ELEVENLABS_API_KEY=""

# Auth Secret
BETTER_AUTH_SECRET="syapa-super-secret-development-key-32chars"
```

### 3. Install Dependencies & Prepare Database
```bash
# Install workspace dependencies
pnpm install

# Push database schema & generate Prisma Client
pnpm db:push

# Verify setup with Phase 1 Smoke Test
pnpm test
```

### 4. Build Chrome Extension & Launch Web App
```bash
# Build the Chrome MV3 Extension
pnpm --filter extension build

# Start the Web Application
pnpm dev
```
The web dashboard is now live at [http://localhost:3000](http://localhost:3000).

### 5. Load the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the directory: `<repo-root>/apps/extension/.output/chrome-mv3`.
5. Pin the **Syapa** extension icon to your toolbar.

---

## End-to-End Demo Script

### Step 1: Account & Extension Authorization
1. Visit [http://localhost:3000/register](http://localhost:3000/register) and create an account.
2. Navigate to **Extension** ([http://localhost:3000/settings](http://localhost:3000/settings)).
3. Click **Generate Token** to create a personal API key (e.g. `syp_...`).
4. Click the copy icon.
5. Click the Syapa extension icon in Chrome to open the Side Panel.
6. Paste your API token into the Side Panel settings.

### Step 2: Live Meeting Tab & Microphone Recording
1. In the Side Panel, verify the participant consent reminder checkbox.
2. Enter a meeting title (e.g., `Discovery Call: Acme Dashboard`).
3. Click **Start Tab & Mic Recording**.
4. Speak into your microphone and play audio on your browser tab.
5. Notice:
   - Live elapsed timer and real-time audio volume meters for both tab and mic.
   - Dual-channel live transcript segments labeled `[You]` and `[Others]`.
   - Automatic 5-second batch flushing to the Syapa database with IndexedDB offline protection.
6. Click **Stop & Send to Syapa**.
7. Click **Open Meeting in Web App**.

### Step 3: Post-Meeting AI Pipeline
1. On the meeting detail page ([http://localhost:3000/meetings/:id](http://localhost:3000/meetings/:id)):
   - The transcript is displayed with speaker pills and timestamps.
   - The background pipeline automatically chunks the transcript, embeds each chunk with pgvector, and prompts Gemma 4.
   - Read the **Executive Summary** and **Action Items**.
   - Review **Extracted Work Requests & Scope Creep**: every item displays an exact verbatim quote from the conversation. Notice any hallucinated quotes are deterministically rejected by code and counted.

### Step 4: Uploading Project Context
1. Navigate to **Context** ([http://localhost:3000/documents](http://localhost:3000/documents)).
2. Select **Project Brief / Specification** and paste your client brief or agreement.
3. Click **Upload & Embed**. The text is chunked and embedded with vector embeddings in PostgreSQL.

### Step 5: Bad Client Sparring Simulator
1. Navigate to **Simulator** ([http://localhost:3000/simulator](http://localhost:3000/simulator)).
2. Select a client persona:
   - **Scope Creeper**: Casual requests for mobile builds, extra panels, and free maintenance.
   - **Budget Haggler**: Demands 30% discounts, delayed milestones, and free API costs.
   - **Ghost Payer**: Refuses upfront deposits, demands raw code before final payment.
   - **Micromanager**: Requires daily 8:30 AM video calls and git commit approvals.
   - **Vague Brief**: Mid-stream pivots and subjective vibe rejections.
3. Select difficulty level (`Level 2: Seasoned` or `Level 3: Ruthless`).
4. Attach your uploaded brief or past meeting to ground the client.
5. Click **Start Negotiation Sparring**.
6. Spar in real-time:
   - The Bad Client pushes on ambiguities and gaps using real phrasing from your brief.
   - State persists in PostgreSQL per turn (patience, trust, budget ceiling, hidden asks).
   - If you cave, the agent aggressively exploits it and sneaks in its hidden demands.
   - If you hold firm with professional boundaries, the agent's respect increases.

### Step 6: Negotiation Scorecard & Post-Mortem
1. When finished, click **Conclude & Score**.
2. Review the resulting Scorecard:
   - **Overall Negotiation Score** (0-100).
   - **Behind the Curtain**: Revealed secret client patience timeline, final trust rating, and hidden asks.
   - **Price Anchoring Assessment**: Strong, Moderate, or Weak rating.
   - **Free Concessions Given**: Exact quotes citing specific conversation turns where ground was yielded.
   - **Boundaries Held**: Praise for disciplined pricing defense.
   - **3 High-Leverage Rewrites**: Exact phrasing and strategic rationale showing how to reword weak statements into commanding positions.

---

## Design System & Hallmark Principles

The web interface adheres strictly to the **Hallmark v2.0.0** design standard:
- **Zero Color Literals**: Every color and typography rule flows through design tokens declared in `tokens.css`.
- **Sloplint Validated**: Verified with `sloplint.mjs` (0 FAIL, 0 REFLEX, 0 WARN).
- **Graceful Performance**: Lenis smooth scrolling runs solely on the landing page in an isolated client component, disabled when `prefers-reduced-motion` is set.
- **Editorial Typography**: Balanced headline wrapping (`text-wrap: balance`), high contrast, no fake statistics, no emoji icons, and no decorative status dots.
