"""Memory management for Life OS Agent.

Uses Mem0 Cloud for semantic memory storage and retrieval.
Falls back to JSON file storage for development.
"""

from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any
from enum import Enum

from pydantic import BaseModel


class MemoryType(str, Enum):
    """Types of memories stored."""

    PREFERENCE = "preference"  # User explicitly stated something
    DECISION = "decision"  # A scheduling decision was made
    CORRECTION = "correction"  # User corrected something
    SCHEDULED = "scheduled"  # Record of what was scheduled


class Memory(BaseModel):
    """A single memory entry."""

    id: str
    content: str
    memory_type: MemoryType
    metadata: dict[str, Any] = {}
    created_at: datetime = datetime.now()


class MemoryClient(ABC):
    """Abstract base class for memory storage."""

    @abstractmethod
    async def add(
        self,
        content: str,
        memory_type: MemoryType,
        user_id: str = "default",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Add a memory.

        Args:
            content: The memory content
            memory_type: Type of memory
            user_id: User identifier
            metadata: Additional metadata

        Returns:
            Memory ID
        """
        ...

    @abstractmethod
    async def search(
        self,
        query: str,
        user_id: str = "default",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search memories semantically.

        Args:
            query: Search query
            user_id: User identifier
            limit: Maximum results

        Returns:
            List of matching memories
        """
        ...

    @abstractmethod
    async def get_all(
        self,
        user_id: str = "default",
        memory_type: MemoryType | None = None,
    ) -> list[dict[str, Any]]:
        """Get all memories for a user.

        Args:
            user_id: User identifier
            memory_type: Filter by type

        Returns:
            List of memories
        """
        ...

    @abstractmethod
    async def delete(self, memory_id: str) -> bool:
        """Delete a memory.

        Args:
            memory_id: Memory ID

        Returns:
            True if deleted
        """
        ...


class Mem0Client(MemoryClient):
    """Mem0 Cloud client for semantic memory."""

    def __init__(self, api_key: str | None = None):
        """Initialize Mem0 client.

        Args:
            api_key: Mem0 API key. Uses MEM0_API_KEY env var if not provided.
        """
        self.api_key = api_key or os.getenv("MEM0_API_KEY", "")

        if not self.api_key:
            raise ValueError("MEM0_API_KEY not provided")

        # Lazy import to avoid dependency issues
        from mem0 import MemoryClient as Mem0MemoryClient

        self.client = Mem0MemoryClient(api_key=self.api_key)

    async def add(
        self,
        content: str,
        memory_type: MemoryType,
        user_id: str = "default",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Add a memory to Mem0."""
        metadata = metadata or {}
        metadata["memory_type"] = memory_type.value
        metadata["created_at"] = datetime.now().isoformat()

        # Mem0 client is sync, wrap in async
        result = self.client.add(
            messages=[{"role": "user", "content": content}],
            user_id=user_id,
            metadata=metadata,
        )

        # Return the first memory ID
        if result and "results" in result and result["results"]:
            return result["results"][0].get("id", "unknown")
        return "unknown"

    async def search(
        self,
        query: str,
        user_id: str = "default",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search memories in Mem0."""
        results = self.client.search(
            query=query,
            user_id=user_id,
            limit=limit,
        )

        return results.get("results", []) if results else []

    async def get_all(
        self,
        user_id: str = "default",
        memory_type: MemoryType | None = None,
    ) -> list[dict[str, Any]]:
        """Get all memories from Mem0."""
        results = self.client.get_all(user_id=user_id)

        memories = results if isinstance(results, list) else results.get("results", [])

        # Filter by type if specified
        if memory_type:
            memories = [
                m
                for m in memories
                if m.get("metadata", {}).get("memory_type") == memory_type.value
            ]

        return memories

    async def delete(self, memory_id: str) -> bool:
        """Delete a memory from Mem0."""
        try:
            self.client.delete(memory_id=memory_id)
            return True
        except Exception:
            return False


class SimpleMemoryClient(MemoryClient):
    """JSON file-based memory for development/testing."""

    def __init__(self, storage_path: str | Path = "data/memories.json"):
        """Initialize simple memory client.

        Args:
            storage_path: Path to JSON storage file
        """
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)

        if not self.storage_path.exists():
            self._save({})

    def _load(self) -> dict[str, list[dict[str, Any]]]:
        """Load memories from file."""
        with open(self.storage_path) as f:
            return json.load(f)

    def _save(self, data: dict[str, list[dict[str, Any]]]) -> None:
        """Save memories to file."""
        with open(self.storage_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    async def add(
        self,
        content: str,
        memory_type: MemoryType,
        user_id: str = "default",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Add a memory to JSON storage."""
        data = self._load()

        if user_id not in data:
            data[user_id] = []

        memory_id = f"{user_id}_{len(data[user_id])}_{datetime.now().timestamp()}"

        memory = {
            "id": memory_id,
            "content": content,
            "memory_type": memory_type.value,
            "metadata": metadata or {},
            "created_at": datetime.now().isoformat(),
        }

        data[user_id].append(memory)
        self._save(data)

        return memory_id

    async def search(
        self,
        query: str,
        user_id: str = "default",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Simple keyword search in JSON storage.

        Note: This is not semantic search, just basic string matching.
        Use Mem0Client for production semantic search.
        """
        data = self._load()
        memories = data.get(user_id, [])

        # Simple keyword matching
        query_lower = query.lower()
        matches = [
            m for m in memories if query_lower in m.get("content", "").lower()
        ]

        return matches[:limit]

    async def get_all(
        self,
        user_id: str = "default",
        memory_type: MemoryType | None = None,
    ) -> list[dict[str, Any]]:
        """Get all memories from JSON storage."""
        data = self._load()
        memories = data.get(user_id, [])

        if memory_type:
            memories = [m for m in memories if m.get("memory_type") == memory_type.value]

        return memories

    async def delete(self, memory_id: str) -> bool:
        """Delete a memory from JSON storage."""
        data = self._load()

        for user_id, memories in data.items():
            for i, memory in enumerate(memories):
                if memory.get("id") == memory_id:
                    memories.pop(i)
                    self._save(data)
                    return True

        return False


def get_memory_client(use_mem0: bool | None = None) -> MemoryClient:
    """Get the appropriate memory client.

    Args:
        use_mem0: Force use of Mem0 (True) or JSON (False).
                  If None, uses Mem0 if API key is available.

    Returns:
        Memory client instance
    """
    if use_mem0 is None:
        use_mem0 = bool(os.getenv("MEM0_API_KEY"))

    if use_mem0:
        return Mem0Client()
    else:
        return SimpleMemoryClient()
