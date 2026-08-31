"""Google Calendar integration — abstract base + stub implementation.

The real OAuth-backed implementation is deferred until GOOGLE_CLIENT_ID and
GOOGLE_CLIENT_SECRET are configured in production. Until then, the rest of
the codebase talks to the abstract `GoogleCalendarService` so we can swap
the real service in later without touching callers.

For now, callers that want a basic 'add to calendar' affordance should use
`build_google_calendar_link` in `email_service.py` — the OAuth-free deep
link works without any of the machinery here.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List

import config

logger = logging.getLogger(__name__)


@dataclass
class CalendarEvent:
    """Generic representation of a calendar event."""
    title: str
    start_time: datetime
    duration_minutes: int = 60
    description: str = ""
    location: str = "Virtual Meeting"
    attendees: List[str] = field(default_factory=list)
    organizer_email: Optional[str] = None
    # Set by the service after a successful create.
    external_id: Optional[str] = None

    @property
    def end_time(self) -> datetime:
        return self.start_time + timedelta(minutes=self.duration_minutes)


class GoogleCalendarService(ABC):
    """Common interface for any Google Calendar implementation."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether this service can actually talk to Google."""

    @abstractmethod
    def create_event(self, event: CalendarEvent) -> CalendarEvent:
        """Create the event on the user's primary calendar.

        Returns the same event with `external_id` populated.
        """

    @abstractmethod
    def update_event(self, event: CalendarEvent) -> CalendarEvent:
        """Update an event identified by its `external_id`."""

    @abstractmethod
    def delete_event(self, external_id: str) -> bool:
        """Delete an event. Returns True on success."""


class StubGoogleCalendarService(GoogleCalendarService):
    """Logs intended actions; never talks to Google.

    Active whenever GOOGLE_CLIENT_ID is unset. Lets every code path that
    wants to integrate with Google Calendar continue to function in dev
    and in unconfigured production environments.
    """

    def is_configured(self) -> bool:
        return False

    def create_event(self, event: CalendarEvent) -> CalendarEvent:
        logger.info(
            "[stub-gcal] create_event title=%r start=%s duration=%dm "
            "attendees=%s",
            event.title, event.start_time.isoformat(),
            event.duration_minutes, event.attendees,
        )
        # Synthesize a fake id so callers can persist + reference it.
        event.external_id = f"stub-event-{int(event.start_time.timestamp())}"
        return event

    def update_event(self, event: CalendarEvent) -> CalendarEvent:
        logger.info(
            "[stub-gcal] update_event id=%s title=%r start=%s",
            event.external_id, event.title, event.start_time.isoformat(),
        )
        return event

    def delete_event(self, external_id: str) -> bool:
        logger.info("[stub-gcal] delete_event id=%s", external_id)
        return True


def get_google_calendar_service() -> GoogleCalendarService:
    """Pick the right implementation based on configuration.

    Always returns the stub today. Once OAuth is wired (and a real impl
    lives next to this file), this dispatcher just needs the new branch.
    """
    if not getattr(config, "GOOGLE_CLIENT_ID", None):
        return StubGoogleCalendarService()
    # Real implementation lives here once OAuth is set up.
    return StubGoogleCalendarService()


# Module-level convenience singleton.
google_calendar_service: GoogleCalendarService = get_google_calendar_service()
