from __future__ import annotations

from langchain_core.embeddings import Embeddings


class OpenAIEmbeddings(Embeddings):
    def __init__(self, model: str = "text-embedding-3-small", batch_size: int = 256) -> None:
        self.model = model
        self.batch_size = batch_size
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI()
        return self._client

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            resp = self.client.embeddings.create(model=self.model, input=texts[i : i + self.batch_size])
            out.extend(d.embedding for d in resp.data)
        return out

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
