# Harvey — Backend

LiveKit voice agent worker for the Harvey take-home. Deepgram STT → GPT-4o LLM → ElevenLabs TTS, with a 4-tool kit (statute lookup, case file, draft response, negotiation play) over a Chroma RAG index.

## 1. Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> If `pip install` complains about ChromaDB and you're on Apple Silicon, you may need Xcode CLT installed (`xcode-select --install`).

Copy env file and fill in keys:

```bash
cp .env.example .env
# edit .env
```

Required keys:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — from LiveKit Cloud project
- `OPENAI_API_KEY` — for LLM + embeddings
- `DEEPGRAM_API_KEY` — STT
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` — TTS (use any voice ID; pick a NYC-confident male timbre)

## 2. Build the RAG index

Drop legal PDFs into `../data/corpus/`. File names hint at jurisdiction (`ontario_*.pdf`, `ny_*.pdf`, `federal_*.pdf` etc.) — `ingest.py` infers it from the filename.

```bash
python ingest.py
# or wipe and re-ingest:
python ingest.py --force
```

Index persists to `../data/chroma_db/`.

## 3. Run the agent worker

```bash
python agent.py dev
```

This starts a LiveKit worker that joins any room dispatched to it. The frontend handles token minting and room creation.

For production:

```bash
python agent.py start
```

## 4. How it talks to the frontend

All UI updates flow through the LiveKit data channel as UTF-8 JSON bytes (reliable). The frontend should subscribe to `room.on('dataReceived', ...)` and decode.

```jsonc
// Tool-call indicator (optional toast)
{"type":"tool_call","payload":{"name":"pull_statute","status":"running"}}

// Statute card
{"type":"statute_card","payload":{
  "jurisdiction":"Ontario",
  "section":"HTA § 200",
  "title":"Duty to Report Accident",
  "quote":"Every person in charge of a motor vehicle...",
  "source":"ontario_hta.pdf",
  "page":42
}}

// Case file row
{"type":"case_file_update","payload":{"field":"incident_type","value":"Parking lot collision"}}

// Drafted email/letter
{"type":"draft_response","payload":{"recipient":"Insurance company","tone":"firm","body":"..."}}

// Negotiation framework
{"type":"negotiation_play","payload":{"steps":[
  {"label":"Anchor","text":"..."},
  {"label":"Counter","text":"..."},
  {"label":"Walkaway","text":"..."}
]}}
```

## 5. Files

| File | Purpose |
|---|---|
| `agent.py` | Worker entrypoint, AgentSession, plugin wiring |
| `prompts.py` | Harvey persona system prompt |
| `tools.py` | 4 `@function_tool` implementations + data-channel publisher |
| `rag.py` | Chroma retriever singleton |
| `ingest.py` | PDF chunker / embedder, run once before `agent.py` |
| `requirements.txt` | Pinned major versions |
| `.env.example` | Required env keys |

## 6. Smoke test

```bash
python -c "import agent; print('ok')"
python -c "import rag, tools, prompts; print('ok')"
```

## Notes / decisions

- LiveKit Agents `>=1.0` API: `Agent` subclass with `tools=[...]`, `AgentSession.start(agent=, room=)`, `@function_tool` taking `RunContext`.
- Data channel: `ctx.session.room.local_participant.publish_data(bytes, reliable=True)`.
- `text-embedding-3-small` + `gpt-4o` (latency over IQ, per spec).
- Chunk size 1000 / overlap 200 / `k=4`.
- Jurisdiction inferred from PDF filename — re-name files like `ontario_hta.pdf` for best results.
- Turn detection uses LiveKit's `turn_detector` plugin if installed, else VAD-only.
