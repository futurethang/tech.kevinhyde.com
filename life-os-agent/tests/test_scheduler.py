"""Tests for scheduling logic."""

from datetime import datetime, timedelta

import pytest
from lifeos.config import Activity, LifeOSConfig
from lifeos.scheduler import Scheduler, TimeSlot


@pytest.fixture
def basic_config():
    """Create a basic configuration for testing."""
    return LifeOSConfig(
        activities=[
            Activity(
                id="exercise",
                name="Exercise",
                category="health",
                frequency=3,
                duration=45,
                time_preference="morning",
            ),
            Activity(
                id="reading",
                name="Reading",
                category="learning",
                frequency="daily",
                duration=30,
            ),
        ],
        priorities={
            "critical": ["exercise"],
            "high": [],
            "medium": ["reading"],
            "low": [],
        },
    )


@pytest.fixture
def scheduler(basic_config):
    """Create a scheduler instance."""
    return Scheduler(basic_config)


def test_time_slot_duration():
    """Test time slot duration calculation."""
    start = datetime(2026, 1, 20, 9, 0)
    end = datetime(2026, 1, 20, 10, 30)
    slot = TimeSlot(start=start, end=end)
    assert slot.duration_minutes == 90


def test_time_slot_overlaps():
    """Test time slot overlap detection."""
    slot1 = TimeSlot(
        start=datetime(2026, 1, 20, 9, 0),
        end=datetime(2026, 1, 20, 10, 0),
    )
    slot2 = TimeSlot(
        start=datetime(2026, 1, 20, 9, 30),
        end=datetime(2026, 1, 20, 10, 30),
    )
    slot3 = TimeSlot(
        start=datetime(2026, 1, 20, 10, 0),
        end=datetime(2026, 1, 20, 11, 0),
    )

    assert slot1.overlaps(slot2)  # Overlap
    assert not slot1.overlaps(slot3)  # Adjacent, no overlap


def test_get_week_bounds(scheduler):
    """Test week boundary calculation."""
    # Test with a Wednesday
    test_date = datetime(2026, 1, 22, 14, 30)  # Wednesday
    start, end = scheduler.get_week_bounds(test_date)

    assert start.weekday() == 0  # Monday
    assert start.hour == 0
    assert start.minute == 0
    assert (end - start).days == 7


def test_calculate_weekly_requirements(scheduler):
    """Test requirement calculation."""
    reqs = scheduler.calculate_weekly_requirements()

    assert "exercise" in reqs
    assert reqs["exercise"]["min_sessions"] == 3
    assert reqs["exercise"]["max_sessions"] == 3
    assert reqs["exercise"]["priority"] == "critical"

    assert "reading" in reqs
    assert reqs["reading"]["min_sessions"] == 7  # daily
    assert reqs["reading"]["priority"] == "medium"


def test_get_available_slots(scheduler):
    """Test finding available slots."""
    start = datetime(2026, 1, 20, 9, 0)
    end = datetime(2026, 1, 20, 17, 0)

    # Create some existing events
    events = [
        {
            "id": "1",
            "summary": "Meeting",
            "start": {"dateTime": "2026-01-20T10:00:00-08:00"},
            "end": {"dateTime": "2026-01-20T11:00:00-08:00"},
        },
        {
            "id": "2",
            "summary": "Lunch",
            "start": {"dateTime": "2026-01-20T12:00:00-08:00"},
            "end": {"dateTime": "2026-01-20T13:00:00-08:00"},
        },
    ]

    slots = scheduler.get_available_slots(events, start, end)

    # Should have gaps before meeting, between meeting and lunch, after lunch
    assert len(slots) >= 2


def test_filter_slots_by_time_preference(scheduler):
    """Test filtering slots by time of day."""
    slots = [
        TimeSlot(start=datetime(2026, 1, 20, 7, 0), end=datetime(2026, 1, 20, 8, 0)),  # Morning
        TimeSlot(start=datetime(2026, 1, 20, 14, 0), end=datetime(2026, 1, 20, 15, 0)),  # Afternoon
        TimeSlot(start=datetime(2026, 1, 20, 19, 0), end=datetime(2026, 1, 20, 20, 0)),  # Evening
    ]

    morning = scheduler.filter_slots_by_preference(slots, "morning")
    assert len(morning) == 1
    assert morning[0].start.hour == 7

    evening = scheduler.filter_slots_by_preference(slots, "evening")
    assert len(evening) == 1
    assert evening[0].start.hour == 19

    flexible = scheduler.filter_slots_by_preference(slots, "flexible")
    assert len(flexible) == 3


def test_filter_slots_by_day_preference(scheduler):
    """Test filtering slots by day of week."""
    slots = [
        TimeSlot(start=datetime(2026, 1, 20, 9, 0), end=datetime(2026, 1, 20, 10, 0)),  # Monday
        TimeSlot(start=datetime(2026, 1, 21, 9, 0), end=datetime(2026, 1, 21, 10, 0)),  # Tuesday
        TimeSlot(start=datetime(2026, 1, 22, 9, 0), end=datetime(2026, 1, 22, 10, 0)),  # Wednesday
    ]

    filtered = scheduler.filter_slots_by_preference(
        slots,
        time_preference=None,
        day_preference=["monday", "wednesday"],
    )
    assert len(filtered) == 2
