<div align="center">

![Harvey — Counsel on call](./docs/hero.png)

# Harvey — Counsel, on call.

**A voice-first legal agent. Canadian law meets live markets.**

`LiveKit Cloud` · `OpenAI` · `Deepgram Nova-3` · `ElevenLabs Turbo v2.5` · `Chroma` · `Next.js 16`

</div>

---

> *Submission for the Bluejay take-home · April 2026*
> *Built by **Ronniel Gandhe** · [demo video](./docs/demo.mp4) · [live site](https://harvey.vercel.app)*

Harvey is a voice-first legal agent modelled on Gabriel Macht's Harvey Specter. You hit a call button, he picks up, and you can ask him three kinds of questions:

1. **Canadian legal questions** → he cites the actual statute from a 12,000-page corpus of federal + Ontario law.
2. **News / current-events questions** → he pulls live Google News headlines, spotlights the top article, and gives you a 1-sentence synthesis with attitude.
3. **Public company / market questions** → he pulls a live Yahoo Finance quote (price, change, day range, 52-week range) and docks it on the left side of the screen.

Every tool he calls triggers an on-screen visual pane — statute card on the right, news ticker + article spotlight on the right, stock terminal card on the left — so the UI stays in sync with what he's talking about in real time.

---

## 1 · How it works, end-to-end

```
 ┌─────────────────────────────────┐
 │  Browser  (Next.js 16 · React)  │
 │  ┌─────────────────────────────┐│
 │  │ GET /api/token              ││──┐
 │  │  → LiveKit JWT for room     ││  │
 │  └─────────────────────────────┘│  │
 │  LiveKitRoom (WebRTC · audio)   │  │
 │  ├─ Mic bands → pinwheel wings  │  │
 │  ├─ Transcript → ticker         │  │
 │  └─ Data-channel → panes        │  │
 └─────────────┬───────────────────┘  │
               │                      │
         [WebSocket + WebRTC]         │
               │                      │
 ┌─────────────▼───────────────────┐  │
 │  LiveKit Cloud (US East B)      │◄─┘
 │  ├─ Media router                │
 │  └─ Dispatches jobs to worker   │
 └─────────────┬───────────────────┘
               │
               │ agent worker (AW_…)
               ▼
 ┌─────────────────────────────────┐
 │  Python agent process (local)   │
 │  ┌─ Deepgram STT (Nova-3)  ─────┤
 │  ├─ OpenAI LLM (gpt-4o-mini) ──┤
 │  ├─ ElevenLabs TTS (Turbo v2.5)─┤
 │  ├─ Silero VAD + turn detector  │
 │  └─ 3 function tools:           │
 │     ├─ cite_statute   → Chroma  │
 │     ├─ current_events → RSS     │
 │     └─ stock_ticker   → Yahoo   │
 └─────────────────────────────────┘
```

### The call, step by step

1. **User hits the call button.** Frontend hits `/api/token`, which mints a LiveKit JWT for a fresh room.
2. **LiveKitRoom connects** over WebRTC, starts the mic track.
3. **LiveKit Cloud dispatches a job** to the registered agent worker.
4. **Agent worker joins the room.** Plays a canned greeting line (`session.say(...)`) instantly so there's no first-response latency.
5. **User speaks.** Deepgram STT streams the transcript back. LiveKit turn-detector signals end-of-turn.
6. **LLM generates.** GPT-4o-mini sees the system prompt + conversation history. If the answer requires grounding, it calls one of the three function tools.
7. **Tool fires.** Each tool (a) runs its external query (Chroma / RSS / Yahoo) and (b) publishes a JSON event over the LiveKit data channel.
8. **Frontend reacts.** Data channel listener renders a glass pane for the tool's payload. A Jarvis-style status pill above the pinwheel updates continuously based on voice-assistant state (`Harvey listening` → `Consulting the bench` → `Harvey speaking`).
9. **TTS streams.** ElevenLabs returns audio over WebRTC. The pinwheel's six wings react to mic bands via `useMultibandTrackVolume`.

---

## 2 · RAG integration

The hard requirement in the spec was *"specific fact in specific chapter"* retrieval over a large PDF. Harvey ships with 12,000+ pages across **31 Canadian + Ontario legal PDFs**, chunked and embedded into Chroma.

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **LangChain** (`langchain-community`, `langchain-chroma`) | Mature PDF loader + text splitter, minimum glue code |
| PDF loader | `PyPDFLoader` | Pure Python, no Poppler dependency |
| Chunking | `RecursiveCharacterTextSplitter` · 800 chars · 120 overlap | Respects paragraph boundaries; tuned so statute sections land in a single chunk most of the time |
| Embedding | `text-embedding-3-small` (OpenAI) | Good quality/latency/cost tradeoff; 1536-dim |
| Vector DB | **Chroma** (persisted to `data/chroma_db/`) | Embedded, zero-ops, good for take-home scope |
| Similarity | Cosine (Chroma default) | |
| Retrieval | `similarity_search(query, k=3)` | Top-3 chunks → model picks + verbalizes |

### Ingestion (`backend/ingest.py`)

```
for pdf in data/corpus/*.pdf:
    pages = PyPDFLoader(pdf).load()
    chunks = splitter.split_documents(pages)
    for c in chunks:
        c.metadata |= infer_jurisdiction_and_section(c)
    chroma.add_documents(chunks)
```

**Metadata enrichment.** Each chunk is tagged with:
- `source` — the PDF filename
- `page` — original page number
- `jurisdiction` — inferred from the filename prefix (`canada_` / `ontario_` / `us_`)
- `section` — regex-extracted section number when present

That metadata is what lets the frontend render a proper legal-brief card with the `§ 200`, "Canada" jurisdiction badge, and source attribution.

### Retrieval (`backend/rag.py`)

Singleton `LegalRAG` wraps a persisted Chroma collection. Returns plain dicts so the tool layer doesn't depend on LangChain types.

### How tool → RAG → UI wires up

```python
@function_tool
async def cite_statute(ctx, query: str) -> str:
    hits = rag.retrieve(query, k=3)
    top = hits[0]
    await _publish(ctx, {
        "type": "statute_card",
        "payload": {
            "jurisdiction": top["jurisdiction"],
            "section": top["section"],
            "title":   top["title"],
            "quote":   top["text"],
            "source":  top["source"],
        },
    })
    return f"{top['section']}: {top['text'][:220]}"
```

The string return goes back up to the LLM so Harvey can verbalize a summary. The data-channel event is independent — it renders even if the LLM is still generating.

---

## 3 · Three tools

| Tool | Triggers when | Side effect | Visual |
|---|---|---|---|
| `cite_statute(query)` | Any legal question requiring grounding | Vector search over 31 Canadian PDFs | Statute card, right column — § section in mono, quote in serif, source attribution |
| `current_events(query)` | Recent / trending / time-sensitive queries | Google News RSS (Canadian feed, no API key) | Two panes: news ticker (5 headlines) + article spotlight (top story summary), right column |
| `stock_ticker(symbol)` | Public company mentioned | Yahoo Finance chart endpoint (no API key) | Stock terminal card, left column — price, change %, 52-week range bar |

Each tool publishes its own event type on the LiveKit data channel. The frontend's `useDataChannel` listener decodes the payload and spawns a pane via Framer Motion's `AnimatePresence`. Panes dismiss on click or auto-fade after TTL for transient `tool_call` pills.

### Why three and not one?

The spec asks for a single tool call. I shipped three because (a) each fits a distinct user intent cleanly, (b) stacking multiple panes from one call makes the UI feel alive rather than static, and (c) it lets the demo cover three different retrieval surfaces — static corpus, live web, live market — in 90 seconds.

---

## 4 · Voice & personality

### Voice

- **ElevenLabs Instant Voice Cloning** of Gabriel Macht's voice, trained from ~10 minutes of Suits dialogue.
- Model: **`eleven_turbo_v2_5`** (sub-200ms first-audio, noticeably better for conversational flow than the default multilingual model).
- `VoiceSettings(stability=0.50, similarity_boost=0.85, style=0.0, speed=0.90, use_speaker_boost=True)` — tuned against ear-tested samples.

### Personality

The system prompt (`backend/prompts.py`) carries **37 verbatim Harvey Specter lines** from the show as cadence anchors. Explicit rules in the prompt:
- Replies are 1–3 sentences, 15–45 words.
- Land a quip every 2-3 turns, not every turn.
- Always contractions. Never "I think / I'm not sure / maybe."
- Off-topic → deflect with a zinger.
- "Call ≥1 tool per non-social turn" — the UI depends on tool events firing.

### First-audio latency

A canned greeting (`session.say(...)`) fires the instant the user's audio stream connects. This hides the 600-900ms cold-start on the first LLM response — the caller hears "Goddamn it. You're back." before Harvey has even seen their first word.

---

## 5 · Frontend

All of the glass-UI work lives in the frontend — this is where most of the craft went.

| Component | What it does |
|---|---|
| `PearsonHeader` | PSL × Bluejay collab header. Has three poses: splash (center, 2×), center idle (42vh), corner (bottom-left, 0.72× in call). Animates between them with framer-motion, pixel-based x/y measured at runtime so there's no unit-mismatch snapping. |
| `BluejayPinwheel` | Wireframe pinwheel, audio-reactive. Six clipped copies of the brand PNG, each masked to a 60° pie-slice via CSS `clip-path: polygon(...)`. Inside a rotating container. Each wing pushes outward in its own radial direction based on its mic-band volume (six-band FFT via `useMultibandTrackVolume`). |
| `SkylineBackdrop` | Ambient wireframe NYC skyline. Three.js via `@react-three/fiber`. Sparse buildings on both sides, clean center corridor. Infinite loop — two identical blocks back-to-back with a seamless wrap so the flythrough never visibly resets. |
| `GlassPaneStack` | Split into a left column (stock cards) and a right column (tool pills + statute + news + article spotlight). Framer-motion layout animations on pane insert/remove. |
| `StatusHUD` + `TickerLine` | Jarvis-style pill above the pinwheel that swaps state (`Listening` / `Consulting the bench` / `Harvey speaking`) and a live transcript ticker below it. |
| `CaseBrief` | The "scroll-down" section you're reading right now, in React form. |

### Boot sequence

A cinematic 6-second intro runs on every page load:
1. White overlay drops, slash fades in.
2. "PEARSON SPECTER LITT" emerges L→R via clip-path reveal.
3. "/" slash animates next.
4. "Bluejay" animates third.
5. Assembly holds centered, then glides to the top-center hero slot.
6. The Sonar-pulse call button fades in.

---

## 6 · Design decisions & trade-offs

| Decision | Trade-off |
|---|---|
| **Chunk size 800 / overlap 120** | Works well for statute sections (typically one section per chunk). Struggles on statutes that include long lists — some intros get split from their provisions. |
| **`text-embedding-3-small` (1536-dim)** | Faster + cheaper than `text-embedding-3-large`. Quality is enough for this corpus; for high-stakes legal retrieval you'd want the larger model. |
| **Chroma (embedded)** | No ops burden, persisted to disk, runs inside the agent process. Trade-off: not horizontally scalable — if this were a product you'd move to a managed vector store (Pinecone / Qdrant / pgvector). |
| **GPT-4o-mini, not GPT-4o** | 4o-mini is <1s first-token and 30× cheaper. Quality is enough because Harvey's output is structured (tool call + short reply) — he's not doing long reasoning chains. |
| **ElevenLabs Turbo v2.5** | Lower latency + noticeably better prosody than the default multilingual TTS. Trade-off: slight quality drop vs `eleven_multilingual_v2` on long sentences. |
| **Instant Voice Cloning, not Professional** | Free / instant. Ceiling ~80-85% of Gabriel Macht. Pro cloning would need a biometric consent process we can't pass. |
| **LiveKit transport, not raw WebRTC** | Way less glue code. Gives you turn detection, VAD, transcript streaming, data channel, and audio routing for free. Trade-off: adds a hop through LiveKit Cloud. |
| **RunContext room resolution via `session.room_io.room`** | A fallback-chain helper handles the v1.x API. The earlier `ctx.session.room` path broke silently for a while — caught it during a test when tools fired but no frontend events appeared. Solution: `_resolve_room(ctx)` checks `room_io.room` → `get_job_context().room` → legacy attributes. |

### Deliberate non-goals

- **Multi-turn case file building** — an early iteration had a 6-slot "Parties / Location / Matter / Date / Authority / Action" evidence wall that Harvey filled across turns. Cute visual, but it forced the conversation into a rigid shape. Scrapped in favour of tool-driven panes that react to what the user actually asks.
- **PDF upload UI** — spec mentions it as optional. Harvey ships with a fixed corpus since the whole point is *specific fact in specific chapter* on a known dataset.

---

## 7 · Repo layout

```
harvey/
├── backend/
│   ├── agent.py            # LiveKit Agents worker + session wiring
│   ├── tools.py            # cite_statute, current_events, stock_ticker
│   ├── prompts.py          # Harvey system prompt + 37 cadence lines
│   ├── rag.py              # Chroma wrapper
│   ├── ingest.py           # PDF → chunks → Chroma
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md           # backend setup
│
├── frontend/
│   ├── app/                # Next.js 16 App Router
│   │   ├── page.tsx        # root — swaps Incoming ↔ CallInterface
│   │   └── api/token/      # LiveKit JWT minter
│   └── components/
│       ├── PearsonHeader.tsx
│       ├── BluejayPinwheel.tsx
│       ├── SkylineBackdrop.tsx
│       ├── IncomingCall.tsx
│       ├── CallCTA.tsx
│       ├── CallInterface.tsx
│       ├── CaseBrief.tsx
│       ├── GlassPaneStack.tsx
│       └── panes/          # StatuteCard, NewsTicker, ArticleSpotlight, StockCard
│
├── data/
│   ├── corpus/             # 31 PDFs, Canadian + Ontario + US statutes
│   ├── harvey_lines/       # scraped Suits transcripts — ~270 deduped lines
│   └── chroma_db/          # persisted vector index (gitignored, rebuild via ingest.py)
│
└── docs/
    ├── hero.png            # landing page hero screenshot
    └── demo.mp4            # 5-min walkthrough
```

---

## 8 · Local setup

Requires Python 3.11+, Node 20+, and API keys for OpenAI, Deepgram, ElevenLabs, and a LiveKit Cloud project.

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # fill in keys
python ingest.py                # builds data/chroma_db/ (~10 min, ~370 MB)
python agent.py dev             # registers the worker
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local # fill in LiveKit server URL + keys
npm install
npm run dev                      # http://localhost:3000
```

Hit the Take-the-Call button. The boot sequence plays, PSL × Bluejay lands center, then the sonar button appears. Click it.

---

## 9 · Deploy

- **Frontend** → Vercel. Zero config — ships straight from the `frontend/` directory.
- **Agent worker** → can run anywhere that speaks outbound WebSocket to LiveKit Cloud. I run it locally during the demo to keep `.env` secrets off any third-party surface; AWS ECS / Fly.io works too if you want always-on.

---

## 10 · What I'd do next

- **A README screenshot pass** — mostly done, needs an in-call screenshot once I've captured a good statute + news + stock moment in a single session.
- **Real stock graphs** in the stock card (sparkline from the 5-day chart endpoint we already fetch).
- **Harvey's "draft a demand letter"** as a 4th tool — writes in his voice, lands as a letterpress pane on the right.
- **Second voice-mode toggle**: OpenAI Realtime (Marin) as a "fast mode" alternative to ElevenLabs.
- **AWS deploy** for the agent worker so the demo URL works without my laptop being awake.

---

<div align="center">
<sub>© 2026 · Pearson Specter Litt × Bluejay · Confidential · Privileged</sub>
</div>
