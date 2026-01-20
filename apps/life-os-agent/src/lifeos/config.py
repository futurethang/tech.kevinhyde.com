"""Configuration management for Life OS Agent.

Handles loading and validating the life configuration from YAML.
"""

from __future__ import annotations

import os
from datetime import time
from enum import Enum
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DayOfWeek(str, Enum):
    """Days of the week."""

    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class TimePreference(str, Enum):
    """Time of day preferences for activities."""

    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    FLEXIBLE = "flexible"


class ActivityCategory(str, Enum):
    """Categories for activities."""

    HEALTH = "health"
    LEARNING = "learning"
    CREATIVE = "creative"
    WORK = "work"
    LIFE = "life"
    SOCIAL = "social"


class Priority(str, Enum):
    """Priority levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Meta(BaseModel):
    """User metadata."""

    user: str
    timezone: str = "America/Los_Angeles"


class WorkTemplate(BaseModel):
    """Work schedule template."""

    days: list[DayOfWeek]
    start: str  # HH:MM format
    end: str

    @property
    def start_time(self) -> time:
        """Parse start time."""
        h, m = map(int, self.start.split(":"))
        return time(h, m)

    @property
    def end_time(self) -> time:
        """Parse end time."""
        h, m = map(int, self.end.split(":"))
        return time(h, m)


class OfficeDaysTemplate(BaseModel):
    """Office/commute schedule."""

    days: list[DayOfWeek]
    location: str | None = None
    commute_minutes: int = 0


class Template(BaseModel):
    """Schedule templates."""

    work: WorkTemplate | None = None
    office_days: OfficeDaysTemplate | None = None


class Commitment(BaseModel):
    """Non-negotiable recurring event."""

    name: str
    day: DayOfWeek
    start: str  # HH:MM format
    end: str

    @property
    def start_time(self) -> time:
        """Parse start time."""
        h, m = map(int, self.start.split(":"))
        return time(h, m)

    @property
    def end_time(self) -> time:
        """Parse end time."""
        h, m = map(int, self.end.split(":"))
        return time(h, m)


class Activity(BaseModel):
    """An activity to schedule."""

    id: str
    name: str
    category: ActivityCategory
    frequency: str | int  # "daily", "weekly", 3, "3-4"
    duration: int | str  # minutes or "30-45"
    time_preference: TimePreference = TimePreference.FLEXIBLE
    days_preference: list[DayOfWeek] | None = None
    location: str | None = None

    @property
    def min_duration(self) -> int:
        """Get minimum duration in minutes."""
        if isinstance(self.duration, int):
            return self.duration
        if isinstance(self.duration, str) and "-" in self.duration:
            return int(self.duration.split("-")[0])
        return int(self.duration)

    @property
    def max_duration(self) -> int:
        """Get maximum duration in minutes."""
        if isinstance(self.duration, int):
            return self.duration
        if isinstance(self.duration, str) and "-" in self.duration:
            return int(self.duration.split("-")[1])
        return int(self.duration)

    @property
    def weekly_target(self) -> int:
        """Get weekly target count."""
        if self.frequency == "daily":
            return 7
        if self.frequency == "weekly":
            return 1
        if isinstance(self.frequency, int):
            return self.frequency
        if isinstance(self.frequency, str) and "-" in self.frequency:
            # Return the lower bound for planning
            return int(self.frequency.split("-")[0])
        return int(self.frequency)

    @property
    def is_daily(self) -> bool:
        """Check if activity is daily."""
        return self.frequency == "daily"


class Priorities(BaseModel):
    """Priority rankings for activities."""

    critical: list[str] = Field(default_factory=list)
    high: list[str] = Field(default_factory=list)
    medium: list[str] = Field(default_factory=list)
    low: list[str] = Field(default_factory=list)

    def get_priority(self, activity_id: str) -> Priority:
        """Get priority level for an activity."""
        if activity_id in self.critical:
            return Priority.CRITICAL
        if activity_id in self.high:
            return Priority.HIGH
        if activity_id in self.medium:
            return Priority.MEDIUM
        if activity_id in self.low:
            return Priority.LOW
        return Priority.MEDIUM  # Default


class Calendars(BaseModel):
    """Calendar configuration."""

    primary: str
    work: str | None = None
    personal: str | None = None


class LifeOSConfig(BaseModel):
    """Complete life configuration."""

    meta: Meta
    template: Template | None = None
    commitments: list[Commitment] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)
    priorities: Priorities = Field(default_factory=Priorities)
    calendars: Calendars | None = None

    def get_activity_by_id(self, activity_id: str) -> Activity | None:
        """Find an activity by ID."""
        for activity in self.activities:
            if activity.id == activity_id:
                return activity
        return None

    def get_activities_by_category(self, category: ActivityCategory) -> list[Activity]:
        """Get all activities in a category."""
        return [a for a in self.activities if a.category == category]

    def get_activities_by_priority(self, priority: Priority) -> list[Activity]:
        """Get all activities at a priority level."""
        activity_ids = getattr(self.priorities, priority.value, [])
        return [a for a in self.activities if a.id in activity_ids]

    def to_yaml_summary(self) -> str:
        """Generate a YAML summary for the system prompt."""
        lines = [
            f"user: {self.meta.user}",
            f"timezone: {self.meta.timezone}",
            "",
            "activities:",
        ]

        for activity in self.activities:
            priority = self.priorities.get_priority(activity.id)
            lines.append(
                f"  - {activity.name} ({activity.id}): "
                f"{activity.frequency}/week, {activity.duration}min, "
                f"priority={priority.value}"
            )

        lines.append("")
        lines.append("commitments:")
        for commitment in self.commitments:
            lines.append(f"  - {commitment.name}: {commitment.day.value} {commitment.start}-{commitment.end}")

        return "\n".join(lines)


def load_config(path: str | Path | None = None) -> LifeOSConfig:
    """Load configuration from YAML file.

    Args:
        path: Path to YAML file. If None, uses LIFEOS_CONFIG_PATH env var
              or defaults to config/life-os-config.yaml

    Returns:
        Parsed LifeOSConfig
    """
    if path is None:
        path = os.getenv("LIFEOS_CONFIG_PATH", "config/life-os-config.yaml")

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Configuration file not found: {path}")

    with open(path) as f:
        data = yaml.safe_load(f)

    return LifeOSConfig.model_validate(data)


class Settings(BaseSettings):
    """Application settings from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Keys
    anthropic_api_key: str = ""
    telegram_bot_token: str = ""
    mem0_api_key: str = ""

    # Google Calendar
    google_credentials_file: str = "credentials.json"
    google_credentials_b64: str = ""
    google_token_file: str = "token.json"

    # Application settings
    lifeos_user_id: str = "default"
    lifeos_config_path: str = "config/life-os-config.yaml"
    lifeos_model: str = "claude-sonnet-4-20250514"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8080
    log_level: str = "INFO"

    # Telegram webhook (for production)
    telegram_webhook_url: str = ""


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()
