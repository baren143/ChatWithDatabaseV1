"""Embedding provider — real NVIDIA or mock for development.

When NVIDIA_API_KEY is set and MOCK_EMBEDDINGS != 'true', uses real NVIDIA
embeddings. Otherwise, returns a deterministic mock vector so the app can
run without a GPU / API key for frontend / integration testing.
"""

import os
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def _use_mock() -> bool:
    return (
        os.getenv("MOCK_EMBEDDINGS", "").lower() in ("true", "1", "yes")
        or not os.getenv("NVIDIA_API_KEY", "").strip()
    )


class MockNVIDIAEmbeddings:
    """Drop-in replacement that returns a fixed 4096‑dim vector."""

    def __init__(self, **kwargs):
        logger.info("Using MOCK embeddings (no NVIDIA_API_KEY or MOCK_EMBEDDINGS=true)")

    def embed_query(self, text: str) -> List[float]:
        import hashlib
        # Deterministic hash-based vector so identical queries return the same vector
        h = hashlib.sha256(text.encode()).hexdigest()
        return [int(h[i : i + 2], 16) / 255.0 for i in range(0, min(128, len(h)), 2)] + [0.0] * (4096 - 64)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_query(t) for t in texts]


def get_embedder(**kwargs):
    """Return either a real NVIDIAEmbeddings instance or a mock."""
    if _use_mock():
        return MockNVIDIAEmbeddings(**kwargs)
    from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
    logger.info("Using REAL NVIDIA embeddings")
    return NVIDIAEmbeddings(
        model=kwargs.get("model", "nvidia/nv-embed-v1"),
        nvidia_api_key=os.getenv("NVIDIA_API_KEY"),
    )


class MockChatNVIDIA:
    """Drop-in replacement for ChatNVIDIA that returns a canned response."""

    def __init__(self, **kwargs):
        logger.info("Using MOCK LLM (no NVIDIA_API_KEY or MOCK_EMBEDDINGS=true)")

    def stream(self, messages):
        # Extract the user's last message
        user_msg = ""
        for m in reversed(messages):
            if hasattr(m, "type") and m.type == "human":
                user_msg = m.content
                break
            elif isinstance(m, dict) and m.get("role") == "user":
                user_msg = m.get("content", "")
                break
        yield f"[MOCK LLM] Received your message. In production, this would use NVIDIA's LLM. You said: {user_msg[:200]}"


def get_llm(**kwargs):
    """Return either a real ChatNVIDIA instance or a mock."""
    if _use_mock():
        return MockChatNVIDIA(**kwargs)
    from langchain_nvidia_ai_endpoints import ChatNVIDIA
    logger.info("Using REAL NVIDIA LLM")
    return ChatNVIDIA(
        model=kwargs.get("model", "meta/llama-3.3-70b-instruct"),
        nvidia_api_key=os.getenv("NVIDIA_API_KEY"),
        max_completion_tokens=kwargs.get("max_completion_tokens", 4096),
        temperature=kwargs.get("temperature", 0.0),
    )