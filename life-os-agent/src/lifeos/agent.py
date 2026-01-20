"""Core agent implementation for Life OS Agent."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from typing import Any

import yaml
from anthropic import Anthropic

from .calendar import CalendarClient
from .config import Activity, LifeOSConfig, load_config
from .memory import MemoryClient, SimpleMemoryClient
from .scheduler import ScheduleProposal, Scheduler


class LifeOSAgent:
    """Main agent class for Life OS scheduling assistant."""

    def __init__(
        self,
        config_path: str | None = None,
        use_simple_memory: bool = False,
    ):
        """Initialize the Life OS Agent.

        Args:
            config_path: Path to life-os-config.yaml
            use_simple_memory: Use local JSON memory instead of Mem0
        """
        self.config = load_config(config_path)
        self.scheduler = Scheduler(self.config)
        self.calendar = CalendarClient()

        # Initialize memory client
        if use_simple_memory:
            self.memory: MemoryClient | SimpleMemoryClient = SimpleMemoryClient()
        else:
            self.memory = MemoryClient()

        # Initialize Anthropic client
        self.llm = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = os.environ.get("LIFEOS_MODEL", "claude-sonnet-4-20250514")
        self.user_id = os.environ.get("LIFEOS_USER_ID", "kevin")

        # Conversation history for multi-turn
        self.conversation_history: list[dict[str, Any]] = []

    def get_system_prompt(self) -> str:
        """Generate the system prompt with current configuration."""
        config_yaml = yaml.dump(
            self.config.model_dump(exclude_none=True),
            default_flow_style=False,
            sort_keys=False,
        )

        return f"""You are Life OS Agent, a personal scheduling assistant for {self.config.meta.user}.

Your role is to help manage time allocation across all life domains by:
1. Understanding the user's goals, interests, and constraints
2. Reading and writing to their Google Calendar
3. Proposing schedules that balance all priorities
4. Learning from patterns and adapting over time

## Current Configuration

```yaml
{config_yaml}
```

## Guidelines

- Calendar is the source of truth for scheduled time
- Always check for conflicts before scheduling
- Respect fixed commitments and work hours
- When in doubt, ask for clarification
- Explain your reasoning when proposing schedules
- Note any tradeoffs being made
- Be concise but helpful
- When listing events, format times clearly (e.g., "9:00 AM - 10:30 AM")

## Tool Usage

You have access to tools for calendar operations, memory, and scheduling analysis.
Use them to provide accurate, helpful responses. Always use tools to get current
calendar state rather than guessing.

## Today's Context

