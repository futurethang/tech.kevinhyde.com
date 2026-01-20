# Life OS Agent v2
## Product & Technical Specification

**Author:** Kevin Hyde
**Version:** 2.0
**Date:** January 2026

---

## Executive Summary

Life OS Agent is a personal scheduling assistant that uses AI to manage time allocation across all life domains. It operates on a simple principle:

> **Calendar is the UI. Memory is the work log. Chat is the interface.**

This v2 specification incorporates key refinements:
- **API-first architecture** (not CLI-first)
- **Telegram as primary mobile interface** (free, excellent UX)
- **MCP server for Claude app integration**
- **"Day 1 Employee" prompt philosophy** (competent assistant, not simulated friend)
- **Memory as accumulated work context** (not personality/relationship building)

---

## Part 1: Product Specification

### 1.1 What This Is

A scheduling assistant that:
- Maintains your life configuration (activities, priorities, constraints)
- Reads and writes to Google Calendar
- Accepts natural language instructions via Telegram or Claude apps
- Remembers decisions and stated preferences
- Proposes schedules based on your requirements

### 1.2 What This Is NOT

- **Not a character or persona** — It's a tool that does a job
- **Not a task manager** — Time blocks, not granular todos
- **Not autonomous** — You approve schedules; it proposes and executes on request
- **Not opinionated (yet)** — Earns the right to push back through reliability over time

### 1.3 Core Principle: Day 1 Employee

The agent behaves like a competent new hire:

| Week 1 | Month 1 | Month 6+ |
|--------|---------|----------|
| Knows the job | Has context from work together | Deep context, earned trust |
| Has your config | Remembers past decisions | May surface observations |
| Executes reliably | Starts noticing patterns (data) | Relationship emerged naturally |
| Asks when unclear | | |

**The prompt establishes competence, not personality. Any "relationship" emerges from usage over time.**

### 1.4 User Stories (v1 Scope)

#### Information
- "What's on my calendar today?"
- "What's my week look like?"
- "When am I doing studio time this week?"
- "How much time do I have for skill development?"

#### Scheduling
- "Schedule a chess session tomorrow morning"
- "Plan my week" → Proposes schedule based on activity requirements
- "Add a 3D printing session this weekend"
- "Move my Thursday studio time to Friday"

#### Configuration
- "Show me my activities"
- "What are my current priorities?"
- "Add woodworking as a new interest, 2 hours on weekends"

#### Reporting (Basic)
- "Did I do everything I scheduled this week?" (manual check-in)

### 1.5 Deferred to Later Versions

- Proactive check-ins ("Did you do X?")
- Push notifications / scheduled messages
- Pattern detection ("You've skipped Y three weeks in a row")
- Accountability features
- Weekly reflection prompts
- The agent "pushing back" on requests

These require earned trust and accumulated data. Build the foundation first.

---

## Part 2: Technical Specification

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTERACTION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Telegram Bot        │  MCP Server         │  CLI (dev only)    │
│  (primary mobile)    │  (Claude apps)      │                    │
└──────────┬───────────┴─────────┬───────────┴─────────┬──────────┘
           │                     │                     │
           └─────────────────────┴─────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER (FastAPI)                       │
├─────────────────────────────────────────────────────────────────┤
│  POST /chat                 - Natural language message           │
│  GET  /schedule             - Current schedule summary           │
│  POST /schedule/propose     - Generate week proposal             │
│  POST /webhooks/telegram    - Telegram webhook endpoint          │
│  GET  /health               - Health check                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AGENT CORE                               │
├─────────────────────────────────────────────────────────────────┤
│  LifeOSAgent                                                     │
│  ├── System Prompt (job description)                            │
│  ├── Tools (calendar, memory, config)                           │
│  └── Claude API (claude-sonnet-4-20250514)                              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPABILITY LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Calendar Client     │  Memory Client      │  Scheduler         │
│  (Google API)        │  (Mem0 Cloud)       │  (gaps, conflicts) │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Mem0 Cloud          │  SQLite              │  Google Calendar  │
│  (semantic memory)   │  (local state/logs)  │  (events)         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | Python 3.11+ | Rich ecosystem |
| API Framework | FastAPI | Async, modern, good docs |
| LLM | Claude API (Sonnet) | Best reasoning for scheduling |
| Memory | Mem0 Cloud (free tier) | No Docker needed, semantic search |
| Database | SQLite | Simple, no server, portable |
| Calendar | Google Calendar API | Direct OAuth, full control |
| Telegram | python-telegram-bot | Well-maintained, async |
| MCP | mcp package | Claude app integration |
| Hosting | Railway (then Synology) | Easy deploy, then self-host |

