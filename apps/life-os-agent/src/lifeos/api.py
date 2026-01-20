"""FastAPI server for Life OS Agent.

Provides REST API endpoints for interacting with the agent.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import LifeOSAgent, create_agent
from .config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global agent instance
_agent: LifeOSAgent | None = None


async def get_agent() -> LifeOSAgent:
    """Get or create the global agent instance."""
    global _agent
    if _agent is None:
        settings = get_settings()
        # Use mock clients if API keys aren't configured
        use_mock_calendar = not settings.google_credentials_file or not settings.google_credentials_b64
        use_mock_memory = not settings.mem0_api_key

        logger.info(
            f"Creating agent (mock_calendar={use_mock_calendar}, mock_memory={use_mock_memory})"
        )
        _agent = await create_agent(
            use_mock_calendar=use_mock_calendar,
            use_mock_memory=use_mock_memory,
        )
    return _agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Life OS Agent API...")
    yield
    # Shutdown
    logger.info("Shutting down Life OS Agent API...")


# Create FastAPI app
app = FastAPI(
    title="Life OS Agent",
    description="AI-powered personal scheduling assistant",
    version="2.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class ChatRequest(BaseModel):
    """Chat request body."""

    message: str
    user_id: str = "default"


class ChatResponse(BaseModel):
    """Chat response body."""

    message: str
    user_id: str


class ScheduleResponse(BaseModel):
    """Schedule response body."""

    start_date: str
    end_date: str
    events: list[dict[str, Any]]


class ProposalResponse(BaseModel):
    """Schedule proposal response."""

    week_start: str
    proposal: str
    coverage: dict[str, dict[str, Any]]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str = "2.0.0"


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="ok")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a natural language message.

    This is the main entry point for interacting with the agent.
    Send a message and receive a response.

    Examples:
    - "What's on my calendar today?"
    - "Schedule chess tomorrow morning"
    - "Plan my week"
    """
    try:
        agent = await get_agent()
        response = await agent.chat(request.message, request.user_id)
        return ChatResponse(message=response, user_id=request.user_id)
    except Exception as e:
        logger.error(f"Error processing chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    start_date: str | None = None,
    days: int = 7,
    user_id: str = "default",
):
    """Get current schedule summary.

    Args:
        start_date: Start date (YYYY-MM-DD format). Defaults to today.
        days: Number of days to include. Defaults to 7.
        user_id: User identifier.
    """
    try:
        agent = await get_agent()

        # Parse dates
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        else:
            start = date.today()

        end = start + __import__("datetime").timedelta(days=days)

        # Get events
        events = await agent.calendar.list_events(start_date=start, end_date=end)

        return ScheduleResponse(
            start_date=start.isoformat(),
            end_date=end.isoformat(),
            events=[
                {
                    "id": e.id,
                    "title": e.title,
                    "start": e.start.isoformat(),
                    "end": e.end.isoformat(),
                    "location": e.location,
                    "activity_id": e.activity_id,
                }
                for e in events
            ],
        )
    except Exception as e:
        logger.error(f"Error getting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/schedule/propose", response_model=ProposalResponse)
async def propose_schedule(
    week_start: str | None = None,
    user_id: str = "default",
):
    """Generate a schedule proposal for the week.

    Args:
        week_start: Monday of the week (YYYY-MM-DD). Defaults to current week.
        user_id: User identifier.
    """
    try:
        agent = await get_agent()

        # Parse week start
        if week_start:
            start = datetime.strptime(week_start, "%Y-%m-%d").date()
        else:
            start, _ = agent.scheduler.get_week_bounds()

        # Get existing events
        end = start + __import__("datetime").timedelta(days=6)
        events = await agent.calendar.list_events(start_date=start, end_date=end)

        # Generate proposal
        proposal = agent.scheduler.propose_schedule(start, events)

        return ProposalResponse(
            week_start=start.isoformat(),
            proposal=agent.scheduler.format_proposal(proposal),
            coverage=proposal.coverage,
        )
    except Exception as e:
        logger.error(f"Error proposing schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/conversation/clear")
async def clear_conversation(user_id: str = "default"):
    """Clear conversation history for a user.

    Args:
        user_id: User identifier.
    """
    try:
        agent = await get_agent()
        agent.clear_conversation(user_id)
        return {"status": "ok", "message": f"Cleared conversation for {user_id}"}
    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/activities")
async def list_activities():
    """List all configured activities."""
    try:
        agent = await get_agent()
        return {
            "activities": [
                {
                    "id": a.id,
                    "name": a.name,
                    "category": a.category.value,
                    "frequency": a.frequency,
                    "duration": a.duration,
                    "time_preference": a.time_preference.value,
                    "priority": agent.config.priorities.get_priority(a.id).value,
                }
                for a in agent.config.activities
            ]
        }
    except Exception as e:
        logger.error(f"Error listing activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/config")
async def get_config():
    """Get current configuration summary."""
    try:
        agent = await get_agent()
        return {
            "user": agent.config.meta.user,
            "timezone": agent.config.meta.timezone,
            "activities_count": len(agent.config.activities),
            "commitments_count": len(agent.config.commitments),
        }
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def run_server():
    """Run the API server."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "lifeos.api:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    run_server()