- Current date/time: {datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")}
- Timezone: {self.config.meta.timezone}
"""

    def get_tools(self) -> list[dict[str, Any]]:
        """Get the tool definitions for the LLM."""
        return [
            {
                "name": "list_events",
                "description": "Get calendar events for a date range. Use this to see what's currently scheduled.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "start_date": {
                            "type": "string",
                            "description": "Start date in YYYY-MM-DD format (defaults to today)",
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date in YYYY-MM-DD format (defaults to 7 days from start)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "create_event",
                "description": "Create a new calendar event. Use this to schedule activities.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string", "description": "Event title"},
                        "start": {
                            "type": "string",
                            "description": "Start datetime in ISO format (YYYY-MM-DDTHH:MM:SS)",
                        },
                        "end": {
                            "type": "string",
                            "description": "End datetime in ISO format (YYYY-MM-DDTHH:MM:SS)",
                        },
                        "description": {"type": "string", "description": "Event description"},
                        "location": {"type": "string", "description": "Event location"},
                        "activity_id": {
                            "type": "string",
                            "description": "Life OS activity ID if this is a scheduled activity",
                        },
                    },
                    "required": ["summary", "start", "end"],
                },
            },
            {
                "name": "delete_event",
                "description": "Delete a calendar event by its ID.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "event_id": {"type": "string", "description": "The event ID to delete"},
                    },
                    "required": ["event_id"],
                },
            },
            {
                "name": "find_free_time",
                "description": "Find available time slots in the schedule.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                        "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format"},
                        "duration_minutes": {
                            "type": "integer",
                            "description": "Minimum duration needed in minutes",
                        },
                    },
                    "required": ["duration_minutes"],
                },
            },
            {
                "name": "list_activities",
                "description": "List all registered activities from the Life OS configuration.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "description": "Filter by category (health, creative, learning, etc.)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "get_activity",
                "description": "Get details about a specific activity.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "activity_id": {"type": "string", "description": "The activity ID"},
                    },
                    "required": ["activity_id"],
                },
            },
            {
                "name": "analyze_week",
                "description": "Analyze scheduled vs. required time allocation for the week.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "start_date": {
                            "type": "string",
                            "description": "Start of week in YYYY-MM-DD format (defaults to current week)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "propose_schedule",
                "description": "Generate a proposed schedule to fill gaps based on activity requirements.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "start_date": {
                            "type": "string",
                            "description": "Start of week in YYYY-MM-DD format",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "recall_memories",
                "description": "Search stored memories for relevant context about the user.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results to return (default 5)",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "add_memory",
                "description": "Store a new piece of information about the user's preferences or patterns.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "The information to remember"},
                        "category": {
                            "type": "string",
                            "description": "Category (preference, pattern, interest, etc.)",
                        },
                    },
                    "required": ["content"],
                },
            },
        ]

    def execute_tool(self, tool_name: str, tool_input: dict[str, Any]) -> str:
        """Execute a tool and return the result.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Tool input parameters

        Returns:
            JSON string with tool result
        """
        try:
            if tool_name == "list_events":
                return self._tool_list_events(tool_input)
            elif tool_name == "create_event":
                return self._tool_create_event(tool_input)
            elif tool_name == "delete_event":
                return self._tool_delete_event(tool_input)
            elif tool_name == "find_free_time":
                return self._tool_find_free_time(tool_input)
            elif tool_name == "list_activities":
                return self._tool_list_activities(tool_input)
            elif tool_name == "get_activity":
                return self._tool_get_activity(tool_input)
            elif tool_name == "analyze_week":
                return self._tool_analyze_week(tool_input)
            elif tool_name == "propose_schedule":
                return self._tool_propose_schedule(tool_input)
            elif tool_name == "recall_memories":
                return self._tool_recall_memories(tool_input)
            elif tool_name == "add_memory":
                return self._tool_add_memory(tool_input)
            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})
        except Exception as e:
            return json.dumps({"error": str(e)})

    def _tool_list_events(self, params: dict[str, Any]) -> str:
        """List calendar events."""
        start_str = params.get("start_date")
        end_str = params.get("end_date")

        if start_str:
            start = datetime.fromisoformat(start_str)
        else:
            start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        if end_str:
            end = datetime.fromisoformat(end_str)
        else:
            end = start + timedelta(days=7)

        events = self.calendar.list_events(time_min=start, time_max=end)

        # Format events for display
        formatted = []
        for event in events:
            start_dt = event.get("start", {}).get("dateTime", event.get("start", {}).get("date"))
            end_dt = event.get("end", {}).get("dateTime", event.get("end", {}).get("date"))

            ext_props = event.get("extendedProperties", {}).get("private", {})

            formatted.append({
                "id": event.get("id"),
                "summary": event.get("summary"),
                "start": start_dt,
                "end": end_dt,
                "location": event.get("location"),
                "is_lifeos_event": ext_props.get("lifeos_generated") == "true",
                "activity_id": ext_props.get("lifeos_activity_id"),
            })

        return json.dumps({"events": formatted, "count": len(formatted)})

    def _tool_create_event(self, params: dict[str, Any]) -> str:
        """Create a calendar event."""
        start = datetime.fromisoformat(params["start"])
        end = datetime.fromisoformat(params["end"])

        # Build extended properties if this is a Life OS activity
        extended_properties = None
        if activity_id := params.get("activity_id"):
            activity = self.config.get_activity_by_id(activity_id)
            if activity:
                extended_properties = {
                    "private": {
                        "lifeos_activity_id": activity_id,
                        "lifeos_category": activity.category,
                        "lifeos_generated": "true",
                    }
                }

        event = self.calendar.create_event(
            summary=params["summary"],
            start=start,
            end=end,
            description=params.get("description"),
            location=params.get("location"),
            extended_properties=extended_properties,
        )

        return json.dumps({
            "success": True,
            "event_id": event.get("id"),
            "summary": event.get("summary"),
            "start": params["start"],
            "end": params["end"],
        })

    def _tool_delete_event(self, params: dict[str, Any]) -> str:
        """Delete a calendar event."""
        self.calendar.delete_event(params["event_id"])
        return json.dumps({"success": True, "deleted": params["event_id"]})

    def _tool_find_free_time(self, params: dict[str, Any]) -> str:
        """Find available time slots."""
        start_str = params.get("start_date")
        end_str = params.get("end_date")
        duration = params.get("duration_minutes", 30)

        if start_str:
            start = datetime.fromisoformat(start_str)
        else:
            start = datetime.now()

        if end_str:
            end = datetime.fromisoformat(end_str)
        else:
            end = start + timedelta(days=7)

        events = self.calendar.list_events(time_min=start, time_max=end)
        slots = self.scheduler.get_available_slots(events, start, end, min_duration=duration)

        formatted = [
            {
                "start": slot.start.isoformat(),
                "end": slot.end.isoformat(),
                "duration_minutes": slot.duration_minutes,
            }
            for slot in slots
        ]

        return json.dumps({"free_slots": formatted, "count": len(formatted)})

    def _tool_list_activities(self, params: dict[str, Any]) -> str:
        """List configured activities."""
        category = params.get("category")

        if category:
            activities = self.config.get_activities_by_category(category)
        else:
            activities = self.config.activities

        formatted = [
            {
                "id": a.id,
                "name": a.name,
                "category": a.category,
                "frequency": a.frequency,
                "duration": a.duration,
                "priority": self.config.get_activity_priority(a.id),
            }
            for a in activities
        ]

        return json.dumps({"activities": formatted, "count": len(formatted)})

    def _tool_get_activity(self, params: dict[str, Any]) -> str:
        """Get activity details."""
        activity = self.config.get_activity_by_id(params["activity_id"])

        if not activity:
            return json.dumps({"error": f"Activity not found: {params['activity_id']}"})

        return json.dumps({
            "id": activity.id,
            "name": activity.name,
            "category": activity.category,
            "frequency": activity.frequency,
            "duration": activity.duration,
            "location": activity.location,
            "days_preference": activity.days_preference,
            "time_preference": activity.time_preference,
            "note": activity.note,
            "sub_interests": (
                [{"name": s.name, "priority": s.current_priority} for s in activity.sub_interests]
                if activity.sub_interests
                else None
            ),
            "priority": self.config.get_activity_priority(activity.id),
        })

    def _tool_analyze_week(self, params: dict[str, Any]) -> str:
        """Analyze week schedule vs requirements."""
        start_str = params.get("start_date")

        if start_str:
            start = datetime.fromisoformat(start_str)
        else:
            start, _ = self.scheduler.get_week_bounds()

        end = start + timedelta(days=7)
        events = self.calendar.list_events(time_min=start, time_max=end)
        analysis = self.scheduler.analyze_scheduled_vs_required(events, start, end)

        formatted = {}
        for activity_id, data in analysis.items():
            formatted[activity_id] = {
                "name": data["activity"].name,
                "category": data["activity"].category,
                "required_sessions": data["required_sessions"],
                "scheduled_sessions": data["scheduled_sessions"],
                "sessions_deficit": data["sessions_deficit"],
                "required_minutes": data["required_minutes"],
                "scheduled_minutes": data["scheduled_minutes"],
                "minutes_deficit": data["minutes_deficit"],
                "priority": data["priority"],
            }

        return json.dumps({"analysis": formatted, "week_start": start.isoformat()})

    def _tool_propose_schedule(self, params: dict[str, Any]) -> str:
        """Generate schedule proposals."""
        start_str = params.get("start_date")

        if start_str:
            start = datetime.fromisoformat(start_str)
        else:
            start, _ = self.scheduler.get_week_bounds()

        events = self.calendar.list_events(time_min=start, time_max=start + timedelta(days=7))
        proposals = self.scheduler.propose_schedule(events, start)

        formatted = [
            {
                "activity_id": p.activity.id,
                "activity_name": p.activity.name,
                "start": p.start.isoformat(),
                "end": p.end.isoformat(),
                "duration_minutes": int((p.end - p.start).total_seconds() / 60),
                "reasoning": p.reasoning,
                "priority": p.priority,
            }
            for p in proposals
        ]

        return json.dumps({"proposals": formatted, "count": len(formatted)})

    def _tool_recall_memories(self, params: dict[str, Any]) -> str:
        """Search memories."""
        results = self.memory.search(
            params["query"],
            user_id=self.user_id,
            limit=params.get("limit", 5),
        )

        return json.dumps({"memories": results, "count": len(results)})

    def _tool_add_memory(self, params: dict[str, Any]) -> str:
        """Add a memory."""
        result = self.memory.add(
            params["content"],
            user_id=self.user_id,
            metadata={"category": params.get("category", "general")},
        )

        return json.dumps({"success": True, "memories_created": len(result.get("memories", []))})

    def chat(self, message: str) -> str:
        """Process a user message and return a response.

        Args:
            message: User's message

        Returns:
            Agent's response
        """
        # Add user message to history
        self.conversation_history.append({"role": "user", "content": message})

        # Get relevant memories
        try:
            memories = self.memory.search(message, user_id=self.user_id, limit=5)
            if memories:
                memory_context = "\n\nRelevant memories:\n" + "\n".join(
                    f"- {m.get('content', m.get('memory', ''))}" for m in memories
                )
                system_prompt = self.get_system_prompt() + memory_context
            else:
                system_prompt = self.get_system_prompt()
        except Exception:
            # Memory service might not be running
            system_prompt = self.get_system_prompt()

        # Call Claude with tools
        response = self.llm.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            tools=self.get_tools(),
            messages=self.conversation_history,
        )

        # Handle tool use loop
        while response.stop_reason == "tool_use":
            # Extract tool uses
            tool_uses = [block for block in response.content if block.type == "tool_use"]

            # Add assistant response to history
            self.conversation_history.append({
                "role": "assistant",
                "content": response.content,
            })

            # Execute tools and build result message
            tool_results = []
            for tool_use in tool_uses:
                result = self.execute_tool(tool_use.name, tool_use.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result,
                })

            # Add tool results to history
            self.conversation_history.append({
                "role": "user",
                "content": tool_results,
            })

            # Continue the conversation
            response = self.llm.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                tools=self.get_tools(),
                messages=self.conversation_history,
            )

        # Extract final text response
        final_response = ""
        for block in response.content:
            if hasattr(block, "text"):
                final_response += block.text

        # Add assistant response to history
        self.conversation_history.append({
            "role": "assistant",
            "content": response.content,
        })

        # Store memory from this interaction
        try:
            self.memory.add(
                [
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": final_response},
                ],
                user_id=self.user_id,
            )
        except Exception:
            pass  # Memory service might not be running

        return final_response

    def reset_conversation(self) -> None:
        """Clear the conversation history."""
        self.conversation_history = []
