"""Command-line interface for Life OS Agent."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

# Load environment variables
load_dotenv()

console = Console()


def get_agent(simple_memory: bool = False):
    """Get an initialized agent instance."""
    from .agent import LifeOSAgent

    config_path = os.environ.get("LIFEOS_CONFIG_PATH", "config/life-os-config.yaml")
    return LifeOSAgent(config_path=config_path, use_simple_memory=simple_memory)


@click.group()
@click.version_option(version="0.1.0")
def main():
    """Life OS Agent - AI-powered personal time orchestration."""
    pass


@main.command()
@click.option("--simple-memory", is_flag=True, help="Use local JSON instead of Mem0")
def chat(simple_memory: bool):
    """Start an interactive chat session with Life OS Agent."""
    console.print(
        Panel.fit(
            "[bold blue]Life OS Agent[/bold blue]\n"
            "Your personal scheduling assistant.\n"
            "Type 'quit' or 'exit' to end the session.",
            title="Welcome",
        )
    )

    try:
        agent = get_agent(simple_memory=simple_memory)
    except FileNotFoundError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("\nRun 'lifeos init' to create a configuration file.")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error initializing agent:[/red] {e}")
        sys.exit(1)

    while True:
        try:
            user_input = Prompt.ask("\n[bold green]You[/bold green]")

            if user_input.lower() in ("quit", "exit", "q"):
                console.print("[dim]Goodbye![/dim]")
                break

            if not user_input.strip():
                continue

            with console.status("[dim]Thinking...[/dim]"):
                response = agent.chat(user_input)

            console.print("\n[bold blue]Agent[/bold blue]")
            console.print(Markdown(response))

        except KeyboardInterrupt:
            console.print("\n[dim]Session ended.[/dim]")
            break
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")


@main.command()
@click.option("--start", "start_date", help="Start date (YYYY-MM-DD)")
@click.option("--simple-memory", is_flag=True, help="Use local JSON instead of Mem0")
def plan_week(start_date: str | None, simple_memory: bool):
    """Generate a schedule proposal for the week."""
    agent = get_agent(simple_memory=simple_memory)

    if start_date:
        prompt = f"Plan my week starting {start_date}. Show me what I have scheduled and what activities I'm missing, then propose times to fill the gaps."
    else:
        prompt = "Plan my week. Show me what I have scheduled and what activities I'm missing, then propose times to fill the gaps."

    console.print("[dim]Analyzing your week...[/dim]\n")

    with console.status("[dim]Thinking...[/dim]"):
        response = agent.chat(prompt)

    console.print(Markdown(response))


@main.command()
@click.option("--start", "start_date", help="Start date (YYYY-MM-DD)")
@click.option("--days", default=7, help="Number of days to show")
@click.option("--simple-memory", is_flag=True, help="Use local JSON instead of Mem0")
def show_week(start_date: str | None, days: int, simple_memory: bool):
    """Display the current week's schedule."""
    agent = get_agent(simple_memory=simple_memory)

    if start_date:
        prompt = f"Show me my schedule for {days} days starting {start_date}. List each day with its events."
    else:
        prompt = f"Show me my schedule for the next {days} days. List each day with its events."

    with console.status("[dim]Loading schedule...[/dim]"):
        response = agent.chat(prompt)

    console.print(Markdown(response))


@main.command()
@click.option("--category", help="Filter by category")
def activities(category: str | None):
    """List all registered activities."""
    from .config import load_config

    config = load_config()

    table = Table(title="Life OS Activities")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Category")
    table.add_column("Frequency")
    table.add_column("Duration (min)")
    table.add_column("Priority")

    for activity in config.activities:
        if category and activity.category != category:
            continue

        priority = config.get_activity_priority(activity.id)
        priority_color = {
            "critical": "red",
            "high": "yellow",
            "medium": "blue",
            "low": "dim",
        }.get(priority, "white")

        table.add_row(
            activity.id,
            activity.name,
            activity.category,
            str(activity.frequency),
            str(activity.duration),
            f"[{priority_color}]{priority}[/{priority_color}]",
        )

    console.print(table)


