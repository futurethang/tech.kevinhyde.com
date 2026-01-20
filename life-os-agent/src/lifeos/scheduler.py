"""Scheduling logic for Life OS Agent."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from .config import Activity, LifeOSConfig


@dataclass
class TimeSlot:
    """Represents a time slot in the schedule."""

    start: datetime
    end: datetime
    is_available: bool = True
    event_id: str | None = None
    event_summary: str | None = None
    is_lifeos_event: bool = False
    activity_id: str | None = None

    @property
    def duration_minutes(self) -> int:
        """Get the duration in minutes."""
        return int((self.end - self.start).total_seconds() / 60)

    def overlaps(self, other: "TimeSlot") -> bool:
        """Check if this slot overlaps with another."""
        return self.start < other.end and other.start < self.end

    def contains(self, dt: datetime) -> bool:
        """Check if a datetime falls within this slot."""
        return self.start <= dt < self.end


@dataclass
class ScheduleProposal:
    """A proposed schedule block."""

    activity: Activity
    start: datetime
    end: datetime
    reasoning: str = ""
    conflicts_with: list[str] | None = None
    priority: str = "medium"

    def to_event_body(self, config: LifeOSConfig) -> dict[str, Any]:
        """Convert to Google Calendar event format."""
        prefix = config.event_format.prefix
        category_suffix = f" [{self.activity.category}]" if config.event_format.include_category else ""
        summary = f"{prefix}{self.activity.name}{category_suffix}".strip()

        description = f"Life OS scheduled activity\nCategory: {self.activity.category}\nActivity ID: {self.activity.id}"
        if self.activity.note:
            description += f"\n\nNote: {self.activity.note}"

        return {
            "summary": summary,
            "description": description,
            "start": self.start,
            "end": self.end,
            "location": self.activity.location,
            "extended_properties": {
                "private": {
                    "lifeos_activity_id": self.activity.id,
                    "lifeos_category": self.activity.category,
                    "lifeos_generated": "true",
                }
            },
        }


class Scheduler:
    """Handles scheduling logic for Life OS Agent."""

    # Color IDs for different categories
    CATEGORY_COLORS = {
        "health": "9",      # Blue
        "creative": "5",    # Yellow
        "learning": "7",    # Cyan
        "growth": "10",     # Green
        "home": "6",        # Orange
        "work": "8",        # Gray
    }

    def __init__(self, config: LifeOSConfig):
        """Initialize the scheduler.

        Args:
            config: Life OS configuration
        """
        self.config = config

    def get_week_bounds(self, start_date: datetime | None = None) -> tuple[datetime, datetime]:
        """Get the start and end of a week.

        Args:
            start_date: The date to start from (defaults to today)

        Returns:
            Tuple of (week_start, week_end) datetimes
        """
        if start_date is None:
            start_date = datetime.now()

        # Find Monday of this week
        days_since_monday = start_date.weekday()
        week_start = start_date - timedelta(days=days_since_monday)
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        # Sunday end of week
        week_end = week_start + timedelta(days=7)

        return week_start, week_end

    def parse_time_of_day(self, time_str: str) -> tuple[int, int]:
        """Parse a time string (HH:MM) to hours and minutes.

        Args:
            time_str: Time in HH:MM format

        Returns:
            Tuple of (hour, minute)
        """
        parts = time_str.split(":")
        return int(parts[0]), int(parts[1])

    def get_work_hours(self, date: datetime) -> tuple[datetime, datetime] | None:
        """Get work hours for a specific date.

        Args:
            date: The date to check

        Returns:
            Tuple of (start, end) datetimes, or None if not a work day
        """
        day_name = date.strftime("%A").lower()
        work = self.config.template.work

        if day_name not in work.days:
            return None

        start_h, start_m = self.parse_time_of_day(work.start)
        end_h, end_m = self.parse_time_of_day(work.end)

        work_start = date.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
        work_end = date.replace(hour=end_h, minute=end_m, second=0, microsecond=0)

        return work_start, work_end

    def get_available_slots(
        self,
        existing_events: list[dict[str, Any]],
        start_date: datetime,
        end_date: datetime,
        min_duration: int = 15,
    ) -> list[TimeSlot]:
        """Find available time slots in a date range.

        Args:
            existing_events: List of existing calendar events
            start_date: Start of the range
            end_date: End of the range
            min_duration: Minimum slot duration in minutes

        Returns:
            List of available TimeSlot objects
        """
        # Convert existing events to TimeSlot objects
        busy_slots: list[TimeSlot] = []
        for event in existing_events:
            start = event.get("start", {})
            end = event.get("end", {})

            if "dateTime" in start:
                event_start = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
                event_end = datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00"))

                # Check if this is a Life OS event
                ext_props = event.get("extendedProperties", {}).get("private", {})
                is_lifeos = ext_props.get("lifeos_generated") == "true"
                activity_id = ext_props.get("lifeos_activity_id")

                busy_slots.append(
                    TimeSlot(
                        start=event_start,
                        end=event_end,
                        is_available=False,
                        event_id=event.get("id"),
                        event_summary=event.get("summary"),
                        is_lifeos_event=is_lifeos,
                        activity_id=activity_id,
                    )
                )

        # Sort busy slots by start time
        busy_slots.sort(key=lambda s: s.start)

        # Find gaps
        available_slots: list[TimeSlot] = []
        current = start_date

        for busy in busy_slots:
            if current < busy.start:
                gap = TimeSlot(start=current, end=busy.start, is_available=True)
                if gap.duration_minutes >= min_duration:
                    available_slots.append(gap)
            current = max(current, busy.end)

        # Check final gap
        if current < end_date:
            gap = TimeSlot(start=current, end=end_date, is_available=True)
            if gap.duration_minutes >= min_duration:
                available_slots.append(gap)

        return available_slots

    def filter_slots_by_preference(
        self,
        slots: list[TimeSlot],
        time_preference: str | list[str] | None,
        day_preference: list[str] | None = None,
    ) -> list[TimeSlot]:
        """Filter slots by time of day and day preferences.

        Args:
            slots: Available slots to filter
            time_preference: Preferred time of day (morning, afternoon, evening, flexible)
            day_preference: Preferred days of the week

        Returns:
            Filtered list of slots
        """
        if time_preference is None and day_preference is None:
            return slots

        filtered: list[TimeSlot] = []

        for slot in slots:
            # Check day preference
            if day_preference:
                day_name = slot.start.strftime("%A").lower()
                if day_name not in day_preference:
                    continue

            # Check time preference
            if time_preference:
                prefs = [time_preference] if isinstance(time_preference, str) else time_preference
                hour = slot.start.hour

                matches_pref = False
                for pref in prefs:
                    if pref == "morning" and 5 <= hour < 12:
                        matches_pref = True
                    elif pref == "afternoon" and 12 <= hour < 17:
                        matches_pref = True
                    elif pref == "evening" and 17 <= hour < 22:
                        matches_pref = True
                    elif pref in ("flexible", "any"):
                        matches_pref = True

                if not matches_pref:
                    continue

            filtered.append(slot)

        return filtered

    def calculate_weekly_requirements(self) -> dict[str, dict[str, Any]]:
        """Calculate the time requirements for each activity.

        Returns:
            Dict mapping activity_id to requirements (sessions, duration, etc.)
        """
        requirements: dict[str, dict[str, Any]] = {}

        for activity in self.config.activities:
            min_freq, max_freq = activity.get_frequency_range()
            min_dur, max_dur = activity.get_duration_range()

            requirements[activity.id] = {
                "activity": activity,
                "min_sessions": min_freq,
                "max_sessions": max_freq,
                "min_duration": min_dur,
                "max_duration": max_dur,
                "total_min_minutes": min_freq * min_dur,
                "total_max_minutes": max_freq * max_dur,
                "priority": self.config.get_activity_priority(activity.id),
            }

        return requirements

    def analyze_scheduled_vs_required(
        self,
        existing_events: list[dict[str, Any]],
        week_start: datetime,
        week_end: datetime,
    ) -> dict[str, dict[str, Any]]:
        """Analyze what's scheduled vs. what's required.

        Args:
            existing_events: Existing calendar events
            week_start: Start of the week
            week_end: End of the week

        Returns:
            Dict with analysis for each activity
        """
        requirements = self.calculate_weekly_requirements()
        analysis: dict[str, dict[str, Any]] = {}

        for activity_id, req in requirements.items():
            scheduled_sessions = 0
            scheduled_minutes = 0

            for event in existing_events:
                ext_props = event.get("extendedProperties", {}).get("private", {})
                if ext_props.get("lifeos_activity_id") == activity_id:
                    scheduled_sessions += 1
                    start = datetime.fromisoformat(
                        event["start"]["dateTime"].replace("Z", "+00:00")
                    )
                    end = datetime.fromisoformat(
                        event["end"]["dateTime"].replace("Z", "+00:00")
                    )
                    scheduled_minutes += int((end - start).total_seconds() / 60)

            analysis[activity_id] = {
                "activity": req["activity"],
                "required_sessions": (req["min_sessions"], req["max_sessions"]),
                "required_minutes": (req["total_min_minutes"], req["total_max_minutes"]),
                "scheduled_sessions": scheduled_sessions,
                "scheduled_minutes": scheduled_minutes,
                "sessions_deficit": max(0, req["min_sessions"] - scheduled_sessions),
                "sessions_surplus": max(0, scheduled_sessions - req["max_sessions"]),
                "minutes_deficit": max(0, req["total_min_minutes"] - scheduled_minutes),
                "priority": req["priority"],
            }

        return analysis

    def propose_schedule(
        self,
        existing_events: list[dict[str, Any]],
        week_start: datetime | None = None,
    ) -> list[ScheduleProposal]:
        """Generate a proposed schedule to fill gaps.

        Args:
            existing_events: Existing calendar events
            week_start: Start of the week (defaults to current week)

        Returns:
            List of proposed schedule blocks
        """
        if week_start is None:
            week_start, week_end = self.get_week_bounds()
        else:
            week_end = week_start + timedelta(days=7)

        # Analyze current state
        analysis = self.analyze_scheduled_vs_required(existing_events, week_start, week_end)

        # Get available slots
        available = self.get_available_slots(existing_events, week_start, week_end)

        # Sort activities by priority and deficit
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        activities_to_schedule = sorted(
            [(aid, data) for aid, data in analysis.items() if data["sessions_deficit"] > 0],
            key=lambda x: (priority_order.get(x[1]["priority"], 2), -x[1]["sessions_deficit"]),
        )

        proposals: list[ScheduleProposal] = []

        for activity_id, data in activities_to_schedule:
            activity: Activity = data["activity"]
            needed_sessions = data["sessions_deficit"]
            min_dur, max_dur = activity.get_duration_range()

            # Filter slots by activity preferences
            preferred_slots = self.filter_slots_by_preference(
                available,
                activity.time_preference,
                activity.days_preference,
            )

            # Fall back to all available if no preferred slots
            if not preferred_slots:
                preferred_slots = available

            for slot in preferred_slots:
                if needed_sessions <= 0:
                    break

                if slot.duration_minutes >= min_dur:
                    # Use minimum duration or whatever fits
                    duration = min(min_dur, slot.duration_minutes)
                    end_time = slot.start + timedelta(minutes=duration)

                    proposal = ScheduleProposal(
                        activity=activity,
                        start=slot.start,
                        end=end_time,
                        reasoning=f"Filling deficit of {data['sessions_deficit']} sessions for {activity.name}",
                        priority=data["priority"],
                    )
                    proposals.append(proposal)

                    # Update slot (shrink it)
                    slot.start = end_time
                    needed_sessions -= 1

        return proposals

    def find_slot_for_activity(
        self,
        activity: Activity,
        existing_events: list[dict[str, Any]],
        target_date: datetime | None = None,
        search_days: int = 7,
    ) -> list[TimeSlot]:
        """Find suitable slots for a specific activity.

        Args:
            activity: The activity to schedule
            existing_events: Existing calendar events
            target_date: Preferred date (defaults to today)
            search_days: Number of days to search

        Returns:
            List of suitable time slots
        """
        if target_date is None:
            target_date = datetime.now()

        start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=search_days)

        # Get available slots
        available = self.get_available_slots(existing_events, start, end)

        # Filter by activity requirements
        min_dur, _ = activity.get_duration_range()
        suitable = [s for s in available if s.duration_minutes >= min_dur]

        # Apply preferences
        preferred = self.filter_slots_by_preference(
            suitable,
            activity.time_preference,
            activity.days_preference,
        )

        return preferred if preferred else suitable

    def get_day_schedule(
        self,
        events: list[dict[str, Any]],
        date: datetime,
    ) -> list[TimeSlot]:
        """Get a detailed schedule for a specific day.

        Args:
            events: Calendar events
            date: The date to analyze

        Returns:
            List of time slots for the day
        """
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Filter events to this day
        day_events = []
        for event in events:
            start = event.get("start", {})
            if "dateTime" in start:
                event_start = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
                if day_start <= event_start < day_end:
                    day_events.append(event)

        # Build schedule
        schedule: list[TimeSlot] = []
        current = day_start

        for event in sorted(day_events, key=lambda e: e["start"]["dateTime"]):
            event_start = datetime.fromisoformat(
                event["start"]["dateTime"].replace("Z", "+00:00")
            )
            event_end = datetime.fromisoformat(
                event["end"]["dateTime"].replace("Z", "+00:00")
            )

            # Add gap before this event
            if current < event_start:
                schedule.append(TimeSlot(start=current, end=event_start, is_available=True))

            # Add the event
            ext_props = event.get("extendedProperties", {}).get("private", {})
            schedule.append(
                TimeSlot(
                    start=event_start,
                    end=event_end,
                    is_available=False,
                    event_id=event.get("id"),
                    event_summary=event.get("summary"),
                    is_lifeos_event=ext_props.get("lifeos_generated") == "true",
                    activity_id=ext_props.get("lifeos_activity_id"),
                )
            )

            current = event_end

        # Add final gap
        if current < day_end:
            schedule.append(TimeSlot(start=current, end=day_end, is_available=True))

        return schedule
