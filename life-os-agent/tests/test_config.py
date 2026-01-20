"""Tests for configuration parsing."""

import pytest
from lifeos.config import (
    Activity,
    LifeOSConfig,
    load_config,
)


def test_activity_duration_range_single():
    """Test parsing single duration value."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency=1,
        duration=45,
    )
    assert activity.get_duration_range() == (45, 45)


def test_activity_duration_range_string():
    """Test parsing duration range string."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency=1,
        duration="90-180",
    )
    assert activity.get_duration_range() == (90, 180)


def test_activity_frequency_range_int():
    """Test parsing integer frequency."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency=3,
        duration=45,
    )
    assert activity.get_frequency_range() == (3, 3)


def test_activity_frequency_range_daily():
    """Test parsing 'daily' frequency."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency="daily",
        duration=45,
    )
    assert activity.get_frequency_range() == (7, 7)


def test_activity_frequency_range_weekly():
    """Test parsing 'weekly' frequency."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency="weekly",
        duration=45,
    )
    assert activity.get_frequency_range() == (1, 1)


def test_activity_frequency_range_string():
    """Test parsing frequency range string."""
    activity = Activity(
        id="test",
        name="Test",
        category="test",
        frequency="3-4",
        duration=45,
    )
    assert activity.get_frequency_range() == (3, 4)


def test_config_get_activity_priority():
    """Test getting activity priority from config."""
    config = LifeOSConfig(
        activities=[
            Activity(id="a1", name="A1", category="test", frequency=1, duration=30),
            Activity(id="a2", name="A2", category="test", frequency=1, duration=30),
            Activity(id="a3", name="A3", category="test", frequency=1, duration=30),
        ],
        priorities={
            "critical": ["a1"],
            "high": ["a2"],
            "medium": [],
            "low": [],
        },
    )

    assert config.get_activity_priority("a1") == "critical"
    assert config.get_activity_priority("a2") == "high"
    assert config.get_activity_priority("a3") == "medium"  # default


def test_config_get_activity_by_id():
    """Test finding activity by ID."""
    config = LifeOSConfig(
        activities=[
            Activity(id="exercise", name="Exercise", category="health", frequency=3, duration=45),
            Activity(id="reading", name="Reading", category="learning", frequency="daily", duration=30),
        ]
    )

    activity = config.get_activity_by_id("exercise")
    assert activity is not None
    assert activity.name == "Exercise"

    missing = config.get_activity_by_id("nonexistent")
    assert missing is None


def test_config_get_activities_by_category():
    """Test filtering activities by category."""
    config = LifeOSConfig(
        activities=[
            Activity(id="a1", name="A1", category="health", frequency=1, duration=30),
            Activity(id="a2", name="A2", category="health", frequency=1, duration=30),
            Activity(id="a3", name="A3", category="learning", frequency=1, duration=30),
        ]
    )

    health = config.get_activities_by_category("health")
    assert len(health) == 2
    assert all(a.category == "health" for a in health)
