# CLAUDE.md - Project Context for AI Assistants

## Project Overview

**grakchawwaa-bot** is a Discord bot for Star Wars: Galaxy of Heroes (SWGOH) guild management. It helps guilds track ticket collection, monitor player anniversaries, and manage guild member information.

## Tech Stack

- **Runtime:** Node.js 24.x
- **Language:** TypeScript 5.9.3
- **Framework:** [Sapphire Framework](https://www.sapphirejs.dev/) (Discord.js wrapper)
- **Database:** PostgreSQL 16
- **Package Manager:** pnpm 10.10.0
- **External API:** SWGOH Comlink (game data API)
- **Testing:** Jest
- **Deployment:** Heroku (worker dyno only)

## Project Structure

```
├── src/
│   ├── commands/          # Discord slash commands (User interaction layer)
│   │   ├── guild/         # Guild management commands
│   │   └── player/        # Player management commands
│   ├── db/                # Database clients (Data access layer - Repository pattern)
│   ├── services/          # Business logic services (Application layer)
│   │   ├── comlink/       # SWGOH Comlink API integration
│   │   ├── ticket-monitor.ts
│   │   ├── anniversary-monitor.ts
│   │   └── violation-summary.ts
│   ├── model/             # Data models (Domain entities)
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions (Pure functions, no business logic)
│   ├── tests/             # Test files
│   ├── index.ts           # Main entry point
│   └── discord-bot-client.ts
├── migrations/            # Database migration files (node-pg-migrate)
├── infra/                 # Infrastructure scripts (DB setup, command reset)
├── docs/                  # Legal documents (ToS, Privacy Policy)
├── docker-compose.yml     # Local PostgreSQL setup
└── package.json
```

## Architecture & Design Patterns

### Layered Architecture

The bot follows a clean layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│  Commands Layer (src/commands/)          │  ← User interaction via Discord
│  - Handles Discord interactions          │
│  - Input validation                      │
│  - Response formatting                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Services Layer (src/services/)          │  ← Business logic & orchestration
│  - Business rules                        │
│  - Orchestrates multiple data sources    │
│  - Calls external APIs (Comlink)         │
│  - Transforms data for presentation      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Database Layer (src/db/)                │  ← Data persistence (Repository)
│  - CRUD operations only                  │
│  - No business logic                     │
│  - No external API calls                 │
│  - Direct SQL queries via pg library     │
└─────────────────────────────────────────┘
```

### Folder Responsibilities

#### `/src/commands/` - Discord Command Handlers
**Role:** Handle user interactions, validate input, format responses

**Responsibilities:**
- Parse Discord command options
- Validate user input (ally codes, channel IDs, permissions)
- Call appropriate services to execute business logic
- Format and send Discord responses (embeds, buttons, etc.)
- Handle Discord-specific errors (permission denied, channel not found)

**Rules:**
- ✅ Can call services from `src/services/`
- ✅ Can call database clients from `src/db/`
- ✅ Should handle Discord-specific formatting
- ❌ Should NOT contain complex business logic
- ❌ Should NOT call external APIs directly (use services)

**Example:** `/register-player` command validates ally code format, calls service to register, formats success message

#### `/src/services/` - Business Logic Layer
**Role:** Implement business rules, orchestrate operations, integrate external APIs

**Responsibilities:**
- Implement core business logic (ticket violation rules, anniversary calculations)
- Orchestrate multiple data sources (database + Comlink API)
- Call external APIs (Comlink for game data)
- Transform data between layers (API → Domain models)
- Cache external API responses
- Background jobs (monitoring, scheduled tasks)

**Rules:**
- ✅ Can call database clients from `src/db/`
- ✅ Can call external APIs (Comlink)
- ✅ Contains business logic and validation rules
- ✅ Can transform and aggregate data from multiple sources
- ❌ Should NOT handle Discord-specific formatting
- ❌ Should NOT directly interact with Discord API

**Example:** `TicketMonitorService` fetches guild data from Comlink, queries player database, applies violation rules, stores results

#### `/src/db/` - Database Repository Layer
**Role:** Encapsulate all database access, provide clean data access API

**Responsibilities:**
- Execute SQL queries via `pg` library
- Map database rows to domain models
- Handle database connection pooling
- Provide CRUD operations (Create, Read, Update, Delete)
- Handle database-specific errors

**Rules:**
- ✅ Pure data access - CRUD operations only
- ✅ Return domain models from `src/model/`
- ✅ Handle SQL queries and transactions
- ❌ NO business logic whatsoever
- ❌ NO calls to external APIs (Comlink, Discord, etc.)
- ❌ NO data transformation beyond mapping DB → model
- ❌ NO validation beyond basic type checking

**Example:** `PlayerPGClient` provides `getPlayersByDiscordId()`, `registerAllyCode()`, `removeAllyCode()` - just database operations

#### `/src/services/comlink/` - External API Integration
**Role:** Interface with SWGOH Comlink API

**Responsibilities:**
- Wrap Comlink API calls
- Implement caching to reduce API load
- Handle rate limiting and retries
- Map Comlink responses to internal models

**Rules:**
- ✅ Only responsible for Comlink API communication
- ✅ Should cache responses
- ✅ Should handle API-specific errors (503, rate limits)
- ❌ Should NOT contain business logic
- ❌ Should NOT access database

**Example:** `CachedComlinkClient.getPlayer(allyCode)` fetches player data from Comlink with caching

#### `/src/model/` - Domain Models
**Role:** Define data structures used throughout the application

**Responsibilities:**
- TypeScript interfaces for domain entities
- No logic, just data structure definitions

**Example:** `Player`, `DiscordPlayer` interfaces

#### `/src/utils/` - Utility Functions
**Role:** Pure utility functions with no side effects

**Responsibilities:**
- String formatting (ally codes, dates)
- Validation helpers
- Pure functions only

**Rules:**
- ✅ Pure functions (same input → same output)
- ❌ NO database access
- ❌ NO API calls
- ❌ NO business logic

**Example:** `normalizeAllyCode()` formats ally codes consistently

## Core Functionality

### 1. Ticket Collection Monitoring
- Monitors guild members' ticket contributions (600 tickets per day expected)
- Posts daily summaries to a configured Discord channel
- Tracks violations and generates reports

### 2. Anniversary Notifications
- Tracks when players joined their guild
- Posts anniversary messages to a configured channel

### 3. Guild Management
- Fetch guild member lists via ally codes
- Player registration system linking Discord users to SWGOH accounts

## Key Services

### TicketMonitorService
- Runs periodic checks (every 6 hours)
- Fetches guild data from Comlink API
- Identifies ticket violations
- Posts summaries to Discord

### AnniversaryMonitorService
- Checks for player guild anniversaries
- Posts celebration messages

### ViolationSummaryService
- Formats violation reports
- Handles "Show Full List" button interactions

### ComlinkService
- Interfaces with SWGOH Comlink API for game data
- Caches player/guild data to reduce API calls

## Database Schema

### Migration System
The bot uses [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) for database version control.

**Commands:**
```bash
# Development
pnpm migrate:up          # Apply migrations
pnpm migrate:down        # Rollback last migration
pnpm migrate:create      # Create new migration

# Production
pnpm migrate:up:prod     # Apply migrations to production
pnpm migrate:down:prod   # Rollback production migration
```

### Tables

#### `guilds`
SWGOH guild master table
- `guild_id` (text, PK) - SWGOH guild ID
- `guild_name` (text) - Guild name
- `discord_server_id` (text) - Discord server ID
- `created_at`, `updated_at` (timestamp)

#### `guild_configs`
Flexible key-value configuration for guilds
- `guild_id` (text, PK) - FK to guilds
- `name` (text, PK) - Config key (e.g., "ticket_collection_channel_id")
- `value` (text) - Config value

**Common config keys:**
- `ticket_collection_channel_id` - Discord channel for ticket summaries
- `next_ticket_collection_refresh_time` - Unix timestamp for next check
- `ticket_reminder_channel_id` - Discord channel for reminders
- `anniversary_channel_id` - Discord channel for anniversary messages

#### `players`
Player registrations - one row per ally code
- `ally_code` (char(9), PK) - SWGOH ally code
- `discord_id` (text) - Discord user ID
- `alt` (integer) - 1 = primary account, 2+ = alt accounts
- `player_id` (text) - SWGOH player ID from Comlink
- `player_name` (text) - Player name from Comlink
- `guild_id` (text) - SWGOH guild ID from Comlink
- `registered_at` (timestamp)
- UNIQUE constraint on `(discord_id, alt)`

**Important:** Each ally code is a separate row. A Discord user with multiple accounts has multiple rows.

#### `ticket_violations`
Historical ticket violation records
- `guild_id` (text, PK) - SWGOH guild ID
- `date` (timestamp, PK) - Date of violation check
- `ticket_counts` (jsonb) - JSON object with player ticket data

## Development Setup

### Prerequisites
- Node.js 24.x
- pnpm
- Docker & Docker Compose
- Discord Bot Token
- SWGOH Comlink instance (self-hosted API)

### Environment Variables (.env.dev)
```bash
NODE_ENV=development
PORT=3200
APP_NAME=grakchawaa

# Required: Discord Bot Configuration
# Get from: https://discord.com/developers/applications
DISCORD_APPLICATION_ID=your_app_id
DISCORD_TOKEN=your_bot_token
DISCORD_PUBLIC_KEY=your_public_key

# Database (use 'postgres' for Docker, 'localhost' for local)
PGUSER=grakchawwaa
PGHOST=postgres  # Use 'localhost' if running bot locally
PGPORT=5432
PGPASSWORD=dev_password
PGDATABASE=grakchawwaa_dev

# Optional: SWGOH Comlink (can be left empty for basic testing)
COMLINK_URL=
COMLINK_ACCESS_KEY=
COMLINK_SECRET_KEY=
```

### Quick Start (Docker - Recommended)
```bash
# 1. Create .env.dev with Discord credentials (see above)

# 2. Start all services (PostgreSQL + Bot with Node.js 24)
docker compose up -d

# 3. Create database tables
docker exec -i grakchawwaa-postgres psql -U grakchawwaa -d grakchawwaa_dev << 'EOF'
CREATE TABLE IF NOT EXISTS players (
  discord_id text NOT NULL PRIMARY KEY,
  ally_code char(9) NOT NULL,
  alt_ally_codes char(9)[],
  registered_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticketViolations (
  guild_id text NOT NULL,
  date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ticket_counts jsonb NOT NULL,
  PRIMARY KEY (guild_id, date)
);

CREATE TABLE IF NOT EXISTS guildMessageChannels (
  guild_id text NOT NULL PRIMARY KEY,
  ticket_collection_channel_id text,
  next_ticket_collection_refresh_time text,
  ticket_reminder_channel_id text,
  anniversary_channel_id text
);
EOF

# 4. View logs
docker compose logs -f bot

# 5. Invite bot to your server
# https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&permissions=2147534848&scope=bot%20applications.commands
```

### Alternative: Local Setup
```bash
# Requires Node.js 24.x installed locally
# 1. Install dependencies
pnpm install

# 2. Start only PostgreSQL in Docker
docker compose up -d postgres

# 3. Update PGHOST=localhost in .env.dev

# 4. Create database tables (same SQL as above via psql)

# 5. Run bot locally
pnpm dev
```

### Docker Commands
- `docker compose up -d` - Start all services in background
- `docker compose logs -f bot` - Follow bot logs
- `docker compose restart bot` - Restart bot (e.g., after env changes)
- `docker compose down` - Stop all services
- `docker compose down -v` - Stop and delete database volume

### Testing
```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage
```

## Important Notes

1. **Comlink Dependency:** The bot requires a self-hosted SWGOH Comlink instance. This is an unofficial API that extracts data from the game. See: https://github.com/swgoh-utils/swgoh-comlink

2. **Heroku Deployment:**
   - Runs as worker dyno (not web)
   - Must scale web dyno to 0: `pnpm heroku-scale-web-zero`
   - See [DEPLOYMENT.md](./DEPLOYMENT.md) for details

3. **Discord Bot Setup:**
   - Create application at https://discord.com/developers/applications
   - Enable these intents in Bot settings:
     - ✅ Message Content Intent (privileged)
     - ✅ Server Members Intent
     - ✅ Presence Intent
   - Generate OAuth2 invite URL with `bot` + `applications.commands` scopes

4. **Rate Limiting:** The bot implements caching to avoid hitting Comlink rate limits

5. **Legal Docs:** Terms of Service and Privacy Policy are published via GitHub Pages (see [docs/README.md](./docs/README.md))

6. **Commit Messages:** This project uses conventional commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`)

## Commands (Slash Commands)

All commands are registered as Discord slash commands using the Sapphire framework.

### Guild Commands
- `/register-ticket-collection` - Start monitoring ticket collection
- `/unregister-ticket-collection` - Stop monitoring
- `/register-anniversary-channel` - Setup anniversary notifications
- `/unregister-anniversary-channel` - Remove notifications
- `/get-guild-members` - List all guild members

### Player Commands
- `/register-player` - Link Discord user to ally code
- `/unregister-player` - Remove player registration
- `/identify` - Show registered player info

### Utility Commands
- `/ping` - Bot health check

## Code Patterns

### Sapphire Framework
The bot uses Sapphire's command structure:
- Commands are classes extending `Command` from `@sapphire/framework`
- Placed in `src/commands/` directory
- Auto-discovered and registered

### Database Access
- Uses `pg` library directly (no ORM)
- Client instances created via `setupPostgresClients()`
- Separate client classes for each domain (`player-client.ts`, `guild-message-channels-client.ts`, etc.)

### Service Pattern
- Services encapsulate business logic
- Initialized in `index.ts`
- Use dependency injection where applicable

## Testing Strategy

- Jest for unit/integration tests
- Tests colocated with source in `__tests__/` directories
- Test files mirror source structure
- Coverage tracking enabled

## Contributing

1. Follow existing code patterns
2. Use TypeScript strict mode
3. Run `pnpm lint` and `pnpm format` before committing
4. Add tests for new features
5. Update this file if adding major features/changes

## Useful Resources

- [Sapphire Framework Docs](https://www.sapphirejs.dev/)
- [Discord.js Docs](https://discord.js.org/)
- [SWGOH Comlink](https://github.com/swgoh-utils/swgoh-comlink)
- [SWGOH Comlink Utils](https://github.com/swgoh-utils/swgoh-utils)

## Recent Changes (from git log)

- ✨ Implement success notification for perfect ticket collection
- 📝 Add timestamp on registration for legal reasons
- 📝 Revise Privacy Policy and Terms of Service
- 📝 Update description format in configuration file
- Legal documentation improvements (#17)
