import os
from langchain_ollama import ChatOllama

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
# Default: Phi-3 3.8B — light and fast. Alternatives: phi3:mini, qwen2.5:3b (set OLLAMA_MODEL).
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3:3.8b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "120"))

# Shared ChatOllama client for memo_generator, chat, and section endpoints.
# Set OLLAMA_MODEL / OLLAMA_BASE_URL / OLLAMA_TIMEOUT if defaults do not match your setup.
llm = ChatOllama(
    model=OLLAMA_MODEL,
    temperature=0,
    timeout=OLLAMA_TIMEOUT,
    base_url=OLLAMA_BASE_URL,
)
