"""In-memory import sessions — workspace-scoped, TTL, discarded after commit."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


TTL_SECONDS = 30 * 60


@dataclass
class ImportSession:
    id: str
    workspace_id: str
    user_id: str
    filename: str
    format: str
    sheets: list[dict[str, Any]]
    created_at: float = field(default_factory=time.time)

    @property
    def expired(self) -> bool:
        return time.time() - self.created_at > TTL_SECONDS


class ImportSessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, ImportSession] = {}

    def create(
        self,
        *,
        workspace_id: str,
        user_id: str,
        filename: str,
        format: str,
        sheets: list[dict[str, Any]],
    ) -> ImportSession:
        self.purge_expired()
        sid = str(uuid.uuid4())
        # Store full rows server-side; clients only get metadata + preview
        session = ImportSession(
            id=sid,
            workspace_id=workspace_id,
            user_id=user_id,
            filename=filename,
            format=format,
            sheets=sheets,
        )
        with self._lock:
            self._sessions[sid] = session
        return session

    def get(self, session_id: str, *, workspace_id: str) -> ImportSession | None:
        with self._lock:
            s = self._sessions.get(session_id)
            if not s:
                return None
            if s.expired:
                self._sessions.pop(session_id, None)
                return None
            if s.workspace_id != workspace_id:
                return None
            return s

    def delete(self, session_id: str, *, workspace_id: str) -> None:
        with self._lock:
            s = self._sessions.get(session_id)
            if s and s.workspace_id == workspace_id:
                self._sessions.pop(session_id, None)

    def purge_expired(self) -> None:
        now = time.time()
        with self._lock:
            dead = [k for k, v in self._sessions.items() if now - v.created_at > TTL_SECONDS]
            for k in dead:
                self._sessions.pop(k, None)


_STORE: ImportSessionStore | None = None


def get_import_session_store() -> ImportSessionStore:
    global _STORE
    if _STORE is None:
        _STORE = ImportSessionStore()
    return _STORE
