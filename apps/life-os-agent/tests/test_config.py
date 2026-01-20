"""Tests for configuration module."""

import pytest
from pathlib import Path

from lifeos.config import (
    load_config,
    LifeOSConfig,
    Activity,
    DayOfWeek,
    TimePreference,
    ActivityCategory,
    Priority,
)


# Sample config for testing
SAMPLE_CONFIG = """
meta:
  user: "Test User"
  timezone: "America/Los_Angeles"

activities:
  - id: chess
    name: "Chess Practice"
    category: learning
    frequency: daily
    duration: 30
    time_preference: morning

  - id: studio
    name: "Studio Session"
    category: creative
    frequency: 2
    duration: 120
    time_preference: afternoon
    days_preference: [tuesday, saturday]

priorities:
  critical: []
  high: [studio]
  medium: [chess]
  low: []

calendars:
  primary: "test@example.com"
"""


@pytest.fixture
def sample_config_file(tmp_path):
    """Create a temporary config file."""
    config_file = tmp_path / "test-config.yaml"
    config_file.write_text(SAMPLE_CONFIG)
    return config_file


def test_load_config(sample_config_file):
    """Test loading configuration from YAML."""
    config = load_config(sample_config_file)

    assert config.meta.user == "Test User"
    assert config.meta.timezone == "America/Los_Angeles"
    assert len(config.activities) == 2


def test_activity_properties():
    """Test Activity model properties."""
    activity = Activity(
        id="test",
        name="Test Activity",
        category=ActivityCategory.LEARNING,
        frequency="3-4",
        duration="30-45",
        time_preference=TimePreference.MORNING,
    )

    assert activity.min_duration == 30
    assert activity.max_duration == 45
    assert activity.weekly_target == 3


def test_activity_daily():
    """Test daily activity target."""
    activity = Activity(
        id="test",
        name="Daily Test",
        category=ActivityCategory.HEALTH,
        frequency="daily",
        duration=30,
    )

    assert activity.weekly_target == 7
    assert activity.is_daily is True


def test_get_activity_by_id(sample_config_file):
    """Test finding activity by ID."""
    config = load_config(sample_config_file)

    chess = config.get_activity_by_id("chess")
    assert chess is not None
    assert chess.name == "Chess Practice"

    missing = config.get_activity_by_id("nonexistent")
    assert missing is None


def test_get_activities_by_category(sample_config_file):
    """Test filtering activities by category."""
    config = load_config(sample_config_file)

    learning = config.get_activities_by_category(ActivityCategory.LEARNING)
    assert len(learning) == 1
    assert learning[0].id == "chess"

    creative = config.get_activities_by_category(ActivityCategory.CREATIVE)
    assert len(creative) == 1
    assert creative[0].id == "studio"


def test_priorities(sample_config_file):
    """Test priority lookups."""
    config = load_config(sample_config_file)

    assert config.priorities.get_priority("studio") == Priority.HIGH
    assert config.priorities.get_priority("chess") == Priority.MEDIUM
    assert config.priorities.get_priority("unknown") == Priority.MEDIUM  # Default


def test_config_yaml_summary(sample_config_file):
    """Test YAML summary generation."""
    config = load_config(sample_config_file)
    summary = config.to_yaml_summary()

    assert "Test User" in summary
    assert "Chess Practice" in summary
    assert "Studio Session" in summary
