# Life OS Agent

**AI-powered personal time orchestration system**

Life OS Agent is a personal scheduling assistant that uses Claude to manage the allocation of time across all life domains—work, health, creative pursuits, skill development, and maintenance.

> **Calendar is the UI. Memory is the database. Chat is the interface.**

## Overview

Rather than building a complex application, Life OS Agent leverages existing tools (Google Calendar) as the primary interface while providing an intelligent layer that understands your goals, interests, and constraints—and can dynamically schedule time to pursue them.

### Key Features

- **Natural Language Interface**: Chat with the agent to manage your schedule
- **Smart Scheduling**: Automatically propose time blocks based on your configured activities
- **Persistent Memory**: Remember your preferences and patterns over time (via Mem0)
- **Calendar Integration**: Read and write directly to Google Calendar
- **Conflict Resolution**: Understand priorities and make tradeoffs
- **Gap Analysis**: Find unscheduled time and suggest how to fill it

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Docker & Docker Compose (for Mem0)
- A Google Cloud account (for Calendar API)
- An Anthropic API key

### 2. Installation

```bash
# Clone or navigate to the life-os-agent directory
cd life-os-agent

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install the package
pip install -e ".[dev]"
```

### 3. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys
# Required: ANTHROPIC_API_KEY
```

### 4. Start Memory Service (Mem0)

```bash
# Start Mem0 and Qdrant in Docker
docker-compose up -d

# Verify it's running
curl http://localhost:8080/health
```

### 5. Configure Google Calendar

See [Google Calendar Setup](#google-calendar-setup) below for detailed instructions.

### 6. Create Your Configuration

```bash
# Generate a sample configuration
lifeos init

# Edit config/life-os-config.yaml with your schedule
```

### 7. Start Using Life OS

```bash
# Authenticate with Google Calendar
lifeos auth

# Start chatting with the agent
lifeos chat
```

---

## Detailed Setup Guide

### Google Calendar Setup

Life OS Agent needs access to your Google Calendar. Here's how to set it up:

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Life OS Agent" (or similar)
4. Click "Create"

#### Step 2: Enable the Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and click "Enable"

#### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal if using Google Workspace)
   - App name: "Life OS Agent"
   - Support email: Your email
   - Add your email to "Test users"
4. For Application type, select "Desktop app"
5. Name it "Life OS CLI"
6. Click "Create"

#### Step 4: Download Credentials

1. Click the download icon next to your new OAuth client
2. Save the file as `credentials.json` in your `life-os-agent` directory
3. **Important**: Never commit this file to git

#### Step 5: Authenticate

```bash
lifeos auth
```

This will open a browser window. Sign in and grant calendar access. A `token.json` file will be created (also don't commit this).

---

### Mem0 Setup (Self-Hosted)

Life OS uses Mem0 for persistent memory. The included `docker-compose.yml` sets up:

- **Qdrant**: Vector database for semantic search
- **Mem0**: Memory API service

#### Starting the Services

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove data
docker-compose down -v
```

#### Verifying Mem0 is Running

```bash
# Health check
curl http://localhost:8080/health

# Should return: {"status": "ok"}
```

#### Using Without Mem0 (Development)

For quick testing without Docker, use the simple memory flag:

```bash
lifeos chat --simple-memory
```

This stores memories in a local JSON file instead.

---

### Configuration Guide

The `config/life-os-config.yaml` file defines your life structure. Key sections:

#### Meta

```yaml
meta:
  version: "1.0"
  user: "Your Name"
  timezone: "America/Los_Angeles"
```

#### Template (Weekly Structure)

```yaml
template:
  work:
    days: [monday, tuesday, wednesday, thursday, friday]
    start: "09:00"
    end: "17:00"
  sleep:
    target_bedtime: "23:00"
    target_wake: "07:00"
```

#### Activities

```yaml
activities:
  - id: exercise          # Unique identifier
    name: "Exercise"      # Display name
    category: health      # Category for grouping
    frequency: 3          # Times per week (or "daily", "weekly", "2-3")
    duration: 45          # Minutes (or "45-60" for range)
    time_preference: morning  # morning, afternoon, evening, flexible
    days_preference: [monday, wednesday, friday]
```

#### Priorities

```yaml
priorities:
  critical: [exercise]    # Never skip
  high: [reading]         # Skip only if necessary
  medium: [skill_dev]     # Flexible
  low: [chores]           # Nice to have
```

---

## CLI Commands

### Interactive Chat

```bash
lifeos chat                    # Start interactive session
lifeos chat --simple-memory    # Use local JSON memory
```

### Schedule Management

```bash
lifeos plan-week               # Get a schedule proposal
lifeos plan-week --start 2026-01-27
lifeos show-week               # View current schedule
lifeos show-week --days 14     # View 14 days
```

### Analysis

```bash
lifeos analyze                 # Compare scheduled vs. required
lifeos analyze --weeks 4       # Analyze 4 weeks
lifeos gaps                    # Find unscheduled time
lifeos gaps --duration 60      # Find 1+ hour gaps
```

