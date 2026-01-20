"""MCP server for Life OS Agent.

Enables Claude Desktop/mobile app integration via Model Context Protocol.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .agent import create_agent, LifeOSAgent
from .config import get_settings

logger = logging.getLogger(__name__)

# Create MCP server
server = Server("life-os-agent")

# Global agent instance
_mcp_agent: LifeOSAgent | None = None


async def get_mcp_agent() -> LifeOSAgent:
    """Get or create the MCP agent instance."""
    global _mcp_agent
    if _mcp_agent is None:
        settings = get_settings()
        use_mock_calendar = not settings.google_credentials_file and not settings.google_credentials_b64
        use_mock_memory = not settings.mem0_api_key

        _mcp_agent = await create_agent(
            use_mock_calendar=use_mock_calendar,
            use_mock_memory=use_mock_memory,
        )
    return _mcp_agent


# Tool definitions
@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools."""
    return [
        Tool(
            name="chat",
            description="Send a message to Life OS Agent for scheduling assistance",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Your message or request",
                    },
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="whats_today",
            description="Get today's schedule from Life OS",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="whats_this_week",
            description="Get this week's schedule from Life OS",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="plan_week",
            description="Generate a schedule proposal for the week",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="schedule",
            description="Schedule an activity at a specific time",
            inputSchema={
                "type": "object",
                "properties": {
                    "activity": {
                        "type": "string",
                        "description": "Activity to schedule (e.g., 'chess', 'studio session')",
                    },
                    "when": {
                        "type": "string",
                        "description": "When to schedule (e.g., 'tomorrow morning', 'Friday 2pm')",
                    },
                },
                "required": ["activity", "when"],
            },
        ),
        Tool(
            name="find_time",
            description="Find available time for an activity",
            inputSchema={
                "type": "object",
                "properties": {
                    "duration_minutes": {
                        "type": "integer",
                        "description": "How long you need in minutes",
                    },
                    "date": {
                        "type": "string",
                        "description": "Date to check (e.g., 'tomorrow', 'Friday')",
                    },
                },
                "required": ["duration_minutes"],
            },
        ),
        Tool(
            name="list_activities",
            description="Show all configured activities and their requirements",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    try:
        agent = await get_mcp_agent()
        user_id = "mcp_user"

        if name == "chat":
            message = arguments.get("message", "")
            response = await agent.chat(message, user_id)

        elif name == "whats_today":
            response = await agent.chat("What's on my calendar today?", user_id)

        elif name == "whats_this_week":
            response = await agent.chat("What does my week look like?", user_id)

        elif name == "plan_week":
            response = await agent.chat("Plan my week", user_id)

        elif name == "schedule":
            activity = arguments.get("activity", "")
            when = arguments.get("when", "")
            response = await agent.chat(f"Schedule {activity} {when}", user_id)

        elif name == "find_time":
            duration = arguments.get("duration_minutes", 30)
            date_str = arguments.get("date", "today")
            response = await agent.chat(
                f"Find {duration} minutes of free time {date_str}", user_id
            )

        elif name == "list_activities":
            response = await agent.chat("Show me my activities", user_id)

        else:
            response = f"Unknown tool: {name}"

        return [TextContent(type="text", text=response)]

    except Exception as e:
        logger.error(f"Error in tool {name}: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def run_mcp_server():
    """Run the MCP server."""
    logger.info("Starting Life OS MCP server...")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main():
    """Main entry point for MCP server."""
    asyncio.run(run_mcp_server())


if __name__ == "__main__":
    main()
