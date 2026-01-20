"""Google Calendar integration for Life OS Agent."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# If modifying these scopes, delete token.json and re-authenticate
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


class CalendarClient:
    """Client for Google Calendar API operations."""

    def __init__(
        self,
        credentials_file: str | Path | None = None,
        token_file: str | Path | None = None,
    ):
        """Initialize the calendar client.

        Args:
            credentials_file: Path to OAuth client credentials JSON
            token_file: Path to store/load the user's access token
        """
        self.credentials_file = Path(credentials_file or os.environ.get("GOOGLE_CREDENTIALS_FILE", "credentials.json"))
        self.token_file = Path(token_file or os.environ.get("GOOGLE_TOKEN_FILE", "token.json"))
        self._service: Any = None

    def authenticate(self) -> Credentials:
        """Authenticate with Google Calendar API.

        Returns:
            Valid credentials for API access
        """
        creds = None

        # Load existing token if available
        if self.token_file.exists():
            creds = Credentials.from_authorized_user_file(str(self.token_file), SCOPES)

        # If no valid credentials, prompt for login
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not self.credentials_file.exists():
                    raise FileNotFoundError(
                        f"Credentials file not found: {self.credentials_file}\n"
                        "Please download OAuth client credentials from Google Cloud Console.\n"
                        "See README.md for setup instructions."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(self.credentials_file), SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save the credentials for next run
            with open(self.token_file, "w") as token:
                token.write(creds.to_json())

        return creds

    @property
    def service(self) -> Any:
        """Get the Google Calendar API service."""
        if self._service is None:
            creds = self.authenticate()
            self._service = build("calendar", "v3", credentials=creds)
        return self._service

    def list_calendars(self) -> list[dict[str, Any]]:
        """List all accessible calendars.

        Returns:
            List of calendar metadata dictionaries
        """
        result = self.service.calendarList().list().execute()
        return result.get("items", [])

    def get_calendar(self, calendar_id: str = "primary") -> dict[str, Any]:
        """Get details about a specific calendar.

        Args:
            calendar_id: Calendar ID or 'primary' for the user's primary calendar

        Returns:
            Calendar metadata dictionary
        """
        return self.service.calendars().get(calendarId=calendar_id).execute()

    def list_events(
        self,
        calendar_id: str = "primary",
        time_min: datetime | None = None,
        time_max: datetime | None = None,
        max_results: int = 250,
        single_events: bool = True,
        order_by: str = "startTime",
    ) -> list[dict[str, Any]]:
        """List events from a calendar.

        Args:
            calendar_id: Calendar ID or 'primary'
            time_min: Start of time range (defaults to now)
            time_max: End of time range (defaults to 7 days from now)
            max_results: Maximum number of events to return
            single_events: Whether to expand recurring events
            order_by: Sort order ('startTime' or 'updated')

        Returns:
            List of event dictionaries
        """
        if time_min is None:
            time_min = datetime.utcnow()
        if time_max is None:
            time_max = time_min + timedelta(days=7)

        events_result = (
            self.service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min.isoformat() + "Z",
                timeMax=time_max.isoformat() + "Z",
                maxResults=max_results,
                singleEvents=single_events,
                orderBy=order_by,
            )
            .execute()
        )
        return events_result.get("items", [])

    def get_event(self, event_id: str, calendar_id: str = "primary") -> dict[str, Any]:
        """Get a specific event.

        Args:
            event_id: The event ID
            calendar_id: Calendar ID or 'primary'

        Returns:
            Event dictionary
        """
        return self.service.events().get(calendarId=calendar_id, eventId=event_id).execute()

    def create_event(
        self,
        summary: str,
        start: datetime,
        end: datetime,
        calendar_id: str = "primary",
        description: str | None = None,
        location: str | None = None,
        color_id: str | None = None,
        extended_properties: dict[str, dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """Create a new calendar event.

        Args:
            summary: Event title
            start: Start datetime
            end: End datetime
            calendar_id: Calendar ID or 'primary'
            description: Event description
            location: Event location
            color_id: Google Calendar color ID (1-11)
            extended_properties: Custom properties for Life OS tracking

        Returns:
            Created event dictionary
        """
        event_body: dict[str, Any] = {
            "summary": summary,
            "start": {"dateTime": start.isoformat(), "timeZone": "America/Los_Angeles"},
            "end": {"dateTime": end.isoformat(), "timeZone": "America/Los_Angeles"},
        }

        if description:
            event_body["description"] = description
        if location:
            event_body["location"] = location
        if color_id:
            event_body["colorId"] = color_id
        if extended_properties:
            event_body["extendedProperties"] = extended_properties

        return self.service.events().insert(calendarId=calendar_id, body=event_body).execute()

    def update_event(
        self,
        event_id: str,
        calendar_id: str = "primary",
        **updates: Any,
    ) -> dict[str, Any]:
        """Update an existing event.

        Args:
            event_id: The event ID to update
            calendar_id: Calendar ID or 'primary'
            **updates: Fields to update (summary, description, start, end, etc.)

        Returns:
            Updated event dictionary
        """
        event = self.get_event(event_id, calendar_id)

        for key, value in updates.items():
            if key in ("start", "end") and isinstance(value, datetime):
                event[key] = {"dateTime": value.isoformat(), "timeZone": "America/Los_Angeles"}
            else:
                event[key] = value

        return (
            self.service.events()
            .update(calendarId=calendar_id, eventId=event_id, body=event)
            .execute()
        )

    def delete_event(self, event_id: str, calendar_id: str = "primary") -> None:
        """Delete an event.

        Args:
            event_id: The event ID to delete
            calendar_id: Calendar ID or 'primary'
        """
        self.service.events().delete(calendarId=calendar_id, eventId=event_id).execute()

    def get_freebusy(
        self,
        time_min: datetime,
        time_max: datetime,
        calendar_ids: list[str] | None = None,
    ) -> dict[str, list[dict[str, str]]]:
        """Get free/busy information for calendars.

        Args:
            time_min: Start of query range
            time_max: End of query range
            calendar_ids: List of calendar IDs to check (defaults to primary)

        Returns:
            Dict mapping calendar IDs to lists of busy periods
        """
        if calendar_ids is None:
            calendar_ids = ["primary"]

        body = {
            "timeMin": time_min.isoformat() + "Z",
            "timeMax": time_max.isoformat() + "Z",
            "items": [{"id": cal_id} for cal_id in calendar_ids],
        }

        result = self.service.freebusy().query(body=body).execute()
        return {
            cal_id: result.get("calendars", {}).get(cal_id, {}).get("busy", [])
            for cal_id in calendar_ids
        }

    def find_free_slots(
        self,
        time_min: datetime,
        time_max: datetime,
        duration_minutes: int,
        calendar_ids: list[str] | None = None,
        work_hours: tuple[int, int] = (9, 17),
    ) -> list[tuple[datetime, datetime]]:
        """Find available time slots.

        Args:
            time_min: Start of search range
            time_max: End of search range
            duration_minutes: Required duration of free slot
            calendar_ids: Calendar IDs to check
            work_hours: Tuple of (start_hour, end_hour) for valid slots

        Returns:
            List of (start, end) tuples for available slots
        """
        busy_periods = self.get_freebusy(time_min, time_max, calendar_ids)

        # Merge all busy periods
        all_busy: list[tuple[datetime, datetime]] = []
        for periods in busy_periods.values():
            for period in periods:
                start = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
                all_busy.append((start, end))

        # Sort by start time
        all_busy.sort(key=lambda x: x[0])

        # Merge overlapping periods
        merged_busy: list[tuple[datetime, datetime]] = []
        for start, end in all_busy:
            if merged_busy and start <= merged_busy[-1][1]:
                merged_busy[-1] = (merged_busy[-1][0], max(merged_busy[-1][1], end))
            else:
                merged_busy.append((start, end))

        # Find gaps
        free_slots: list[tuple[datetime, datetime]] = []
        current = time_min

        for busy_start, busy_end in merged_busy:
            if current < busy_start:
                gap_duration = (busy_start - current).total_seconds() / 60
                if gap_duration >= duration_minutes:
                    # Check if within work hours
                    if work_hours[0] <= current.hour < work_hours[1]:
                        free_slots.append((current, busy_start))
            current = max(current, busy_end)

        # Check final gap
        if current < time_max:
            gap_duration = (time_max - current).total_seconds() / 60
            if gap_duration >= duration_minutes:
                if work_hours[0] <= current.hour < work_hours[1]:
                    free_slots.append((current, time_max))

        return free_slots

    def search_events(
        self,
        query: str,
        calendar_id: str = "primary",
        time_min: datetime | None = None,
        time_max: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Search for events by text query.

        Args:
            query: Search query string
            calendar_id: Calendar ID or 'primary'
            time_min: Start of search range
            time_max: End of search range

        Returns:
            List of matching event dictionaries
        """
        params: dict[str, Any] = {
            "calendarId": calendar_id,
            "q": query,
            "singleEvents": True,
            "orderBy": "startTime",
        }

        if time_min:
            params["timeMin"] = time_min.isoformat() + "Z"
        if time_max:
            params["timeMax"] = time_max.isoformat() + "Z"

        result = self.service.events().list(**params).execute()
        return result.get("items", [])

    def get_lifeos_events(
        self,
        time_min: datetime | None = None,
        time_max: datetime | None = None,
        calendar_id: str = "primary",
    ) -> list[dict[str, Any]]:
        """Get events created by Life OS Agent.

        Args:
            time_min: Start of search range
            time_max: End of search range
            calendar_id: Calendar ID

        Returns:
            List of Life OS event dictionaries
        """
        events = self.list_events(
            calendar_id=calendar_id,
            time_min=time_min,
            time_max=time_max,
        )

        # Filter for Life OS events (have lifeos_generated property)
        return [
            e
            for e in events
            if e.get("extendedProperties", {})
            .get("private", {})
            .get("lifeos_generated") == "true"
        ]