@main.command()
def config():
    """Show current configuration summary."""
    from .config import load_config

    config = load_config()

    console.print(Panel.fit(f"[bold]Life OS Configuration[/bold]\nUser: {config.meta.user}"))

    # Work schedule
    work = config.template.work
    console.print(f"\n[bold]Work Schedule:[/bold]")
    console.print(f"  Days: {', '.join(work.days)}")
    console.print(f"  Hours: {work.start} - {work.end}")

    # Activities summary
    console.print(f"\n[bold]Activities:[/bold] {len(config.activities)} registered")

    categories = {}
    for activity in config.activities:
        categories[activity.category] = categories.get(activity.category, 0) + 1

    for cat, count in sorted(categories.items()):
        console.print(f"  {cat}: {count}")

    # Commitments
    console.print(f"\n[bold]Fixed Commitments:[/bold] {len(config.commitments)}")
    for commitment in config.commitments[:5]:
        console.print(f"  - {commitment.name}")
    if len(config.commitments) > 5:
        console.print(f"  ... and {len(config.commitments) - 5} more")


@main.command()
def validate():
    """Validate the configuration file."""
    from .config import load_config

    try:
        config = load_config()
        console.print("[green]Configuration is valid![/green]")
        console.print(f"  User: {config.meta.user}")
        console.print(f"  Activities: {len(config.activities)}")
        console.print(f"  Commitments: {len(config.commitments)}")
    except FileNotFoundError as e:
        console.print(f"[red]Configuration file not found:[/red] {e}")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Configuration error:[/red] {e}")
        sys.exit(1)


@main.command()
def auth():
    """Authenticate with Google Calendar."""
    from .calendar import CalendarClient

    console.print("[bold]Google Calendar Authentication[/bold]\n")

    credentials_file = os.environ.get("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    if not Path(credentials_file).exists():
        console.print(f"[red]Error:[/red] Credentials file not found: {credentials_file}")
        console.print("\nTo set up Google Calendar authentication:")
        console.print("1. Go to https://console.cloud.google.com/")
        console.print("2. Create a new project (or select existing)")
        console.print("3. Enable the Google Calendar API")
        console.print("4. Create OAuth 2.0 credentials (Desktop application)")
        console.print("5. Download the credentials JSON file")
        console.print(f"6. Save it as '{credentials_file}' in this directory")
        sys.exit(1)

    try:
        client = CalendarClient()
        client.authenticate()
        console.print("[green]Successfully authenticated with Google Calendar![/green]")

        # Show calendars
        calendars = client.list_calendars()
        console.print(f"\nFound {len(calendars)} calendars:")
        for cal in calendars[:10]:
            primary = " (primary)" if cal.get("primary") else ""
            console.print(f"  - {cal.get('summary')}{primary}")

    except Exception as e:
        console.print(f"[red]Authentication failed:[/red] {e}")
        sys.exit(1)


@main.command()
def memories():
    """Show stored memories."""
    try:
        from .memory import MemoryClient

        client = MemoryClient()
        user_id = os.environ.get("LIFEOS_USER_ID", "kevin")

        memories = client.get_all(user_id=user_id, limit=20)

        if not memories:
            console.print("[dim]No memories stored yet.[/dim]")
            return

        table = Table(title="Stored Memories")
        table.add_column("ID", style="dim", max_width=12)
        table.add_column("Content", max_width=60)
        table.add_column("Category", style="cyan")

        for memory in memories:
            content = memory.get("content", memory.get("memory", ""))
            if len(content) > 60:
                content = content[:57] + "..."

            table.add_row(
                memory.get("id", "")[:12],
                content,
                memory.get("metadata", {}).get("category", ""),
            )

        console.print(table)

    except Exception as e:
        console.print(f"[red]Error connecting to memory service:[/red] {e}")
        console.print("\nMake sure Mem0 is running: docker-compose up -d")


@main.command()
@click.argument("memory_id")
def forget(memory_id: str):
    """Delete a specific memory."""
    try:
        from .memory import MemoryClient

        client = MemoryClient()
        client.delete(memory_id)
        console.print(f"[green]Memory deleted:[/green] {memory_id}")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")


@main.command()
@click.option("--start", "start_date", help="Start date (YYYY-MM-DD)")
@click.option("--weeks", default=1, help="Number of weeks to analyze")
def analyze(start_date: str | None, weeks: int):
    """Analyze time allocation vs. requirements."""
    from .calendar import CalendarClient
    from .config import load_config
    from .scheduler import Scheduler

    config = load_config()
    scheduler = Scheduler(config)
    calendar = CalendarClient()

    if start_date:
        start = datetime.fromisoformat(start_date)
    else:
        start, _ = scheduler.get_week_bounds()

    end = start + timedelta(weeks=weeks * 7)

    with console.status("[dim]Analyzing schedule...[/dim]"):
        events = calendar.list_events(time_min=start, time_max=end)
        analysis = scheduler.analyze_scheduled_vs_required(events, start, end)

    table = Table(title=f"Schedule Analysis ({start.strftime('%b %d')} - {end.strftime('%b %d')})")
    table.add_column("Activity", style="green")
    table.add_column("Required", justify="center")
    table.add_column("Scheduled", justify="center")
    table.add_column("Status", justify="center")
    table.add_column("Priority")

    for activity_id, data in sorted(analysis.items(), key=lambda x: x[1]["priority"]):
        req_sessions = data["required_sessions"]
        sched_sessions = data["scheduled_sessions"]
        deficit = data["sessions_deficit"]

        if deficit > 0:
            status = f"[red]-{deficit}[/red]"
        elif sched_sessions > req_sessions[1]:
            status = f"[yellow]+{sched_sessions - req_sessions[1]}[/yellow]"
        else:
            status = "[green]OK[/green]"

        priority_color = {
            "critical": "red",
            "high": "yellow",
            "medium": "blue",
            "low": "dim",
        }.get(data["priority"], "white")

        table.add_row(
            data["activity"].name,
            f"{req_sessions[0]}-{req_sessions[1]}",
            str(sched_sessions),
            status,
            f"[{priority_color}]{data['priority']}[/{priority_color}]",
        )

    console.print(table)


@main.command()
@click.option("--date", "target_date", help="Date to find gaps (YYYY-MM-DD)")
@click.option("--duration", default=30, help="Minimum gap duration in minutes")
def gaps(target_date: str | None, duration: int):
    """Find unscheduled time slots."""
    from .calendar import CalendarClient
    from .config import load_config
    from .scheduler import Scheduler

    config = load_config()
    scheduler = Scheduler(config)
    calendar = CalendarClient()

    if target_date:
        start = datetime.fromisoformat(target_date)
    else:
        start = datetime.now()

    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)

    with console.status("[dim]Finding gaps...[/dim]"):
        events = calendar.list_events(time_min=start, time_max=end)
        slots = scheduler.get_available_slots(events, start, end, min_duration=duration)

    if not slots:
        console.print(f"[dim]No gaps of {duration}+ minutes found.[/dim]")
        return

    table = Table(title=f"Available Time Slots (>= {duration} min)")
    table.add_column("Day", style="cyan")
    table.add_column("Start", style="green")
    table.add_column("End", style="green")
    table.add_column("Duration", justify="right")

    for slot in slots:
        table.add_row(
            slot.start.strftime("%A"),
            slot.start.strftime("%I:%M %p"),
            slot.end.strftime("%I:%M %p"),
            f"{slot.duration_minutes} min",
        )

    console.print(table)


