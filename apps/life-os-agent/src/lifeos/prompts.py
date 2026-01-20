"""System prompts for Life OS Agent.

Contains the "job description" prompts that define agent behavior.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from .config import LifeOSConfig


SYSTEM_PROMPT_TEMPLATE = """# Life OS Agent - Operating Instructions

You are a scheduling assistant for {user_name}. Your job is to help manage
time allocation across work, health, creative pursuits, and personal interests.

## Your Responsibilities

1. **Know the schedule**: Always check the calendar before answering questions
   about availability or commitments. Use the list_events tool.

2. **Execute requests**: When asked to schedule something, do it. Confirm
   what you've done with specifics (day, time, duration).

3. **Apply the configuration**: Use the activity definitions, priorities,
   and constraints provided. These are the user's stated requirements.

4. **Surface relevant information**: If a request conflicts with existing
   events or stated priorities, mention it factually:
   - "This overlaps with [existing event]"
   - "This would be your only [activity] slot this week"
   - "Your config shows [activity] as [priority] priority"

5. **Ask when unclear**: If a request is ambiguous, ask for clarification
   rather than guessing.

6. **Remember context**: Store decisions and stated preferences using the
   memory tools. This is institutional knowledge for future reference.

## What You Don't Do

- Don't invent preferences not stated in config or past conversations
- Don't editorialize beyond what's helpful for the task
- Don't assume you know better than the user
- Don't add friction to simple requests
- Don't apologize excessively or add unnecessary caveats

## Response Style

- Be concise and direct
- Lead with the answer, then details if needed
- Use clear time formats: "Tuesday 2:00-3:30 PM"
- When proposing schedules, use a clear list format
- Confirm actions taken: "Done. Created [event] for [time]."

## Current Configuration

```yaml
{config_yaml}
```

## Today's Context

- Current date/time: {current_datetime}
- Day of week: {day_of_week}
- Timezone: {timezone}
"""


def build_system_prompt(config: LifeOSConfig) -> str:
    """Build the system prompt with current context.

    Args:
        config: Life OS configuration

    Returns:
        Formatted system prompt
    """
    tz = ZoneInfo(config.meta.timezone)
    now = datetime.now(tz)

    return SYSTEM_PROMPT_TEMPLATE.format(
        user_name=config.meta.user,
        config_yaml=config.to_yaml_summary(),
        current_datetime=now.strftime("%Y-%m-%d %I:%M %p"),
        day_of_week=now.strftime("%A"),
        timezone=config.meta.timezone,
    )


# Tool descriptions for Claude
TOOL_DESCRIPTIONS = {
    "list_events": {
        "description": "Get calendar events for a date range. Use this to check what's scheduled.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format. Defaults to today.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format. Defaults to 7 days from start.",
                },
            },
            "required": [],
        },
    },
    "create_event": {
        "description": "Create a new calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Event title/name",
                },
                "start": {
                    "type": "string",
                    "description": "Start datetime in ISO format (YYYY-MM-DDTHH:MM:SS)",
                },
                "end": {
                    "type": "string",
                    "description": "End datetime in ISO format",
                },
                "activity_id": {
                    "type": "string",
                    "description": "Life OS activity ID (e.g., 'chess', 'studio_session')",
                },
                "location": {
                    "type": "string",
                    "description": "Event location (optional)",
                },
            },
            "required": ["title", "start", "end"],
        },
    },
    "update_event": {
        "description": "Update an existing calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "string",
                    "description": "ID of the event to update",
                },
                "title": {
                    "type": "string",
                    "description": "New title (optional)",
                },
                "start": {
                    "type": "string",
                    "description": "New start datetime in ISO format (optional)",
                },
                "end": {
                    "type": "string",
                    "description": "New end datetime in ISO format (optional)",
                },
                "location": {
                    "type": "string",
                    "description": "New location (optional)",
                },
            },
            "required": ["event_id"],
        },
    },
    "delete_event": {
        "description": "Delete a calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "string",
                    "description": "ID of the event to delete",
                },
            },
            "required": ["event_id"],
        },
    },
    "find_free_time": {
        "description": "Find available time slots on a specific date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to check in YYYY-MM-DD format",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Required duration in minutes",
                },
            },
            "required": ["date", "duration_minutes"],
        },
    },
    "propose_schedule": {
        "description": "Generate a schedule proposal for the week based on activity requirements.",
        "input_schema": {
            "type": "object",
            "properties": {
                "week_start": {
                    "type": "string",
                    "description": "Monday of the week in YYYY-MM-DD format. Defaults to current week.",
                },
            },
            "required": [],
        },
    },
    "analyze_week": {
        "description": "Compare scheduled events against required time allocation for each activity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "week_start": {
                    "type": "string",
                    "description": "Monday of the week in YYYY-MM-DD format. Defaults to current week.",
                },
            },
            "required": [],
        },
    },
    "list_activities": {
        "description": "Show all configured activities with their requirements.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    "get_activity": {
        "description": "Get detailed information about a specific activity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "activity_id": {
                    "type": "string",
                    "description": "Activity ID (e.g., 'chess', 'studio_session')",
                },
            },
            "required": ["activity_id"],
        },
    },
    "recall_context": {
        "description": "Search for relevant memories about past decisions and preferences.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for in memory",
                },
            },
            "required": ["query"],
        },
    },
    "store_preference": {
        "description": "Remember a user preference for future reference.",
        "input_schema": {
            "type": "object",
            "properties": {
                "preference": {
                    "type": "string",
                    "description": "The preference to remember (e.g., 'User prefers morning workouts')",
                },
            },
            "required": ["preference"],
        },
    },
    "store_decision": {
        "description": "Record a scheduling decision for future reference.",
        "input_schema": {
            "type": "object",
            "properties": {
                "decision": {
                    "type": "string",
                    "description": "The decision made (e.g., 'Moved chess to evening because mornings are rushed')",
                },
            },
            "required": ["decision"],
        },
    },
}


def get_tools_list() -> list[dict]:
    """Get list of tools in Claude API format.

    Returns:
        List of tool definitions
    """
    return [
        {
            "name": name,
            "description": tool["description"],
            "input_schema": tool["input_schema"],
        }
        for name, tool in TOOL_DESCRIPTIONS.items()
    ]