### 2.3 Component Details

#### 2.3.1 Capabilities (Tools)

```python
# What the agent can DO — the job responsibilities

CAPABILITIES = {
    # Calendar Operations
    "list_events": "Get calendar events for a date range",
    "create_event": "Create a new calendar event",
    "update_event": "Modify an existing event",
    "delete_event": "Remove an event",
    "find_free_time": "Find available time slots",

    # Scheduling Intelligence
    "propose_schedule": "Generate schedule based on activity requirements",
    "analyze_week": "Compare scheduled vs. required time allocation",

    # Configuration
    "list_activities": "Show all configured activities",
    "get_activity": "Get details about a specific activity",

    # Memory (Work Context)
    "recall_context": "Retrieve relevant past decisions/preferences",
    "store_preference": "Remember a stated preference",
    "store_decision": "Remember a scheduling decision",
}
```

#### 2.3.2 System Prompt (Job Description)

```markdown
# Life OS Agent - Operating Instructions

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

{config_yaml}

## Today's Context

- Current date/time: {current_datetime}
- Timezone: {timezone}
```

#### 2.3.3 Memory Model

Memory is **work context**, not relationship building:

```python
class MemoryTypes:
    """What gets stored and why."""

    # User explicitly stated something
    STATED_PREFERENCE = "preference"
    # Examples:
    # - "User prefers morning workouts"
    # - "User said Tuesday evenings are best for studio"

    # A scheduling decision was made
    DECISION = "decision"
    # Examples:
    # - "Moved chess from morning to evening - user said mornings are rushed"
    # - "Added woodworking on Saturdays 2-4pm"

    # User corrected something
    CORRECTION = "correction"
    # Examples:
    # - "User clarified: studio is in Fremont, not SF"
    # - "User said they can't do Friday evenings"

    # Factual record of what was scheduled
    SCHEDULED = "scheduled"
    # Examples:
    # - "Week of Jan 20: scheduled 3 chess, 2 studio, 5 cardio"
```

#### 2.3.4 Configuration Schema

```yaml
# life-os-config.yaml
# This is DATA the agent uses — not personality, just facts

meta:
  user: "Kevin Hyde"
  timezone: "America/Los_Angeles"

template:
  work:
    days: [monday, tuesday, wednesday, thursday, friday]
    start: "09:00"
    end: "16:00"

  office_days:
    days: [tuesday, wednesday, thursday]
    location: "Adobe Fremont"
    commute_minutes: 30

commitments:
  # Non-negotiable recurring events
  - name: "Monday Gym Class"
    day: monday
    start: "06:00"
    end: "06:45"
  # ... etc

activities:
  # Things to schedule
  - id: chess
    name: "Chess Practice"
    category: learning
    frequency: daily        # or: 3, "3-4", weekly
    duration: 30            # minutes, or "30-45"
    time_preference: morning  # morning, afternoon, evening, flexible
    days_preference: null     # or: [monday, wednesday, friday]
  # ... etc

priorities:
  critical: [weights, cardio]
  high: [studio_session, chess]
  medium: [skill_development, reading]
  low: [chores_errands]

calendars:
  primary: "k.p.hyde@gmail.com"
```

### 2.4 API Endpoints

```python
# FastAPI routes

@app.post("/chat")
async def chat(message: str, user_id: str = "default") -> ChatResponse:
    """Process a natural language message."""
    response = await agent.chat(message, user_id)
    return ChatResponse(message=response)

@app.get("/schedule")
async def get_schedule(
    start_date: date = None,
    days: int = 7,
) -> ScheduleResponse:
    """Get current schedule summary."""
    ...

@app.post("/schedule/propose")
async def propose_schedule(
    start_date: date = None,
) -> ProposalResponse:
    """Generate a schedule proposal for the week."""
    ...

@app.post("/webhooks/telegram")
async def telegram_webhook(update: Update):
    """Handle incoming Telegram messages."""
    ...

@app.get("/health")
async def health():
    """Health check for monitoring."""
    return {"status": "ok"}
```

### 2.5 Telegram Bot

