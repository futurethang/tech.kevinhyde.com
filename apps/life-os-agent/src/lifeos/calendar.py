"""Google Calendar client for Life OS Agent.

Handles OAuth authentication and calendar CRUD operations.
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any

from .scheduler import ScheduledEvent


# Google API scopes
SCOPES = ["https://www.googleapis.com/auth/calendar"]


class GoogleCalendarClient:
    """Client for Google Calendar API."""

    def __init__(
        self,
        credentials_file: str | None = None,
        token_file: str | None = None,
        credentials_b64: str | None = None,
    ):
        """Initialize Google Calendar client.

        Args:
            credentials_file: Path to OAuth credentials JSON
            token_file: Path to store/load OAuth tokens
            credentials_b64: Base64-encoded credentials (for production)
        """
        self.credentials_file = credentials_file or os.getenv(
            "GOOGLE_CREDENTIALS_FILE", "credentials.json"
        )
        self.token_file = token_file or os.getenv(
            "GOOGLE_TOKEN_FILE", "token.json"
        )
        self.credentials_b64 = credentials_b64 or os.getenv("GOOGLE_CREDENTIALS_B64", "")

        self._service = None
        self._credentials = None

    def _get_credentials(self):
        """Load or create OAuth credentials."""
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow

        creds = None

        # Load existing token
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)

        # Refresh or create new credentials
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                # Get credentials file
                if self.credentials_b64:
                    # Decode from base64
                    creds_data = json.loads(base64.b64decode(self.credentials_b64))
                    creds_file = "/tmp/google_credentials.json"
                    with open(creds_file, "w") as f:
                        json.dump(creds_data, f)
                else:
                    creds_file = self.credentials_file

                if not os.path.exists(creds_file):
                    raise FileNotFoundError(
                        f"Google credentials file not found: {creds_file}. "
                        "Run 'python -m lifeos.calendar auth' to authenticate."
                    )

                flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
                creds = flow.run_local_server(port=0)

            # Save token
            with open(self.token_file, "w") as f:
                f.write(creds.to_json())

        return creds

    @property
    def service(self):
        """Get or create the Calendar service."""
        if self._service is None:
            from googleapiclient.discovery import build

            creds = self._get_credentials()
            self._service = build("calendar", "v3", credentials=creds)

        return self._service

    async def list_events(
        self,
        start_date: date | datetime | None = None,
        end_date: date | datetime | None = None,
        calendar_id: str = "primary",
        max_results: int = 100,
    ) -> list[ScheduledEvent]:
        """List calendar events.

        Args:
            start_date: Start of range (defaults to today)
            end_date: End of range (defaults to 7 days from start)
            calendar_id: Calendar ID (defaults to primary)
            max_results: Maximum events to return

        Returns:
            List of ScheduledEvent objects
        """
        if start_date is None:
            start_date = date.today()
        if end_date is None:
            end_date = start_date + timedelta(days=7)

        # Convert to datetime if needed
        if isinstance(start_date, date) and not isinstance(start_date, datetime):
            start_dt = datetime.combine(start_date, datetime.min.time())
        else:
            start_dt = start_date

        if isinstance(end_date, date) and not isinstance(end_date, datetime):
            end_dt = datetime.combine(end_date, datetime.max.time())
        else:
            end_dt = end_date

        # Format for API
        time_min = start_dt.isoformat() + "Z" if start_dt.tzinfo is None else start_dt.isoformat()
        time_max = end_dt.isoformat() + "Z" if end_dt.tzinfo is None else end_dt.isoformat()

        # Call API
        result = (
            self.service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

        events = []
        for item in result.get("items", []):
            # Parse start/end times
            start_data = item.get("start", {})
            end_data = item.get("end", {})

            if "dateTime" in start_data:
                start = datetime.fromisoformat(start_data["dateTime"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(end_data["dateTime"].replace("Z", "+00:00"))
            else:
                # All-day event
                start = datetime.fromisoformat(start_data.get("date", ""))
                end = datetime.fromisoformat(end_data.get("date", ""))

            # Extract activity ID from extended properties if present
            activity_id = None
            ext_props = item.get("extendedProperties", {}).get("private", {})
            if ext_props:
                activity_id = ext_props.get("lifeos_activity_id")

            events.append(
                ScheduledEvent(
                    id=item["id"],
                    title=item.get("summary", ""),
                    start=start,
                    end=end,
                    activity_id=activity_id,
                    location=item.get("location"),
                    description=item.get("description"),
                )
            )

        return events

    async def create_event(
        self,
        title: str,
        start: datetime,
        end: datetime,
        calendar_id: str = "primary",
        activity_id: str | None = None,
        location: str | None = None,
        description: str | None = None,
    ) -> ScheduledEvent:
        """Create a calendar event.

        Args:
            title: Event title
            start: Start datetime
            end: End datetime
            calendar_id: Calendar ID
            activity_id: Life OS activity ID (stored in extended properties)
            location: Event location
            description: Event description

        Returns:
            Created ScheduledEvent
        """
        event_body: dict[str, Any] = {
            "summary": title,
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": "America/Los_Angeles",  # TODO: Get from config
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": "America/Los_Angeles",
            },
        }

        if location:
            event_body["location"] = location

        if description:
            event_body["description"] = description

        if activity_id:
            event_body["extendedProperties"] = {
                "private": {"lifeos_activity_id": activity_id}
            }

        result = (
            self.service.events()
            .insert(calendarId=calendar_id, body=event_body)
            .execute()
        )

        return ScheduledEvent(
            id=result["id"],
            title=title,
            start=start,
            end=end,
            activity_id=activity_id,
            location=location,
            description=description,
        )

    async def update_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
        title: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        location: str | None = None,
        description: str | None = None,
    ) -> ScheduledEvent:
        """Update an existing calendar event.

        Args:
            event_id: Event ID to update
            calendar_id: Calendar ID
            title: New title (optional)
            start: New start time (optional)
            end: New end time (optional)
            location: New location (optional)
            description: New description (optional)

        Returns:
            Updated ScheduledEvent
        """
        # Get existing event
        existing = (
            self.service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        )

        # Update fields
        if title is not None:
            existing["summary"] = title

        if start is not None:
            existing["start"] = {
                "dateTime": start.isoformat(),
                "timeZone": "America/Los_Angeles",
            }

        if end is not None:
            existing["end"] = {
                "dateTime": end.isoformat(),
                "timeZone": "America/Los_Angeles",
            }

        if location is not None:
            existing["location"] = location

        if description is not None:
            existing["description"] = description

        result = (
            self.service.events()
            .update(calendarId=calendar_id, eventId=event_id, body=existing)
            .execute()
        )

        # Parse result
        start_data = result.get("start", {})
        end_data = result.get("end", {})
        parsed_start = datetime.fromisoformat(
            start_data.get("dateTime", "").replace("Z", "+00:00")
        )
        parsed_end = datetime.fromisoformat(
            end_data.get("dateTime", "").replace("Z", "+00:00")
        )

        return ScheduledEvent(
            id=result["id"],
            title=result.get("summary", ""),
            start=parsed_start,
            end=parsed_end,
            location=result.get("location"),
            description=result.get("description"),
        )

    async def delete_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
    ) -> bool:
        """Delete a calendar event.

        Args:
            event_id: Event ID to delete
            calendar_id: Calendar ID

        Returns:
            True if deleted successfully
        """
        try:
            self.service.events().delete(
                calendarId=calendar_id, eventId=event_id
            ).execute()
            return True
        except Exception:
            return False

    async def find_free_time(
        self,
        date_: date,
        duration_minutes: int,
        calendar_id: str = "primary",
        start_hour: int = 6,
        end_hour: int = 22,
    ) -> list[tuple[datetime, datetime]]:
        """Find free time slots on a given date.

        Args:
            date_: Date to check
            duration_minutes: Required duration
            calendar_id: Calendar ID
            start_hour: Earliest hour to consider
            end_hour: Latest hour to consider

        Returns:
            List of (start, end) datetime tuples
        """
        # Get events for the day
        events = await self.list_events(
            start_date=date_,
            end_date=date_ + timedelta(days=1),
            calendar_id=calendar_id,
        )

        # Build occupied times
        day_start = datetime.combine(date_, datetime.min.time().replace(hour=start_hour))
        day_end = datetime.combine(date_, datetime.min.time().replace(hour=end_hour))

        free_slots = []
        current = day_start

        for event in sorted(events, key=lambda e: e.start):
            # Skip all-day events or events outside our window
            if event.start.date() != date_:
                continue

            event_start = event.start.replace(tzinfo=None)
            event_end = event.end.replace(tzinfo=None)

            # Gap before this event?
            if event_start > current:
                gap_minutes = (event_start - current).total_seconds() / 60
                if gap_minutes >= duration_minutes:
                    free_slots.append((current, event_start))

            current = max(current, event_end)

        # Check remaining time
        if current < day_end:
            gap_minutes = (day_end - current).total_seconds() / 60
            if gap_minutes >= duration_minutes:
                free_slots.append((current, day_end))

        return free_slots


class MockCalendarClient:
    """Mock calendar client for testing without Google API."""

    def __init__(self):
        """Initialize mock client."""
        self._events: dict[str, ScheduledEvent] = {}
        self._next_id = 1

    async def list_events(
        self,
        start_date: date | datetime | None = None,
        end_date: date | datetime | None = None,
        calendar_id: str = "primary",
        max_results: int = 100,
    ) -> list[ScheduledEvent]:
        """List mock events."""
        if start_date is None:
            start_date = date.today()
        if end_date is None:
            end_date = start_date + timedelta(days=7)

        # Convert to date if datetime
        start = start_date.date() if isinstance(start_date, datetime) else start_date
        end = end_date.date() if isinstance(end_date, datetime) else end_date

        return [
            e
            for e in self._events.values()
            if start <= e.start.date() <= end
        ][:max_results]

    async def create_event(
        self,
        title: str,
        start: datetime,
        end: datetime,
        calendar_id: str = "primary",
        activity_id: str | None = None,
        location: str | None = None,
        description: str | None = None,
    ) -> ScheduledEvent:
        """Create a mock event."""
        event_id = f"mock_{self._next_id}"
        self._next_id += 1

        event = ScheduledEvent(
            id=event_id,
            title=title,
            start=start,
            end=end,
            activity_id=activity_id,
            location=location,
            description=description,
        )
        self._events[event_id] = event
        return event

    async def update_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
        title: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        location: str | None = None,
        description: str | None = None,
    ) -> ScheduledEvent:
        """Update a mock event."""
        event = self._events.get(event_id)
        if not event:
            raise ValueError(f"Event not found: {event_id}")

        updated = ScheduledEvent(
            id=event_id,
            title=title if title is not None else event.title,
            start=start if start is not None else event.start,
            end=end if end is not None else event.end,
            activity_id=event.activity_id,
            location=location if location is not None else event.location,
            description=description if description is not None else event.description,
        )
        self._events[event_id] = updated
        return updated

    async def delete_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
    ) -> bool:
        """Delete a mock event."""
        if event_id in self._events:
            del self._events[event_id]
            return True
        return False

    async def find_free_time(
        self,
        date_: date,
        duration_minutes: int,
        calendar_id: str = "primary",
        start_hour: int = 6,
        end_hour: int = 22,
    ) -> list[tuple[datetime, datetime]]:
        """Find free time in mock calendar."""
        events = await self.list_events(start_date=date_, end_date=date_)

        day_start = datetime.combine(date_, datetime.min.time().replace(hour=start_hour))
        day_end = datetime.combine(date_, datetime.min.time().replace(hour=end_hour))

        free_slots = []
        current = day_start

        for event in sorted(events, key=lambda e: e.start):
            if event.start > current:
                gap_minutes = (event.start - current).total_seconds() / 60
                if gap_minutes >= duration_minutes:
                    free_slots.append((current, event.start))
            current = max(current, event.end)

        if current < day_end:
            gap_minutes = (day_end - current).total_seconds() / 60
            if gap_minutes >= duration_minutes:
                free_slots.append((current, day_end))

        return free_slots


def get_calendar_client(use_mock: bool = False) -> GoogleCalendarClient | MockCalendarClient:
    """Get a calendar client.

    Args:
        use_mock: Use mock client for testing

    Returns:
        Calendar client instance
    """
    if use_mock:
        return MockCalendarClient()
    return GoogleCalendarClient()


def main():
    """CLI for calendar authentication."""
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        print("Authenticating with Google Calendar...")
        client = GoogleCalendarClient()
        # Force authentication
        _ = client.service
        print("Authentication successful! Token saved.")
    else:
        print("Usage: python -m lifeos.calendar auth")


if __name__ == "__main__":
    main()
