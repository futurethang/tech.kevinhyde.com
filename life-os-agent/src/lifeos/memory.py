"""Memory layer using Mem0 for Life OS Agent."""

from __future__ import annotations

import os
from typing import Any

import httpx


class MemoryClient:
    """Client for Mem0 memory operations.

    Supports both self-hosted Mem0 (via API URL) and Mem0 Cloud (via API key).
    """

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        user_id: str | None = None,
    ):
        """Initialize the memory client.

        Args:
            api_url: URL for self-hosted Mem0 instance (e.g., http://localhost:8080)
            api_key: API key for Mem0 Cloud (if using cloud)
            user_id: Default user ID for memory operations
        """
        self.api_url = api_url or os.environ.get("MEM0_API_URL", "http://localhost:8080")
        self.api_key = api_key or os.environ.get("MEM0_API_KEY")
        self.user_id = user_id or os.environ.get("LIFEOS_USER_ID", "default")

        # Set up HTTP client
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self._client = httpx.Client(
            base_url=self.api_url.rstrip("/"),
            headers=headers,
            timeout=30.0,
        )

    def add(
        self,
        messages: list[dict[str, str]] | str,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add memories from a conversation or text.

        Args:
            messages: List of message dicts with 'role' and 'content', or a string
            user_id: User ID for memory isolation (defaults to instance user_id)
            metadata: Additional metadata to store with the memory

        Returns:
            Response from Mem0 with created memories
        """
        user_id = user_id or self.user_id

        body: dict[str, Any] = {
            "user_id": user_id,
        }

        if isinstance(messages, str):
            body["messages"] = [{"role": "user", "content": messages}]
        else:
            body["messages"] = messages

        if metadata:
            body["metadata"] = metadata

        response = self._client.post("/v1/memories/", json=body)
        response.raise_for_status()
        return response.json()

    def search(
        self,
        query: str,
        user_id: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search memories by semantic similarity.

        Args:
            query: Search query
            user_id: User ID for memory isolation
            limit: Maximum number of results

        Returns:
            List of matching memory entries
        """
        user_id = user_id or self.user_id

        body = {
            "query": query,
            "user_id": user_id,
            "limit": limit,
        }

        response = self._client.post("/v1/memories/search/", json=body)
        response.raise_for_status()
        return response.json().get("results", [])

    def get_all(
        self,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get all memories for a user.

        Args:
            user_id: User ID for memory isolation
            limit: Maximum number of results

        Returns:
            List of all memory entries
        """
        user_id = user_id or self.user_id

        response = self._client.get(
            "/v1/memories/",
            params={"user_id": user_id, "limit": limit},
        )
        response.raise_for_status()
        return response.json().get("results", [])

    def get(self, memory_id: str) -> dict[str, Any]:
        """Get a specific memory by ID.

        Args:
            memory_id: The memory ID

        Returns:
            Memory entry
        """
        response = self._client.get(f"/v1/memories/{memory_id}/")
        response.raise_for_status()
        return response.json()

    def update(
        self,
        memory_id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update a memory's content.

        Args:
            memory_id: The memory ID to update
            content: New content for the memory
            metadata: Updated metadata

        Returns:
            Updated memory entry
        """
        body: dict[str, Any] = {"content": content}
        if metadata:
            body["metadata"] = metadata

        response = self._client.put(f"/v1/memories/{memory_id}/", json=body)
        response.raise_for_status()
        return response.json()

    def delete(self, memory_id: str) -> None:
        """Delete a specific memory.

        Args:
            memory_id: The memory ID to delete
        """
        response = self._client.delete(f"/v1/memories/{memory_id}/")
        response.raise_for_status()

    def delete_all(self, user_id: str | None = None) -> None:
        """Delete all memories for a user.

        Args:
            user_id: User ID for memory isolation
        """
        user_id = user_id or self.user_id
        response = self._client.delete(f"/v1/memories/", params={"user_id": user_id})
        response.raise_for_status()

    def health_check(self) -> bool:
        """Check if Mem0 service is healthy.

        Returns:
            True if service is responding
        """
        try:
            response = self._client.get("/health")
            return response.status_code == 200
        except httpx.RequestError:
            return False

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "MemoryClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class SimpleMemoryClient:
    """Simple JSON-based memory client for development/testing.

    This provides a drop-in replacement for MemoryClient that stores
    memories in a local JSON file instead of requiring Mem0.
    """

    def __init__(
        self,
        file_path: str = ".lifeos_memories.json",
        user_id: str | None = None,
    ):
        """Initialize the simple memory client.

        Args:
            file_path: Path to the JSON file for storing memories
            user_id: Default user ID for memory operations
        """
        import json
        from pathlib import Path

        self.file_path = Path(file_path)
        self.user_id = user_id or os.environ.get("LIFEOS_USER_ID", "default")
        self._memories: dict[str, list[dict[str, Any]]] = {}

        # Load existing memories
        if self.file_path.exists():
            with open(self.file_path) as f:
                self._memories = json.load(f)

    def _save(self) -> None:
        """Save memories to file."""
        import json

        with open(self.file_path, "w") as f:
            json.dump(self._memories, f, indent=2, default=str)

    def _get_user_memories(self, user_id: str) -> list[dict[str, Any]]:
        """Get memories for a specific user."""
        return self._memories.setdefault(user_id, [])

    def add(
        self,
        messages: list[dict[str, str]] | str,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add a memory from conversation or text."""
        import uuid
        from datetime import datetime

        user_id = user_id or self.user_id
        memories = self._get_user_memories(user_id)

        # Extract content from messages
        if isinstance(messages, str):
            content = messages
        else:
            content = " | ".join(f"{m['role']}: {m['content']}" for m in messages)

        memory_entry = {
            "id": str(uuid.uuid4()),
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.now().isoformat(),
            "user_id": user_id,
        }

        memories.append(memory_entry)
        self._save()

        return {"memories": [memory_entry]}

    def search(
        self,
        query: str,
        user_id: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Simple keyword search through memories."""
        user_id = user_id or self.user_id
        memories = self._get_user_memories(user_id)

        # Simple keyword matching (not semantic)
        query_lower = query.lower()
        matches = [
            m for m in memories if query_lower in m.get("content", "").lower()
        ]

        return matches[:limit]

    def get_all(
        self,
        user_id: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get all memories for a user."""
        user_id = user_id or self.user_id
        memories = self._get_user_memories(user_id)
        return memories[:limit]

    def get(self, memory_id: str) -> dict[str, Any]:
        """Get a specific memory by ID."""
        for user_memories in self._memories.values():
            for memory in user_memories:
                if memory.get("id") == memory_id:
                    return memory
        raise KeyError(f"Memory not found: {memory_id}")

    def update(
        self,
        memory_id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update a memory's content."""
        for user_memories in self._memories.values():
            for memory in user_memories:
                if memory.get("id") == memory_id:
                    memory["content"] = content
                    if metadata:
                        memory["metadata"].update(metadata)
                    self._save()
                    return memory
        raise KeyError(f"Memory not found: {memory_id}")

    def delete(self, memory_id: str) -> None:
        """Delete a specific memory."""
        for user_memories in self._memories.values():
            for i, memory in enumerate(user_memories):
                if memory.get("id") == memory_id:
                    user_memories.pop(i)
                    self._save()
                    return
        raise KeyError(f"Memory not found: {memory_id}")

    def delete_all(self, user_id: str | None = None) -> None:
        """Delete all memories for a user."""
        user_id = user_id or self.user_id
        self._memories[user_id] = []
        self._save()

    def health_check(self) -> bool:
        """Always returns True for local storage."""
        return True

    def close(self) -> None:
        """No-op for local storage."""
        pass

    def __enter__(self) -> "SimpleMemoryClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