```python
# Simple Telegram integration

from telegram import Update
from telegram.ext import Application, MessageHandler, filters

async def handle_message(update: Update, context):
    """Forward message to agent, return response."""
    user_message = update.message.text
    user_id = str(update.effective_user.id)

    # Call the agent
    response = await agent.chat(user_message, user_id)

    # Reply
    await update.message.reply_text(response)

def create_bot(token: str) -> Application:
    app = Application.builder().token(token).build()
    app.add_handler(MessageHandler(filters.TEXT, handle_message))
    return app
```

### 2.6 MCP Server (for Claude Apps)

```python
# MCP server for Claude Desktop / mobile app integration

from mcp import Server

server = Server("life-os-agent")

@server.tool()
async def chat(message: str) -> str:
    """Send a message to Life OS Agent."""
    return await agent.chat(message)

@server.tool()
async def whats_today() -> str:
    """Get today's schedule summary."""
    return await agent.chat("What's on my calendar today?")

@server.tool()
async def plan_week() -> str:
    """Generate a schedule proposal for the week."""
    return await agent.chat("Plan my week")

@server.tool()
async def schedule(activity: str, when: str) -> str:
    """Schedule an activity. Example: schedule('chess', 'tomorrow morning')"""
    return await agent.chat(f"Schedule {activity} {when}")
```

### 2.7 Project Structure

```
life-os-agent/
├── README.md                    # Setup & deployment guide
├── SPEC-V2.md                   # This document
├── pyproject.toml               # Python package config
├── .env.example                 # Environment template
│
├── config/
│   └── life-os-config.yaml      # User's life configuration
│
├── src/lifeos/
│   ├── __init__.py
│   │
│   ├── # CORE (reuse from v1)
│   ├── config.py                # Config parsing (Pydantic)
│   ├── calendar.py              # Google Calendar client
│   ├── memory.py                # Mem0 client
│   ├── scheduler.py             # Scheduling logic
│   │
│   ├── # AGENT (rewrite)
│   ├── agent.py                 # Main agent with tools
│   ├── prompts.py               # System prompt templates
│   │
│   ├── # API LAYER (new)
│   ├── api.py                   # FastAPI application
│   ├── telegram_bot.py          # Telegram integration
│   ├── mcp_server.py            # MCP server for Claude apps
│   │
│   └── # CLI (simplified, dev only)
│   └── cli.py                   # Dev/debug commands
│
└── tests/
    ├── test_config.py
    ├── test_scheduler.py
    └── test_agent.py
```

---

## Part 3: Deployment

### 3.1 Development (Local)

```bash
# Clone and setup
cd life-os-agent
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Configure
cp .env.example .env
# Add: ANTHROPIC_API_KEY, MEM0_API_KEY, TELEGRAM_BOT_TOKEN

# Google Calendar auth
python -m lifeos.calendar auth

# Run locally
uvicorn lifeos.api:app --reload
```

### 3.2 Production (Railway)

```bash
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn lifeos.api:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

Deploy:
```bash
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
- `ANTHROPIC_API_KEY`
- `MEM0_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_CREDENTIALS` (base64 encoded)

### 3.3 Future: Synology NAS

Once stable, migrate to self-hosted:
```bash
# On Synology with Docker
docker build -t life-os-agent .
docker run -d \
  --name life-os-agent \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  life-os-agent
```

---

## Part 4: Implementation Checklist

### Phase 1: Foundation
- [ ] Set up project structure
- [ ] Port reusable modules from v1 (config, calendar, memory, scheduler)
- [ ] Write v2 system prompt
- [ ] Implement agent with tools
- [ ] Basic FastAPI server with /chat endpoint
- [ ] Test locally via curl/httpie

### Phase 2: Telegram Integration
- [ ] Create Telegram bot via @BotFather
- [ ] Implement webhook handler
- [ ] Test mobile interaction
- [ ] Deploy to Railway

### Phase 3: MCP Server
- [ ] Implement MCP server module
- [ ] Test with Claude Desktop
- [ ] Document setup for Claude apps

### Phase 4: Polish
- [ ] Error handling and logging
- [ ] Rate limiting
- [ ] Conversation history management
- [ ] README with full setup guide

---

## Part 5: Environment Variables

