"""Scheduling logic for Life OS Agent.

Handles finding available time slots, proposing schedules,
and analyzing scheduled vs. required time allocation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from typing import Any

from .config import (
    Activity,
    Commitment,
    DayOfWeek,
    LifeOSConfig,
    Priority,
    TimePreference,
)


@dataclass
class TimeSlot:
    """A time slot for scheduling."""

    start: datetime
    end: datetime
    day: DayOfWeek | None = None

    @property
    def duration_minutes(self) -> int:
        """Duration in minutes."""
        return int((self.end - self.start).total_seconds() / 60)

    def overlaps(self, other: "TimeSlot") -> bool:
        """Check if this slot overlaps with another."""
        return self.start < other.end and self.end > other.start

    def contains(self, dt: datetime) -> bool:
        """Check if datetime is within this slot."""
        return self.start <= dt < self.end


@dataclass
class ScheduledEvent:
    """An event on the calendar."""

    id: str
    title: str
    start: datetime
    end: datetime
    activity_id: str | None = None
    location: str | None = None
    description: str | None = None

    @property
    def time_slot(self) -> TimeSlot:
        """Get as TimeSlot."""
        return TimeSlot(start=self.start, end=self.end)

    @property
    def duration_minutes(self) -> int:
        """Duration in minutes."""
        return int((self.end - self.start).total_seconds() / 60)


@dataclass
class ProposedEvent:
    """A proposed event for scheduling."""

    activity: Activity
    slot: TimeSlot
    priority: Priority
    notes: str = ""


@dataclass
class ScheduleProposal:
    """A complete schedule proposal."""

    week_start: date
    proposed_events: list[ProposedEvent] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    coverage: dict[str, dict[str, int]] = field(default_factory=dict)


class Scheduler:
    """Scheduling intelligence for Life OS."""

    # Time preference ranges (24h format)
    TIME_RANGES = {
        TimePreference.MORNING: (time(6, 0), time(12, 0)),
        TimePreference.AFTERNOON: (time(12, 0), time(17, 0)),
        TimePreference.EVENING: (time(17, 0), time(22, 0)),
        TimePreference.FLEXIBLE: (time(6, 0), time(22, 0)),
    }

    def __init__(self, config: LifeOSConfig):
        """Initialize scheduler with configuration."""
        self.config = config

    def get_week_bounds(self, reference_date: date | None = None) -> tuple[date, date]:
        """Get Monday-Sunday bounds for a week.

        Args:
            reference_date: Any date in the week. Uses today if None.

        Returns:
            Tuple of (monday, sunday)
        """
        if reference_date is None:
            reference_date = date.today()

        # Find Monday (weekday 0)
        days_since_monday = reference_date.weekday()
        monday = reference_date - timedelta(days=days_since_monday)
        sunday = monday + timedelta(days=6)

        return monday, sunday

    def calculate_weekly_requirements(self) -> dict[str, dict[str, Any]]:
        """Calculate weekly time requirements for all activities.

        Returns:
            Dict mapping activity_id to requirements:
            {
                "chess": {
                    "activity": Activity,
                    "target_sessions": 7,
                    "min_minutes": 210,
                    "max_minutes": 210,
                    "priority": Priority.HIGH
                }
            }
        """
        requirements = {}

        for activity in self.config.activities:
            target = activity.weekly_target
            requirements[activity.id] = {
                "activity": activity,
                "target_sessions": target,
                "min_minutes": target * activity.min_duration,
                "max_minutes": target * activity.max_duration,
                "priority": self.config.priorities.get_priority(activity.id),
            }

        return requirements

    def get_available_slots(
        self,
        week_start: date,
        existing_events: list[ScheduledEvent],
        slot_duration: int = 30,
    ) -> list[TimeSlot]:
        """Find available time slots in a week.

        Args:
            week_start: Monday of the week
            existing_events: Already scheduled events
            slot_duration: Minimum slot duration in minutes

        Returns:
            List of available TimeSlots
        """
        available = []

        for day_offset in range(7):
            current_date = week_start + timedelta(days=day_offset)
            day = DayOfWeek(current_date.strftime("%A").lower())

            # Get day boundaries from config
            day_start = datetime.combine(current_date, time(6, 0))
            day_end = datetime.combine(current_date, time(22, 0))

            # Adjust for work hours if applicable
            if self.config.template and self.config.template.work:
                if day in self.config.template.work.days:
                    work_start = datetime.combine(
                        current_date, self.config.template.work.start_time
                    )
                    work_end = datetime.combine(
                        current_date, self.config.template.work.end_time
                    )
                    # Mark work time as unavailable
                    existing_events.append(
                        ScheduledEvent(
                            id=f"work_{current_date}",
                            title="Work",
                            start=work_start,
                            end=work_end,
                        )
                    )

            # Get commitments for this day
            for commitment in self.config.commitments:
                if commitment.day == day:
                    existing_events.append(
                        ScheduledEvent(
                            id=f"commitment_{commitment.name}_{current_date}",
                            title=commitment.name,
                            start=datetime.combine(current_date, commitment.start_time),
                            end=datetime.combine(current_date, commitment.end_time),
                        )
                    )

            # Sort events by start time
            day_events = [
                e for e in existing_events
                if e.start.date() == current_date
            ]
            day_events.sort(key=lambda e: e.start)

            # Find gaps
            current_time = day_start

            for event in day_events:
                if event.start > current_time:
                    gap = TimeSlot(
                        start=current_time,
                        end=event.start,
                        day=day,
                    )
                    if gap.duration_minutes >= slot_duration:
                        available.append(gap)
                current_time = max(current_time, event.end)

            # Check remaining time until day end
            if current_time < day_end:
                gap = TimeSlot(
                    start=current_time,
                    end=day_end,
                    day=day,
                )
                if gap.duration_minutes >= slot_duration:
                    available.append(gap)

        return available

    def filter_slots_by_preference(
        self,
        slots: list[TimeSlot],
        activity: Activity,
    ) -> list[TimeSlot]:
        """Filter time slots by activity preferences.

        Args:
            slots: Available slots
            activity: Activity with preferences

        Returns:
            Filtered and sorted slots (preferred first)
        """
        preferred = []
        other = []

        pref_start, pref_end = self.TIME_RANGES[activity.time_preference]

        for slot in slots:
            slot_time = slot.start.time()

            # Check day preference
            if activity.days_preference:
                if slot.day not in activity.days_preference:
                    continue

            # Check time preference
            if pref_start <= slot_time < pref_end:
                preferred.append(slot)
            elif activity.time_preference == TimePreference.FLEXIBLE:
                preferred.append(slot)
            else:
                other.append(slot)

        return preferred + other

    def analyze_scheduled_vs_required(
        self,
        scheduled_events: list[ScheduledEvent],
        week_start: date,
    ) -> dict[str, dict[str, Any]]:
        """Compare scheduled events against requirements.

        Args:
            scheduled_events: Events on the calendar
            week_start: Monday of the week

        Returns:
            Analysis dict with scheduled vs. target for each activity
        """
        requirements = self.calculate_weekly_requirements()
        week_end = week_start + timedelta(days=6)

        # Count scheduled sessions by activity
        scheduled_counts: dict[str, int] = {}
        scheduled_minutes: dict[str, int] = {}

        for event in scheduled_events:
            if event.start.date() < week_start or event.start.date() > week_end:
                continue

            activity_id = event.activity_id
            if not activity_id:
                # Try to match by title
                for activity in self.config.activities:
                    if activity.name.lower() in event.title.lower():
                        activity_id = activity.id
                        break

            if activity_id:
                scheduled_counts[activity_id] = scheduled_counts.get(activity_id, 0) + 1
                scheduled_minutes[activity_id] = (
                    scheduled_minutes.get(activity_id, 0) + event.duration_minutes
                )

        # Build analysis
        analysis = {}
        for activity_id, req in requirements.items():
            scheduled = scheduled_counts.get(activity_id, 0)
            target = req["target_sessions"]
            minutes = scheduled_minutes.get(activity_id, 0)

            analysis[activity_id] = {
                "activity_name": req["activity"].name,
                "target_sessions": target,
                "scheduled_sessions": scheduled,
                "gap_sessions": max(0, target - scheduled),
                "target_minutes": req["min_minutes"],
                "scheduled_minutes": minutes,
                "priority": req["priority"],
                "on_track": scheduled >= target,
            }

        return analysis

    def propose_schedule(
        self,
        week_start: date,
        existing_events: list[ScheduledEvent],
    ) -> ScheduleProposal:
        """Generate a schedule proposal for the week.

        Args:
            week_start: Monday of the week
            existing_events: Already scheduled events

        Returns:
            ScheduleProposal with proposed events
        """
        proposal = ScheduleProposal(week_start=week_start)

        # Get requirements and available slots
        requirements = self.calculate_weekly_requirements()
        available = self.get_available_slots(week_start, existing_events.copy())

        # Sort activities by priority
        priority_order = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]
        sorted_activities = sorted(
            self.config.activities,
            key=lambda a: priority_order.index(
                self.config.priorities.get_priority(a.id)
            ),
        )

        # Current scheduled counts per activity
        scheduled_counts: dict[str, int] = {}

        # Analyze existing coverage
        analysis = self.analyze_scheduled_vs_required(existing_events, week_start)

        for activity_id, info in analysis.items():
            scheduled_counts[activity_id] = info["scheduled_sessions"]

        # Try to fill gaps
        for activity in sorted_activities:
            req = requirements[activity.id]
            current = scheduled_counts.get(activity.id, 0)
            needed = req["target_sessions"] - current

            if needed <= 0:
                continue

            # Filter slots by preference
            preferred_slots = self.filter_slots_by_preference(available, activity)

            for slot in preferred_slots:
                if needed <= 0:
                    break

                # Check if slot is long enough
                if slot.duration_minutes < activity.min_duration:
                    continue

                # Create proposed event
                event_end = slot.start + timedelta(minutes=activity.min_duration)
                if event_end > slot.end:
                    continue

                proposed = ProposedEvent(
                    activity=activity,
                    slot=TimeSlot(start=slot.start, end=event_end, day=slot.day),
                    priority=self.config.priorities.get_priority(activity.id),
                )
                proposal.proposed_events.append(proposed)

                # Update available slots (remove used time)
                available = self._split_slot(available, slot, proposed.slot)

                scheduled_counts[activity.id] = scheduled_counts.get(activity.id, 0) + 1
                needed -= 1

        # Calculate final coverage
        for activity_id, req in requirements.items():
            scheduled = scheduled_counts.get(activity_id, 0)
            proposal.coverage[activity_id] = {
                "scheduled": scheduled,
                "target": req["target_sessions"],
                "covered": scheduled >= req["target_sessions"],
            }

        return proposal

    def _split_slot(
        self,
        slots: list[TimeSlot],
        original: TimeSlot,
        used: TimeSlot,
    ) -> list[TimeSlot]:
        """Remove used time from available slots.

        Args:
            slots: Current available slots
            original: The slot that was partially used
            used: The portion that was used

        Returns:
            Updated list of available slots
        """
        result = []

        for slot in slots:
            if slot.start == original.start and slot.end == original.end:
                # This is the slot we're modifying
                # Add remaining time before
                if used.start > slot.start:
                    result.append(
                        TimeSlot(start=slot.start, end=used.start, day=slot.day)
                    )
                # Add remaining time after
                if used.end < slot.end:
                    result.append(
                        TimeSlot(start=used.end, end=slot.end, day=slot.day)
                    )
            else:
                result.append(slot)

        return result

    def format_proposal(self, proposal: ScheduleProposal) -> str:
        """Format a schedule proposal as readable text.

        Args:
            proposal: The schedule proposal

        Returns:
            Formatted string
        """
        lines = [
            f"**Schedule Proposal for week of {proposal.week_start.strftime('%B %d, %Y')}**",
            "",
        ]

        # Group by day
        by_day: dict[str, list[ProposedEvent]] = {}
        for event in proposal.proposed_events:
            day_name = event.slot.start.strftime("%A")
            if day_name not in by_day:
                by_day[day_name] = []
            by_day[day_name].append(event)

        day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        for day in day_order:
            if day not in by_day:
                continue

            lines.append(f"**{day}:**")
            day_events = sorted(by_day[day], key=lambda e: e.slot.start)

            for event in day_events:
                time_str = event.slot.start.strftime("%-I:%M %p")
                end_str = event.slot.end.strftime("%-I:%M %p")
                lines.append(f"  - {time_str}-{end_str}: {event.activity.name}")

            lines.append("")

        # Coverage summary
        lines.append("**Coverage:**")
        for activity_id, coverage in proposal.coverage.items():
            activity = self.config.get_activity_by_id(activity_id)
            name = activity.name if activity else activity_id
            status = "✓" if coverage["covered"] else "✗"
            lines.append(
                f"  {status} {name}: {coverage['scheduled']}/{coverage['target']} sessions"
            )

        return "\n".join(lines)
