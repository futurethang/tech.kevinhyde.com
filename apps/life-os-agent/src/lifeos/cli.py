"""CLI interface for Life OS Agent (development/debugging).

Simple command-line interface for testing the agent.
"""

from __future__ import annotations

import asyncio
import sys

from .agent import create_agent
from .config import get_settings


async def interactive_chat():
    """Run an interactive chat session."""
    print("Life OS Agent - Interactive Mode")
    print("=" * 40)
    print("Type 'quit' or 'exit' to end the session.")
    print("Type 'clear' to clear conversation history.")
    print()

    settings = get_settings()

    # Determine if we should use mocks
    use_mock_calendar = not settings.anthropic_api_key
    use_mock_memory = not settings.mem0_api_key

    if use_mock_calendar:
        print("Note: Using mock calendar (no Google credentials)")
    if use_mock_memory:
        print("Note: Using local memory (no Mem0 API key)")

    print()

    try:
        agent = await create_agent(
            use_mock_calendar=use_mock_calendar,
            use_mock_memory=use_mock_memory,
        )
    except Exception as e:
        print(f"Error initializing agent: {e}")
        print("\nMake sure you have set the required environment variables:")
        print("  - ANTHROPIC_API_KEY")
        print("  - LIFEOS_CONFIG_PATH (or config/life-os-config.yaml)")
        return

    user_id = "cli_user"

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit"):
            print("Goodbye!")
            break

        if user_input.lower() == "clear":
            agent.clear_conversation(user_id)
            print("Conversation cleared.")
            continue

        try:
            response = await agent.chat(user_input, user_id)
            print(f"\nAgent: {response}")
        except Exception as e:
            print(f"\nError: {e}")


def main():
    """Main CLI entry point."""
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "chat":
            asyncio.run(interactive_chat())

        elif command == "serve":
            from .api import run_server

            run_server()

        elif command == "telegram":
            from .telegram_bot import run_bot

            run_bot()

        elif command == "auth":
            from .calendar import main as calendar_auth

            calendar_auth()

        else:
            print(f"Unknown command: {command}")
            print_help()

    else:
        print_help()


def print_help():
    """Print CLI help."""
    print(
        """
Life OS Agent CLI

Usage:
    lifeos chat      - Interactive chat mode
    lifeos serve     - Start the API server
    lifeos telegram  - Run Telegram bot (polling mode)
    lifeos auth      - Authenticate with Google Calendar

Environment Variables:
    ANTHROPIC_API_KEY     - Claude API key (required)
    TELEGRAM_BOT_TOKEN    - Telegram bot token (for telegram command)
    MEM0_API_KEY          - Mem0 API key (optional, uses local storage if not set)
    LIFEOS_CONFIG_PATH    - Path to config YAML (default: config/life-os-config.yaml)
    LIFEOS_MODEL          - Claude model (default: claude-sonnet-4-20250514)
    HOST                  - Server host (default: 0.0.0.0)
    PORT                  - Server port (default: 8080)
"""
    )


if __name__ == "__main__":
    main()