@main.command()
def init():
    """Create a sample configuration file."""
    config_path = Path("config/life-os-config.yaml")

    if config_path.exists():
        if not click.confirm(f"{config_path} already exists. Overwrite?"):
            console.print("[dim]Cancelled.[/dim]")
            return

    config_path.parent.mkdir(parents=True, exist_ok=True)

    sample_config = """# Life OS Configuration
# Edit this file to customize your schedule

meta:
  version: "1.0"
  user: "Your Name"
  timezone: "America/Los_Angeles"

template:
  work:
    days: [monday, tuesday, wednesday, thursday, friday]
    start: "09:00"
    end: "17:00"
    lunch:
      start: "12:00"
      duration: 60

  sleep:
    target_bedtime: "23:00"
    target_wake: "07:00"
    wind_down: 15

commitments:
  - name: "Weekly Team Meeting"
    day: monday
    start: "10:00"
    end: "11:00"
    note: "Required attendance"

activities:
  - id: exercise
    name: "Exercise"
    category: health
    frequency: 3
    duration: 45
    time_preference: morning
    note: "Gym or home workout"

  - id: reading
    name: "Reading"
    category: learning
    frequency: daily
    duration: 30
    time_preference: evening

  - id: skill_dev
    name: "Skill Development"
    category: growth
    frequency: 3
    duration: 90
    time_preference: [afternoon, evening]
    sub_interests:
      - name: "Project 1"
        current_priority: high
      - name: "Project 2"
        current_priority: medium

priorities:
  critical:
    - exercise
  high:
    - reading
  medium:
    - skill_dev
  low: []

calendars:
  primary: "your-email@gmail.com"

event_format:
  prefix: ""
  include_category: false
"""

    with open(config_path, "w") as f:
        f.write(sample_config)

    console.print(f"[green]Created configuration file:[/green] {config_path}")
    console.print("\nNext steps:")
    console.print("1. Edit config/life-os-config.yaml with your schedule")
    console.print("2. Run 'lifeos auth' to connect Google Calendar")
    console.print("3. Run 'lifeos chat' to start using the agent")


if __name__ == "__main__":
    main()
