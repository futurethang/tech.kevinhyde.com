"""Life OS Agent - Main agent implementation.

The core agent that orchestrates calendar, memory, and scheduling capabilities.
"""

from __future__ import annotations

import os
from datetime import datetime, date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import anthropic

from .config import LifeOSConfig, load_config, get_settings
from .calendar import GoogleCalendarClient, MockCalendarClient, get_calendar_client
from .memory import MemoryClient, MemoryType, get_memory_client
from .scheduler import Scheduler, ScheduledEvent
from .prompts import build_system_prompt, get_tools_list


class LifeOSAgent:
    """Main Life OS scheduling agent."""

    def __init__(
        self,
        config: LifeOSConfig | None = None,
        calendar_client: GoogleCalendarClient | MockCalendarClient | None = None,
        memory_client: MemoryClient | None = None,
        model: str | None = None,
        use_mock_calendar: bool = False,
        use_mock_memory: bool = False,
    ):
        """Initialize the Life OS agent.

        Args:
            config: Life configuration. Loads from file if None.
            calendar_client: Calendar client. Creates default if None.
            memory_client: Memory client. Creates default if None.
            model: Claude model to use. Uses LIFEOS_MODEL env var if None.
            use_mock_calendar: Use mock calendar for testing.
            use_mock_memory: Use simple JSON memory for testing.
        """
        settings = get_settings()

        # Load config
        self.config = config or load_config()

        # Initialize clients
        self.calendar = calendar_client or get_calendar_client(use_mock=use_mock_calendar)
        self.memory = memory_client or get_memory_client(use_mem0=not use_mock_memory)

        # Initialize scheduler
        self.scheduler = Scheduler(self.config)

        # Initialize Claude client
        self.model = model or settings.lifeos_model
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        # Build system prompt
        self.system_prompt = build_system_prompt(self.config)

        # Conversation history per user
        self._conversations: dict[str, list[dict]] = {}

    def _get_conversation(self, user_id: str) -> list[dict]:
        """Get or create conversation history for a user."""
        if user_id not in self._conversations:
            self._conversations[user_id] = []
        return self._conversations[user_id]

    def _add_message(self, user_id: str, role: str, content: Any) -> None:
        """Add a message to conversation history."""
        conv = self._get_conversation(user_id)
        conv.append({"role": role, "content": content})

        # Keep conversation manageable (last 20 turns)
        if len(conv) > 40:
            self._conversations[user_id] = conv[-40:]

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
        user_id: str,
    ) -> str:
        """Execute a tool and return the result.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Tool input parameters
            user_id: User ID for memory operations

        Returns:
            Tool result as string
        """
        tz = ZoneInfo(self.config.meta.timezone)

        try:
            # Calendar operations
            if tool_name == "list_events":
                start = tool_input.get("start_date")
                end = tool_input.get("end_date")

                start_date = datetime.strptime(start, "%Y-%m-%d").date() if start else date.today()
                end_date = datetime.strptime(end, "%Y-%m-%d").date() if end else start_date + timedelta(days=7)

                events = await self.calendar.list_events(start_date=start_date, end_date=end_date)

                if not events:
                    return f"No events found between {start_date} and {end_date}."

                result = f"Events from {start_date} to {end_date}:\n\n"
                current_day = None
                for event in events:
                    event_day = event.start.strftime("%A, %B %d")
                    if event_day != current_day:
                        result += f"\n**{event_day}**\n"
                        current_day = event_day

                    start_time = event.start.strftime("%-I:%M %p")
                    end_time = event.end.strftime("%-I:%M %p")
                    result += f"- {start_time}-{end_time}: {event.title}"
                    if event.location:
                        result += f" ({event.location})"
                    result += f" [id: {event.id}]\n"

                return result

            elif tool_name == "create_event":
                title = tool_input["title"]
                start = datetime.fromisoformat(tool_input["start"])
                end = datetime.fromisoformat(tool_input["end"])
                activity_id = tool_input.get("activity_id")
                location = tool_input.get("location")

                event = await self.calendar.create_event(
                    title=title,
                    start=start,
                    end=end,
                    activity_id=activity_id,
                    location=location,
                )

                return (
                    f"Created event: {event.title}\n"
                    f"Time: {event.start.strftime('%A, %B %d at %-I:%M %p')} - "
                    f"{event.end.strftime('%-I:%M %p')}\n"
                    f"Event ID: {event.id}"
                )

            elif tool_name == "update_event":
                event_id = tool_input["event_id"]
                title = tool_input.get("title")
                start_str = tool_input.get("start")
                end_str = tool_input.get("end")
                location = tool_input.get("location")

                start = datetime.fromisoformat(start_str) if start_str else None
                end = datetime.fromisoformat(end_str) if end_str else None

                event = await self.calendar.update_event(
                    event_id=event_id,
                    title=title,
                    start=start,
                    end=end,
                    location=location,
                )

                return (
                    f"Updated event: {event.title}\n"
                    f"New time: {event.start.strftime('%A, %B %d at %-I:%M %p')} - "
                    f"{event.end.strftime('%-I:%M %p')}"
                )

            elif tool_name == "delete_event":
                event_id = tool_input["event_id"]
                success = await self.calendar.delete_event(event_id)

                if success:
                    return f"Deleted event {event_id}"
                else:
                    return f"Failed to delete event {event_id}"

            elif tool_name == "find_free_time":
                date_str = tool_input["date"]
                duration = tool_input["duration_minutes"]

                check_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                free_slots = await self.calendar.find_free_time(check_date, duration)

                if not free_slots:
                    return f"No free slots of {duration} minutes found on {check_date}"

                result = f"Free time slots on {check_date} ({duration}+ min available):\n"
                for start, end in free_slots:
                    result += f"- {start.strftime('%-I:%M %p')} - {end.strftime('%-I:%M %p')}\n"
                return result

            # Scheduling operations
            elif tool_name == "propose_schedule":
                week_start_str = tool_input.get("week_start")

                if week_start_str:
                    week_start = datetime.strptime(week_start_str, "%Y-%m-%d").date()
                else:
                    week_start, _ = self.scheduler.get_week_bounds()

                # Get existing events
                week_end = week_start + timedelta(days=6)
                events = await self.calendar.list_events(start_date=week_start, end_date=week_end)

                # Generate proposal
                proposal = self.scheduler.propose_schedule(week_start, events)
                return self.scheduler.format_proposal(proposal)

            elif tool_name == "analyze_week":
                week_start_str = tool_input.get("week_start")

                if week_start_str:
                    week_start = datetime.strptime(week_start_str, "%Y-%m-%d").date()
                else:
                    week_start, _ = self.scheduler.get_week_bounds()

                # Get existing events
                week_end = week_start + timedelta(days=6)
                events = await self.calendar.list_events(start_date=week_start, end_date=week_end)

                # Analyze
                analysis = self.scheduler.analyze_scheduled_vs_required(events, week_start)

                result = f"**Week Analysis ({week_start} to {week_end})**\n\n"
                for activity_id, info in analysis.items():
                    status = "✓" if info["on_track"] else "✗"
                    result += (
                        f"{status} **{info['activity_name']}**: "
                        f"{info['scheduled_sessions']}/{info['target_sessions']} sessions "
                        f"({info['scheduled_minutes']}/{info['target_minutes']} min)\n"
                    )

                return result

            # Configuration operations
            elif tool_name == "list_activities":
                result = "**Configured Activities:**\n\n"

                for activity in self.config.activities:
                    priority = self.config.priorities.get_priority(activity.id)
                    result += (
                        f"- **{activity.name}** (`{activity.id}`)\n"
                        f"  Category: {activity.category.value}\n"
                        f"  Frequency: {activity.frequency}/week\n"
                        f"  Duration: {activity.duration} min\n"
                        f"  Time preference: {activity.time_preference.value}\n"
                        f"  Priority: {priority.value}\n\n"
                    )

                return result

            elif tool_name == "get_activity":
                activity_id = tool_input["activity_id"]
                activity = self.config.get_activity_by_id(activity_id)

                if not activity:
                    return f"Activity not found: {activity_id}"

                priority = self.config.priorities.get_priority(activity_id)

                return (
                    f"**{activity.name}** (`{activity.id}`)\n\n"
                    f"- Category: {activity.category.value}\n"
                    f"- Frequency: {activity.frequency}/week ({activity.weekly_target} sessions)\n"
                    f"- Duration: {activity.duration} min\n"
                    f"- Time preference: {activity.time_preference.value}\n"
                    f"- Days preference: {activity.days_preference or 'Any'}\n"
                    f"- Location: {activity.location or 'Not specified'}\n"
                    f"- Priority: {priority.value}\n"
                )

            # Memory operations
            elif tool_name == "recall_context":
                query = tool_input["query"]
                memories = await self.memory.search(query, user_id=user_id, limit=5)

                if not memories:
                    return f"No relevant memories found for: {query}"

                result = "**Relevant context:**\n\n"
                for mem in memories:
                    content = mem.get("memory", mem.get("content", ""))
                    mem_type = mem.get("metadata", {}).get("memory_type", "unknown")
                    result += f"- [{mem_type}] {content}\n"

                return result

            elif tool_name == "store_preference":
                preference = tool_input["preference"]
                memory_id = await self.memory.add(
                    content=preference,
                    memory_type=MemoryType.PREFERENCE,
                    user_id=user_id,
                )
                return f"Stored preference: {preference}"

            elif tool_name == "store_decision":
                decision = tool_input["decision"]
                memory_id = await self.memory.add(
                    content=decision,
                    memory_type=MemoryType.DECISION,
                    user_id=user_id,
                )
                return f"Recorded decision: {decision}"

            else:
                return f"Unknown tool: {tool_name}"

        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"

    async def chat(
        self,
        message: str,
        user_id: str = "default",
    ) -> str:
        """Process a chat message and return response.

        Args:
            message: User message
            user_id: User identifier

        Returns:
            Agent response
        """
        # Add user message to conversation
        self._add_message(user_id, "user", message)

        # Get conversation history
        messages = self._get_conversation(user_id)

        # Call Claude with tools
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=self.system_prompt,
            tools=get_tools_list(),
            messages=messages,
        )

        # Process response, handling tool use
        while response.stop_reason == "tool_use":
            # Extract tool calls
            tool_calls = [
                block for block in response.content
                if block.type == "tool_use"
            ]

            # Add assistant message with tool calls
            self._add_message(user_id, "assistant", response.content)

            # Execute tools and collect results
            tool_results = []
            for tool_call in tool_calls:
                result = await self._execute_tool(
                    tool_call.name,
                    tool_call.input,
                    user_id,
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_call.id,
                    "content": result,
                })

            # Add tool results to conversation
            self._add_message(user_id, "user", tool_results)

            # Continue conversation with tool results
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                tools=get_tools_list(),
                messages=self._get_conversation(user_id),
            )

        # Extract text response
        text_blocks = [
            block.text for block in response.content
            if hasattr(block, "text")
        ]
        final_response = "\n".join(text_blocks)

        # Add final response to conversation
        self._add_message(user_id, "assistant", response.content)

        return final_response

    def clear_conversation(self, user_id: str = "default") -> None:
        """Clear conversation history for a user.

        Args:
            user_id: User identifier
        """
        if user_id in self._conversations:
            self._conversations[user_id] = []


async def create_agent(
    use_mock_calendar: bool = False,
    use_mock_memory: bool = False,
) -> LifeOSAgent:
    """Factory function to create a configured agent.

    Args:
        use_mock_calendar: Use mock calendar client
        use_mock_memory: Use simple JSON memory

    Returns:
        Configured LifeOSAgent instance
    """
    return LifeOSAgent(
        use_mock_calendar=use_mock_calendar,
        use_mock_memory=use_mock_memory,
    )
