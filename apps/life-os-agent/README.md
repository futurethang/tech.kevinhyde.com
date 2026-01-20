# Life OS Agent

AI-powered personal scheduling assistant using Claude, Google Calendar, and natural language.

> **Calendar is the UI. Memory is the work log. Chat is the interface.**

## Overview

Life OS Agent helps manage time allocation across all life domains:
- **Work** - Focus blocks, meetings, commute
- **Health** - Workouts, cardio, recovery
- **Creative** - Studio sessions, music practice
- **Learning** - Skill development, reading, chess
- **Life** - Chores, errands, social

## Features

- **Natural Language Interface**: "Schedule chess tomorrow morning"
- **Smart Scheduling**: Respects your priorities and preferences
- **Multiple Interfaces**: Telegram, Claude apps (MCP), REST API
- **Memory**: Remembers past decisions and stated preferences
- **Week Planning**: Propose schedules based on activity requirements

## Quick Start

### 1. Setup

```bash
cd apps/life-os-agent

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your API keys:

```bash
ANTHROPIC_API_KEY=sk-ant-...        # Required
TELEGRAM_BOT_TOKEN=123456:ABC...    # For Telegram
MEM0_API_KEY=m0-...                 # For semantic memory (optional)
```

### 3. Configure Your Life

Edit `config/life-os-config.yaml` with your activities, schedule, and priorities.

### 4. Google Calendar Auth (optional)

```bash
# Download OAuth credentials from Google Cloud Console
# Save as credentials.json

python -m lifeos.calendar auth
```

### 5. Run

```bash
# Interactive CLI (development)
lifeos chat

# API server
lifeos serve

# Telegram bot
lifeos telegram
```

## Interfaces

### REST API

```bash
# Start server
uvicorn lifeos.api:app --reload

# Chat
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is on my calendar today?"}'

# Get schedule
curl http://localhost:8080/schedule

# Propose week
curl -X POST http://localhost:8080/schedule/propose
```

### Telegram Bot

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Copy the token to `.env`
3. Run `lifeos telegram`

Commands:
- `/today` - Today's schedule
- `/week` - This week
- `/plan` - Generate schedule proposal
- `/activities` - List activities
- `/clear` - Clear conversation

### Claude Desktop/Mobile (MCP)

Add to your Claude config:

```json
{
  "mcpServers": {
    "life-os": {
      "command": "python",
      "args": ["-m", "lifeos.mcp_server"],
      "cwd": "/path/to/life-os-agent"
    }
  }
}
```

## Configuration

### Activity Schema

```yaml
activities:
  - id: chess              # Unique identifier
    name: "Chess Practice" # Display name
    category: learning     # health, learning, creative, work, life
    frequency: daily       # daily, weekly, or number (3 = 3x/week)
    duration: 30           # minutes, or "30-45" for range
    time_preference: morning  # morning, afternoon, evening, flexible
    days_preference: null     # or: [monday, wednesday, friday]
    location: null            # optional location
```

### Priorities

```yaml
priorities:
  critical: [weights, cardio]     # Never skip
  high: [studio_session, chess]   # Important
  medium: [skill_development]     # Fit when possible
  low: [chores_errands]           # Flexible
```

## Deployment

### Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
```

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install -e .
CMD ["uvicorn", "lifeos.api:app", "--host", "0.0.0.0", "--port", "8080"]
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Interaction Layer             │
│  Telegram │ MCP Server │ REST API │ CLI │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              Agent Core                  │
│  System Prompt + Tools + Claude API     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           Capability Layer              │
│  Calendar │ Memory │ Scheduler │ Config │
└─────────────────────────────────────────┘
```

## Development

```bash
# Run tests
pytest

# Format code
ruff format .

# Lint
ruff check .
```

## Philosophy

The agent operates as a "Day 1 Employee":
- **Knows the job**: Uses your configuration
- **Executes reliably**: Does what you ask
- **Asks when unclear**: Doesn't guess
- **Earns trust over time**: Through consistent work

No fake personality. No unnecessary friction. Just a tool that does its job well.

## License

MIT
