"""Configuration loading and validation for Life OS Agent."""

from __future__ import annotations

import os
from datetime import time
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


class TimeBlock(BaseModel):
    """Represents a time block with start and optional end/duration."""

    start: str
    end: str | None = None
    duration: int | None = None  # minutes

    @field_validator("start", "end", mode="before")
    @classmethod
    def validate_time_format(cls, v: Any) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            # Validate HH:MM format
            try:
                parts = v.split(":")
                hour, minute = int(parts[0]), int(parts[1])
                if 0 <= hour <= 23 and 0 <= minute <= 59:
                    return v
            except (ValueError, IndexError):
                pass
            raise ValueError(f"Invalid time format: {v}. Expected HH:MM")
        return str(v)


class WorkTemplate(BaseModel):
    """Work schedule template."""

    days: list[str] = Field(default_factory=lambda: ["monday", "tuesday", "wednesday", "thursday", "friday"])
    start: str = "09:00"
    end: str = "17:00"
    lunch: TimeBlock | None = None


class SleepTemplate(BaseModel):
    """Sleep schedule template."""

    target_bedtime: str = "23:00"
    target_wake: str = "06:30"
    wind_down: int = 15  # minutes


class OfficeDays(BaseModel):
    """Office/in-person work days configuration."""

    days: list[str] = Field(default_factory=list)
    location: str = ""
    commute_minutes: int = 0


class Template(BaseModel):
    """Weekly template configuration."""

    work: WorkTemplate = Field(default_factory=WorkTemplate)
    sleep: SleepTemplate = Field(default_factory=SleepTemplate)
    office_days: OfficeDays | None = None


class Commitment(BaseModel):
    """A fixed, recurring commitment."""

    name: str
    day: str | None = None
    days: list[str] | None = None
    start: str
    end: str | None = None
    duration: int | None = None  # minutes
    location: str | None = None
    travel_time: int | None = None
    note: str | None = None


class SubInterest(BaseModel):
    """A sub-interest within an activity category."""

    name: str
    current_priority: str = "medium"  # high, medium, low


class Activity(BaseModel):
    """An activity that should be scheduled."""

    id: str
    name: str
    category: str
    frequency: str | int  # e.g., "daily", "weekly", 3, "3-4"
    duration: str | int  # minutes or range like "90-180"
    location: str | None = None
    days_preference: list[str] | None = None
    time_preference: str | list[str] | None = None
    note: str | None = None
    sub_interests: list[SubInterest] | None = None

    def get_duration_range(self) -> tuple[int, int]:
        """Return (min_duration, max_duration) in minutes."""
        if isinstance(self.duration, int):
            return (self.duration, self.duration)
        if isinstance(self.duration, str) and "-" in self.duration:
            parts = self.duration.split("-")
            return (int(parts[0]), int(parts[1]))
        return (int(self.duration), int(self.duration))

    def get_frequency_range(self) -> tuple[int, int]:
        """Return (min_frequency, max_frequency) per week."""
        if isinstance(self.frequency, int):
            return (self.frequency, self.frequency)
        if isinstance(self.frequency, str):
            if self.frequency == "daily":
                return (7, 7)
            if self.frequency == "weekly":
                return (1, 1)
            if "-" in self.frequency:
                parts = self.frequency.split("-")
                return (int(parts[0]), int(parts[1]))
            return (int(self.frequency), int(self.frequency))
        return (1, 1)


class Priorities(BaseModel):
    """Priority tiers for activities."""

    critical: list[str] = Field(default_factory=list)
    high: list[str] = Field(default_factory=list)
    medium: list[str] = Field(default_factory=list)
    low: list[str] = Field(default_factory=list)


class Calendars(BaseModel):
    """Calendar identifiers."""

    primary: str
    shared: str | None = None
    studio: str | None = None


class EventFormat(BaseModel):
    """Event naming conventions."""

    prefix: str = ""
    include_category: bool = False


class Meta(BaseModel):
    """Configuration metadata."""

    version: str = "1.0"
    user: str = ""
    timezone: str = "America/Los_Angeles"


class LifeOSConfig(BaseModel):
    """Complete Life OS configuration."""

    meta: Meta = Field(default_factory=Meta)
    template: Template = Field(default_factory=Template)
    commitments: list[Commitment] = Field(default_factory=list)
    activities: list[Activity] = Field(default_factory=list)
    priorities: Priorities = Field(default_factory=Priorities)
    calendars: Calendars | None = None
    event_format: EventFormat = Field(default_factory=EventFormat)

    def get_activity_by_id(self, activity_id: str) -> Activity | None:
        """Find an activity by its ID."""
        for activity in self.activities:
            if activity.id == activity_id:
                return activity
        return None

    def get_activities_by_category(self, category: str) -> list[Activity]:
        """Get all activities in a category."""
        return [a for a in self.activities if a.category == category]

    def get_activity_priority(self, activity_id: str) -> str:
        """Get the priority tier for an activity."""
        if activity_id in self.priorities.critical:
            return "critical"
        if activity_id in self.priorities.high:
            return "high"
        if activity_id in self.priorities.medium:
            return "medium"
        if activity_id in self.priorities.low:
            return "low"
        return "medium"  # default


def load_config(path: str | Path | None = None) -> LifeOSConfig:
    """Load and validate the Life OS configuration from a YAML file."""
    if path is None:
        path = os.environ.get("LIFEOS_CONFIG_PATH", "config/life-os-config.yaml")

    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Configuration file not found: {path}")

    with open(path) as f:
        raw_config = yaml.safe_load(f)

    return LifeOSConfig.model_validate(raw_config)


def save_config(config: LifeOSConfig, path: str | Path | None = None) -> None:
    """Save the Life OS configuration to a YAML file."""
    if path is None:
        path = os.environ.get("LIFEOS_CONFIG_PATH", "config/life-os-config.yaml")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:
        yaml.dump(config.model_dump(exclude_none=True), f, default_flow_style=False, sort_keys=False)