### Configuration

```bash
lifeos config                  # Show config summary
lifeos validate                # Check config for errors
lifeos activities              # List all activities
lifeos activities --category health
```

### Memory

```bash
lifeos memories                # View stored memories
lifeos forget <memory_id>      # Delete a memory
```

### Setup

```bash
lifeos init                    # Create sample config
lifeos auth                    # Authenticate with Google
```

---

## Example Conversations

### Planning Your Week

```
You: Plan my week

Agent: Looking at your week starting Monday, January 20...

**Currently Scheduled:**
- Monday 6:00 AM: Gym Class (Weights)
- Tuesday 7:45 AM: Adobe Gym (Cardio)
...

**Missing Activities:**
- Chess Practice: Need 7 sessions, have 0 (deficit: 7)
- Instrument Practice: Need 7 sessions, have 0 (deficit: 7)
- Studio Session: Need 2 sessions, have 0 (deficit: 2)

**Proposed Schedule:**
1. Monday 8:00-8:30 AM: Chess Practice
2. Monday 4:15-4:30 PM: Instrument Practice
...

Would you like me to add these to your calendar?
```

### Adding an Activity

```
You: I want to start learning woodworking, maybe 2 hours on weekends

Agent: I can add woodworking as a new activity. Based on your current schedule:

**Saturdays:**
- 10 AM - 1 PM: Hike (already scheduled)
- 2-5 PM: Usually Errands/Chores

I could slot woodworking into Saturday 2-4 PM, which would reduce your chores block from 3 hours to 1 hour.

Would you like me to:
1. Add it at Saturday 2-4 PM
2. Try Sunday afternoon instead
3. Alternate weeks with other activities
```

### Quick Queries

```
You: What's on my calendar tomorrow?

Agent: Tomorrow (Tuesday, Jan 21):
- 7:00 AM: Leave for office
- 7:45-8:30 AM: Cardio at Adobe gym
- 9:00 AM - 4:00 PM: Work
- 4:15-6:30 PM: Studio session at Dismal Nitch
- 7:00 PM: Home, easy dinner

You have skill development time open from 8:00-10:45 PM if you want to work on something.
```

---

## Project Structure

```
life-os-agent/
├── README.md                 # This file
├── pyproject.toml            # Python package config
├── docker-compose.yml        # Mem0 + Qdrant services
├── .env.example              # Environment template
├── .gitignore
│
├── config/
│   └── life-os-config.yaml   # Your life configuration
│
├── src/lifeos/
│   ├── __init__.py
│   ├── agent.py              # Main agent class
│   ├── calendar.py           # Google Calendar integration
│   ├── cli.py                # Command-line interface
│   ├── config.py             # Configuration parsing
│   ├── memory.py             # Mem0 integration
│   └── scheduler.py          # Scheduling logic
│
└── tests/
    └── ...
```

---

## Troubleshooting

### "Credentials file not found"

```bash
# Make sure credentials.json is in the right place
ls -la credentials.json

# Or set the path explicitly in .env
GOOGLE_CREDENTIALS_FILE=/path/to/credentials.json
```

### "Token has been expired or revoked"

```bash
# Delete the old token and re-authenticate
rm token.json
lifeos auth
```

### "Error connecting to memory service"

```bash
# Check if Mem0 is running
docker-compose ps

# If not, start it
docker-compose up -d

# Check logs for errors
docker-compose logs mem0
```

### "Configuration error"

```bash
# Validate your config
lifeos validate

# Common issues:
# - YAML indentation
# - Missing required fields (id, name, category, frequency, duration)
# - Invalid time format (use "HH:MM")
```

---

## Development

### Running Tests

```bash
pip install -e ".[dev]"
pytest
```

### Code Formatting

```bash
black src/
ruff check src/ --fix
```

### Type Checking

```bash
mypy src/
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  CLI (lifeos chat)        │  Google Calendar (view/edit)        │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  LifeOSAgent (Claude + Tools)                                    │
│  ├── Calendar Tools (Google Calendar API)                       │
│  ├── Memory Tools (Mem0)                                        │
│  ├── Config Tools (life-os-config.yaml)                         │
│  └── Scheduler (template matching, gap analysis)                │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Mem0 + Qdrant        │  YAML Config          │  Google Calendar │
│  (Memories)           │  (Life Structure)     │  (Events)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Roadmap

- [ ] **Telegram Bot**: Chat with Life OS from anywhere
- [ ] **Web Dashboard**: Visual config editor
- [ ] **Pattern Detection**: Learn from skipped/modified events
- [ ] **Proactive Suggestions**: "You haven't done chess in 3 days"
- [ ] **Goal Tracking**: Connect activities to longer-term objectives
- [ ] **Multi-Calendar Support**: Better handling of shared calendars

---

## License

MIT

---

## Acknowledgments

- [Anthropic](https://anthropic.com) - Claude API
- [Mem0](https://mem0.ai) - Memory layer
- [Google Calendar API](https://developers.google.com/calendar)
