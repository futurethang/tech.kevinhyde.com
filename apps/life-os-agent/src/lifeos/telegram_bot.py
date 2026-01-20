"""Telegram bot integration for Life OS Agent.

Provides a mobile-friendly interface via Telegram.
"""

from __future__ import annotations

import logging
from typing import Any

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from .agent import LifeOSAgent, create_agent
from .config import get_settings

logger = logging.getLogger(__name__)

# Global agent instance for Telegram
_telegram_agent: LifeOSAgent | None = None


async def get_telegram_agent() -> LifeOSAgent:
    """Get or create the Telegram agent instance."""
    global _telegram_agent
    if _telegram_agent is None:
        settings = get_settings()
        use_mock_calendar = not settings.google_credentials_file and not settings.google_credentials_b64
        use_mock_memory = not settings.mem0_api_key

        _telegram_agent = await create_agent(
            use_mock_calendar=use_mock_calendar,
            use_mock_memory=use_mock_memory,
        )
    return _telegram_agent


def get_user_id(update: Update) -> str:
    """Get user ID from Telegram update."""
    if update.effective_user:
        return f"telegram_{update.effective_user.id}"
    return "telegram_unknown"


# Command handlers
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "Welcome to Life OS Agent! 🗓️\n\n"
        "I'm your scheduling assistant. Here's what I can help with:\n\n"
        "**Commands:**\n"
        "/today - What's on your calendar today\n"
        "/week - This week's schedule\n"
        "/plan - Generate a schedule proposal\n"
        "/activities - List your activities\n"
        "/clear - Clear conversation history\n"
        "/help - Show this message\n\n"
        "**Or just ask me anything:**\n"
        "- \"Schedule chess tomorrow morning\"\n"
        "- \"What time do I have free on Friday?\"\n"
        "- \"Move my studio session to Saturday\"\n",
        parse_mode="Markdown",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    await start_command(update, context)


async def today_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /today command - show today's schedule."""
    user_id = get_user_id(update)

    try:
        agent = await get_telegram_agent()
        response = await agent.chat("What's on my calendar today?", user_id)
        await update.message.reply_text(response, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in /today: {e}")
        await update.message.reply_text(f"Error: {str(e)}")


async def week_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /week command - show this week's schedule."""
    user_id = get_user_id(update)

    try:
        agent = await get_telegram_agent()
        response = await agent.chat("What does my week look like?", user_id)
        await update.message.reply_text(response, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in /week: {e}")
        await update.message.reply_text(f"Error: {str(e)}")


async def plan_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /plan command - generate a schedule proposal."""
    user_id = get_user_id(update)

    await update.message.reply_text("Generating schedule proposal... ⏳")

    try:
        agent = await get_telegram_agent()
        response = await agent.chat("Plan my week", user_id)

        # Split long messages (Telegram has 4096 char limit)
        if len(response) > 4000:
            chunks = [response[i : i + 4000] for i in range(0, len(response), 4000)]
            for chunk in chunks:
                await update.message.reply_text(chunk, parse_mode="Markdown")
        else:
            await update.message.reply_text(response, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in /plan: {e}")
        await update.message.reply_text(f"Error: {str(e)}")


async def activities_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /activities command - list configured activities."""
    user_id = get_user_id(update)

    try:
        agent = await get_telegram_agent()
        response = await agent.chat("Show me my activities", user_id)
        await update.message.reply_text(response, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in /activities: {e}")
        await update.message.reply_text(f"Error: {str(e)}")


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /clear command - clear conversation history."""
    user_id = get_user_id(update)

    try:
        agent = await get_telegram_agent()
        agent.clear_conversation(user_id)
        await update.message.reply_text("Conversation history cleared! 🧹")
    except Exception as e:
        logger.error(f"Error in /clear: {e}")
        await update.message.reply_text(f"Error: {str(e)}")


# Message handler
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle regular text messages."""
    user_id = get_user_id(update)
    message = update.message.text

    if not message:
        return

    try:
        agent = await get_telegram_agent()
        response = await agent.chat(message, user_id)

        # Split long messages
        if len(response) > 4000:
            chunks = [response[i : i + 4000] for i in range(0, len(response), 4000)]
            for chunk in chunks:
                await update.message.reply_text(chunk, parse_mode="Markdown")
        else:
            await update.message.reply_text(response, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Error handling message: {e}")
        await update.message.reply_text(
            f"Sorry, I encountered an error: {str(e)}\n\n"
            "Try again or use /clear to reset the conversation."
        )


def create_telegram_bot(token: str | None = None) -> Application:
    """Create and configure the Telegram bot application.

    Args:
        token: Telegram bot token. Uses TELEGRAM_BOT_TOKEN env var if not provided.

    Returns:
        Configured Application instance
    """
    if token is None:
        settings = get_settings()
        token = settings.telegram_bot_token

    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN not provided")

    # Create application
    application = Application.builder().token(token).build()

    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("today", today_command))
    application.add_handler(CommandHandler("week", week_command))
    application.add_handler(CommandHandler("plan", plan_command))
    application.add_handler(CommandHandler("activities", activities_command))
    application.add_handler(CommandHandler("clear", clear_command))

    # Add message handler for regular text
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    return application


async def run_polling():
    """Run the bot in polling mode (for development)."""
    logger.info("Starting Telegram bot in polling mode...")
    application = create_telegram_bot()
    await application.run_polling()


def run_bot():
    """Run the Telegram bot (blocking)."""
    import asyncio

    asyncio.run(run_polling())


# Webhook integration for FastAPI
async def setup_webhook(app_url: str, token: str | None = None) -> None:
    """Set up Telegram webhook.

    Args:
        app_url: Base URL of the FastAPI app
        token: Telegram bot token
    """
    from telegram import Bot

    if token is None:
        settings = get_settings()
        token = settings.telegram_bot_token

    bot = Bot(token=token)
    webhook_url = f"{app_url}/webhooks/telegram"

    await bot.set_webhook(url=webhook_url)
    logger.info(f"Webhook set to {webhook_url}")


async def process_telegram_update(update_data: dict[str, Any], token: str | None = None) -> None:
    """Process an incoming Telegram update from webhook.

    Args:
        update_data: Raw update data from Telegram
        token: Telegram bot token
    """
    if token is None:
        settings = get_settings()
        token = settings.telegram_bot_token

    application = create_telegram_bot(token)

    # Process update
    update = Update.de_json(update_data, application.bot)
    await application.process_update(update)


if __name__ == "__main__":
    run_bot()
