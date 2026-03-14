# Grakchawwaa Bot - Discord Bot

Discord bot for Star Wars: Galaxy of Heroes guild management.

## Overview

The bot provides Discord slash commands for player registration, guild management, and officer tools. It also handles automated notifications from the backend (ticket violations, raid reminders, anniversaries).

**Configuration is done via the web dashboard** - the bot executes automations configured there.

## Technology Stack

- **Framework:** Sapphire (Discord.js wrapper)
- **Discord.js:** v14+
- **Language:** TypeScript
- **Runtime:** Node.js 16+
- **API Client:** HTTP client to grakchawwaa-backend

## Commands

### Player Commands (`/player`)

| Command | Description |
|---------|-------------|
| `/player register <ally-code> [is-alt] [discord-user]` | Register a player with an ally code |
| `/player unregister <ally-code>` | Unregister a player by ally code |
| `/player identify` | Show your registered ally codes (main + alts) |

### Guild Commands (`/guild`)

| Command | Description |
|---------|-------------|
| `/guild members [name] [ally-code]` | List guild members (optional name filter) |
| `/guild tickets <days>` | Generate ticket violation summary (1-90 days) |

### Officer Commands (`/officer`)

These commands require officer or leader status in your SWGOH guild (member level 3+).

| Command | Description |
|---------|-------------|
| `/officer setup register-guild` | Register your guild with the bot |
| `/officer setup channel-add <channel> [ally-code]` | Pre-approve a Discord channel for bot use |
| `/officer setup channel-remove <channel> [ally-code]` | Remove a pre-approved channel |
| `/officer warn <player> <type> [note] [ally-code]` | Issue a warning to a guild member |

### Utility Commands

| Command | Description |
|---------|-------------|
| `/ping` | Check if the bot is online and responsive |

## Automated Features

The bot processes notifications triggered by the backend's automation system:

### Ticket Collection Notifications
- Posts daily ticket violation summaries to configured Discord channels
- Lists players who didn't reach 600 tickets
- Configurable via web dashboard

### Ticket Reminders
- Sends reminder notifications before daily reset
- Configurable reminder hours (e.g., 2 hours before reset)
- @mentions players who haven't reached 600 tickets

### Raid Reminders
- Monitors Krayt Dragon, Naboo, and Order 66 raids
- Sends notifications when players are below configured targets
- Configurable reminder hours before raid end

### Anniversary Notifications
- Posts guild member anniversary messages
- Celebrates time in guild milestones

## Project Structure

```
grakchawwaa-bot/
├── src/
│   ├── commands/           # Slash command handlers
│   │   ├── ping.ts
│   │   ├── player.ts
│   │   ├── guild.ts
│   │   └── officer.ts
│   ├── api/                # Backend API clients
│   │   ├── base-client.ts
│   │   ├── player-client.ts
│   │   ├── guild-client.ts
│   │   ├── violation-client.ts
│   │   └── automation-client.ts
│   ├── services/           # Business logic
│   │   ├── violation-summary.ts
│   │   └── cache.ts
│   ├── processors/         # Notification processors
│   │   └── notification/
│   ├── workers/            # Background workers
│   │   └── notification-worker.ts
│   └── index.ts            # Bot entry point
├── docker-compose.yml
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 16+
- pnpm
- Docker and Docker Compose
- A Discord bot application (for development)
- Running grakchawwaa-backend instance

### Environment Variables

Create `.env.dev`:

```bash
NODE_ENV=development
PORT=3200
APP_NAME=grakchawwaa

# Discord Bot
DISCORD_APPLICATION_ID=your_app_id
DISCORD_TOKEN=your_bot_token
DISCORD_PUBLIC_KEY=your_public_key

# Backend API
BACKEND_URL=http://grakchawwaa-backend:3000
INTERNAL_API_KEY=your_api_key

# (Legacy - if running locally without Docker)
PGUSER=grakchawwaa
PGHOST=localhost
PGPORT=5432
PGPASSWORD=dev_password
PGDATABASE=grakchawwaa_dev
```

### Development (Docker - Recommended)

```bash
# Start bot container (connects to backend network)
docker compose up -d

# View logs
docker compose logs -f bot

# Restart after code changes
docker compose restart bot

# Run linting
docker compose exec bot pnpm lint
```

### Local Development

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm dev
```

## Discord Bot Setup

To create your own Discord bot for development:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to `DISCORD_TOKEN`
5. Go to "OAuth2" > "URL Generator"
6. Select scopes: `bot`, `applications.commands`
7. Select permissions: `Send Messages`, `Embed Links`, `Read Message History`
8. Use generated URL to add bot to your test server

## Architecture

```
Discord <---> Bot <---> Backend API
                           |
                           v
                      PostgreSQL
```

The bot:
1. Receives slash commands from Discord
2. Calls the backend API for data/actions
3. Responds to Discord with results
4. Polls for due automations and processes notifications

## Deployment

This bot runs as a **worker dyno only** on Heroku (not a web dyno).

After deploying, scale the web dyno to 0:

```bash
heroku ps:scale web=0 worker=1 -a your-app-name
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Related Projects

- **grakchawwaa-backend** - REST API (data source)
- **grakchawwaa-web** - Web dashboard (automation configuration)
- **grakchawwaa-comlink** - SWGOH game data proxy

## License

MIT