```bash
# .env.example

# Required
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABC...

# Memory (Mem0 Cloud)
MEM0_API_KEY=m0-...

# Google Calendar
GOOGLE_CREDENTIALS_FILE=credentials.json
# Or for production (base64 encoded):
# GOOGLE_CREDENTIALS_B64=eyJ...

# Optional
LIFEOS_USER_ID=kevin
LIFEOS_CONFIG_PATH=config/life-os-config.yaml
LIFEOS_MODEL=claude-sonnet-4-20250514
LOG_LEVEL=INFO
```

---

## Part 6: Reusable Code from v1

The following modules from the v1 implementation can be reused with minimal changes:

### config.py
- Pydantic models for Activity, Commitment, Template, LifeOSConfig
- YAML loading and validation
- Helper methods (get_activity_by_id, get_activities_by_category, etc.)

### calendar.py
- GoogleCalendarClient class
- OAuth2 flow (load_credentials, save_credentials, authenticate)
- CRUD operations (list_events, create_event, update_event, delete_event)

### memory.py
- MemoryClient class (for Mem0 Cloud)
- SimpleMemoryClient class (JSON fallback for dev)
- Methods: add, search, get_all, delete

### scheduler.py
- TimeSlot dataclass
- ScheduleProposal dataclass
- Scheduler class with:
  - get_week_bounds()
  - calculate_weekly_requirements()
  - get_available_slots()
  - filter_slots_by_preference()
  - analyze_scheduled_vs_required()
  - propose_schedule()

---

## Appendix A: Example Interactions

### Simple Query
```
User: What's on my calendar tomorrow?

Agent: Tomorrow (Tuesday, Jan 21):
- 7:00 AM: Leave for office
- 7:45-8:30 AM: Cardio (Adobe gym)
- 9:00 AM-12:00 PM: Work
- 12:00-1:00 PM: Lunch
- 1:00-4:00 PM: Work
- 4:15-6:30 PM: Studio session (Dismal Nitch)

Evening is open after 7:00 PM.
```

### Scheduling Request
```
User: Schedule chess tomorrow morning

Agent: Done. Created "Chess Practice" for Tuesday 8:30-9:00 AM
(after your gym session, before work starts).
```

### Plan Week
```
User: Plan my week

Agent: Looking at your week starting Monday, Jan 20...

**Already scheduled:**
- Mon 6:00 AM: Gym class
- Tue/Thu 7:45 AM: Cardio
- Wed 7:45 AM: Weights
- Thu 4:00 PM: Social hour

**Proposed additions based on your activity requirements:**

| Day | Time | Activity | Notes |
|-----|------|----------|-------|
| Mon | 8:00-8:30 AM | Chess | After gym, before work |
| Mon | 4:15-4:30 PM | Instrument practice | |
| Mon | 4:30-6:00 PM | Skill development | |
| Tue | 8:30-8:45 AM | Reading | Train time |
| Tue | 4:15-6:30 PM | Studio session | You're in Fremont |
| ... | ... | ... | ... |

This covers:
- Chess: 7/7 daily sessions
- Instrument: 7/7 daily sessions
- Studio: 2/2 weekly sessions
- Skill dev: 4/4-5 sessions

Want me to add these to your calendar?
```

### Adding Activity
```
User: Add woodworking as a new interest, 2 hours on weekends

Agent: I'll add woodworking to your activities:

- **Name:** Woodworking
- **Frequency:** Weekly
- **Duration:** 2 hours
- **Preferred time:** Weekends

Looking at your typical weekend, Saturday 2-4 PM is usually open
(after your morning hike, before evening).

Should I:
1. Add it to your config at Saturday 2-4 PM
2. Try a different time slot
```

---

## Appendix B: Why These Choices

### Why Telegram over a custom app?
- Free, no App Store approval
- Excellent mobile UX already built
- Rich features: inline keyboards, formatting, media
- Works offline (messages queue)
- No app development/maintenance

### Why Mem0 Cloud over self-hosted?
- No Docker complexity for deployment
- Free tier is sufficient for personal use
- Semantic search out of the box
- Can migrate to self-hosted later if needed

### Why Railway over Vercel/Lambda?
- Persistent process (not serverless)
- Can run scheduled jobs
- Simple deploy from git
- Generous free tier
- Easy environment variable management

### Why "Day 1 Employee" over "AI Friend"?
- Trust is earned through reliability, not simulated
- Avoids uncanny valley of fake relationships
- Clear expectations: it's a tool that does a job
- Leaves room for natural evolution over time
- User stays in control

---

*End of v2 Specification*
