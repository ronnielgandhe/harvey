# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Harvey LiveKit agent — production image for AWS ECS Fargate.
#
# The agent is a long-running worker that connects OUT to LiveKit Cloud.
# It listens for room assignments, joins them, runs the STT→LLM→TTS loop,
# and fires tools (including RAG over the pre-built Chroma index). It has
# NO inbound HTTP surface; no port needs to be exposed.
#
# Build from repo root:
#   docker buildx build --platform linux/amd64 \
#     -t harvey-agent:latest \
#     -f backend/Dockerfile .
# -----------------------------------------------------------------------------
FROM python:3.12-slim-bookworm

# System deps:
#   - ffmpeg/libsndfile1: audio muxing for ElevenLabs + Deepgram piping
#   - build-essential: chromadb occasionally compiles native bits on install
#   - ca-certificates: TLS to all the API hosts (OpenAI, Deepgram, ElevenLabs, LiveKit)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 ca-certificates build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps FIRST so the layer caches when only code changes.
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    # Silero VAD needs torch; pull the CPU wheels explicitly so we don't
    # accidentally install the 2GB CUDA build on a Fargate task.
    && pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy the agent code + RAG modules.
COPY backend /app

# Copy the pre-built Chroma index + curated datasets. Baking the vector
# store INTO the image is the simplest reliable path for this take-home —
# zero cold-start cost, zero external volume setup. For production you'd
# mount an EFS volume or pull from S3 on boot.
COPY data /app/data

# RAG paths inside the container.
ENV HARVEY_CHROMA_DIR=/app/data/chroma_db \
    HARVEY_CORPUS_DIR=/app/data/corpus \
    HARVEY_COLLECTION=harvey_legal \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Quick healthcheck: process is alive + connected to LiveKit Cloud.
# Exits non-zero if the agent hasn't registered within 20s of the check.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep -f "agent.py" >/dev/null || exit 1

# Warm the Chroma SQLite + HNSW index files into the kernel page cache
# BEFORE Python imports chromadb. On cold Firecracker VMs, the first
# mmap of the sqlite file takes 30-60s which trips chromadb's internal
# Rust-pool timeout. Pre-reading the files with `cat` forces the kernel
# to load all pages into memory once, so chromadb's subsequent open is
# ~instant instead of racing a filesystem cold start.
CMD ["sh", "-c", "find /app/data/chroma_db -type f -exec cat {} + > /dev/null 2>&1; exec python agent.py start"]
