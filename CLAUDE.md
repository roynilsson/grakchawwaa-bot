# Grakchawwaa Bot - Discord Bot for SWGOH Guild Management

## Overview

**grakchawwaa-bot** is a Discord bot for managing Star Wars: Galaxy of Heroes (SWGOH) guilds. It automates ticket collection monitoring, celebrates member anniversaries, and helps guild leaders track player participation.

**Repository:** `git@github.com:roynilsson/grakchawwaa-bot`
**License:** MIT License (Copyright 2022 Shay DeWael)
**Status:** Production-ready, actively maintained (191+ commits)
**Deployment:** Heroku worker dyno

## Technology Stack

### Core Technologies
- **Language:** TypeScript 5.9.3
- **Runtime:** Node.js 24.x
- **Package Manager:** pnpm 10.10.0
- **Framework:** Sapphire Framework 5.4.0 (Discord.js wrapper)
- **Discord Library:** discord.js 14.24.2
- **Database:** PostgreSQL 16

### Key Dependencies
- **@swgoh-utils/comlink** (^1.4.1) - SWGOH game API client
- **@sapphire/framework** (^5.4.0) - Command handling framework
- **pg** (^8.16.3) - PostgreSQL client

### Development Tools
- **Testing:** Jest 30.2.0 with ts-jest
- **Linting:** ESLint 9.39.1
- **Formatting:** Prettier 3.6.2
- **CI/CD:** GitHub Actions

## Project Structure

```
grakchawwaa-bot/
├── src/
│   ├── api/                  # Backend API clients (NEW)
│   │   ├── base-client.ts   # HTTP client with retry logic
│   │   └── player-client.ts # Player API endpoints
│   ├── commands/              # Discord slash commands
│   │   ├── guild/            # Guild management (direct DB)
│   │   │   ├── register-ticket-collection.ts
│   │   │   ├── register-anniversary-channel.ts
│   │   │   ├── get-guild-members.ts
│   │   │   └── ticket-summary.ts
│   │   └── player/           # Player management (Backend API)
│   │       ├── register-player.ts    # Migrated to API
│   │       ├── unregister-player.ts  # Migrated to API
│   │       └── identify.ts           # Migrated to API
│   ├── db/                   # Database clients (for guild commands)
│   │   ├── postgres-client.ts
│   │   ├── player-client.ts
│   │   ├── guild-message-channels-client.ts
│   │   └── ticket-violation-client.ts
│   ├── services/             # Background services
│   │   ├── ticket-monitor.ts       # Automated ticket checking
│   │   ├── anniversary-monitor.ts  # Guild anniversary tracking
│   │   └── violation-summary.ts    # Weekly/monthly reports
│   └── index.ts              # Application entry point
├── infra/                    # Infrastructure scripts
│   ├── db-schema.ts         # Database schema
│   └── setupDockerDB.ts     # Local DB setup
├── docker-compose.yml       # Docker network + shared backend network
├── Dockerfile               # Container configuration
├── package.json
└── Procfile                 # Heroku configuration
```

## Database Schema (Current Implementation)

The bot uses a **simplified schema** with 3 tables (Note: This differs from the full ARCHITECTURE.md specification):

### 1. players
```sql
CREATE TABLE players (
  discord_id VARCHAR(20) PRIMARY KEY,
  ally_code CHAR(9) NOT NULL,
  alt_ally_codes TEXT[] DEFAULT '{}',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
Links Discord users to SWGOH ally codes (9-digit game identifiers).

### 2. ticketViolations
```sql
CREATE TABLE ticketViolations (
  guild_id VARCHAR(24),
  date TIMESTAMPTZ,
  ticket_counts JSONB NOT NULL,
  PRIMARY KEY (guild_id, date)
);
```
Stores daily ticket violation data per guild as JSON.

### 3. guildMessageChannels
```sql
CREATE TABLE guildMessageChannels (
  guild_id VARCHAR(24) PRIMARY KEY,
  ticket_collection_channel_id VARCHAR(20),
  next_ticket_collection_refresh_time TIMESTAMPTZ,
  ticket_reminder_channel_id VARCHAR(20),
  anniversary_channel_id VARCHAR(20)
);
```
Configures Discord notification channels per SWGOH guild.

## Core Features

### 1. Ticket Collection Monitoring
**File:** [src/services/ticket-monitor.ts](src/services/ticket-monitor.ts)

- Monitors daily raid ticket contributions (600 tickets required per player)
- Runs 2 minutes before daily reset time
- Sends violation reports to configured Discord channels
- Stores historical violation data

**Commands:**
- `/register-ticket-collection` - Configure monitoring for a guild
- `/ticket-summary` - View weekly/monthly violation summaries

### 2. Anniversary Notifications
**File:** [src/services/anniversary-monitor.ts](src/services/anniversary-monitor.ts)

- Celebrates guild membership milestones (1+ years)
- Daily check at noon UTC
- Posts messages to configured anniversary channel
- Special formatting for 3+ and 5+ year milestones

**Commands:**
- `/register-anniversary-channel` - Configure anniversary notifications

### 3. Player Registration (Backend API)
**Files:** [src/api/player-client.ts](src/api/player-client.ts), [src/commands/player/](src/commands/player/)

- Links Discord accounts to SWGOH ally codes via REST API
- Supports main and alternate account registration
- Used for player identification and reporting

**Commands:**
- `/register-player <ally_code> [is-alt]` - Register main or alt account
- `/identify` - Display registered ally codes (main + alts)
- `/unregister-player <ally_code>` - Remove registration

**Implementation:** Player commands now consume the grakchawwaa-backend REST API instead of direct database access.

### 4. Guild Management
**Files:** [src/commands/guild/](src/commands/guild/)

- View guild member rosters
- Officer/leader permission checks
- Guild channel configuration

**Commands:**
- `/get-guild-members` - List all guild members

## Development Workflow

### Environment Setup

**Local Development (Docker):**
```bash
# Start bot container (connects to backend network)
docker-compose up -d

# Initialize database (if not using backend)
pnpm docker:setup

# Run in development mode (single-run checks)
pnpm dev
```

**Environment Variables:**
```bash
# Discord Configuration
DISCORD_TOKEN=<bot_token>

# Backend API (for player commands)
BACKEND_API_URL=http://grakchawwaa-backend:3000

# Database (for guild commands - legacy)
PGHOST=postgres
PGPORT=5432
PGDATABASE=grakchawwaa
PGUSER=grakchawwaa
PGPASSWORD=grakchawwaa

# SWGOH Comlink API
COMLINK_URL=<comlink_instance_url>
COMLINK_ACCESS_KEY=<access_key>
COMLINK_SECRET_KEY=<secret_key>
```

**Production (Heroku):**
- PostgreSQL with SSL
- Worker dyno only (no web dyno)
- Environment variables: `PG_DATABASE_URL`, `DISCORD_TOKEN`, `BACKEND_API_URL`, `COMLINK_*`

### NPM Scripts
```bash
pnpm build        # Compile TypeScript
pnpm dev          # Development mode (single-run)
pnpm prod         # Production mode (scheduled)
pnpm test         # Run Jest tests
pnpm lint         # ESLint check
pnpm format       # Prettier formatting
pnpm docker:setup # Initialize database
```

### CI/CD Pipeline
**File:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

On PR/push to main:
1. Build TypeScript
2. Run ESLint
3. Run Jest tests

## SWGOH API Integration

### Comlink API
**Files:** [src/services/comlink/](src/services/comlink/)

Self-hosted SWGOH game data API providing:
- Player profiles (`/player` endpoint)
- Guild rosters with ticket counts (`/guild/{guildId}` endpoint)
- Real-time game data

**Authentication:** Access key + secret key headers
**Rate Limiting:** 5-second minimum delay between requests
**Caching:** Implemented via `cached-comlink-client.ts`

## Docker Configuration

**File:** [docker-compose.yml](docker-compose.yml)

The bot runs in a Docker container that connects to the backend network for API communication:

```yaml
services:
  bot:
    build: .
    container_name: grakchawwaa-bot
    environment:
      BACKEND_API_URL: http://grakchawwaa-backend:3000
    networks:
      - grakchawwaa-network

networks:
  grakchawwaa-network:
    external: true
    name: grakchawwaa-backend_grakchawwaa-network
```

**Key Points:**
- Connects to external backend network for API communication
- Uses container name `grakchawwaa-backend` for service discovery
- Backend API URL defaults to `http://grakchawwaa-backend:3000`

## Key Configuration Files

- [package.json](package.json) - Dependencies and scripts
- [tsconfig.json](tsconfig.json) - TypeScript strict mode configuration
- [docker-compose.yml](docker-compose.yml) - Container configuration with backend network
- [Dockerfile](Dockerfile) - Container image definition
- [Procfile](Procfile) - Heroku worker configuration
- [infra/db-schema.ts](infra/db-schema.ts) - Database initialization

## Deployment

**Platform:** Heroku
**Documentation:** [DEPLOYMENT.md](DEPLOYMENT.md)

**Critical:** After deployment, scale web dyno to 0:
```bash
heroku ps:scale web=0 --app grakchawwaa
```

The bot requires only a worker dyno (no HTTP endpoints).

## Testing

**Framework:** Jest with ts-jest
**Test Files:** [src/tests/](src/tests/)

Coverage includes:
- Ticket monitor service
- Anniversary monitor service
- Violation summary service
- Database client operations

## Important Notes

### Schema Differences
This bot implementation uses a **simplified database schema** compared to the full ARCHITECTURE.md specification:

**Current (Bot):**
- 3 tables: players, ticketViolations, guildMessageChannels
- `discord_id` as primary key in players table
- Simplified ticket violation storage (JSONB)

**Architecture Spec:**
- 6 tables: players, guilds, guild_members, ticket_violations, warning_types, warnings
- `ally_code` as primary key in players table
- Soft-delete guild membership tracking
- Warning system for non-ticket violations

### Backend API Migration (In Progress)

**Completed:**
- ✅ Player commands migrated to REST API
  - `/register-player` uses `POST /api/players`
  - `/unregister-player` uses `DELETE /api/players/:allyCode`
  - `/identify` uses `GET /api/players?discordId=...`
- ✅ Docker network integration for bot ↔ backend communication
- ✅ API client with retry logic and error handling

**Remaining:**
- ❌ Guild commands still use direct database access
- ❌ Ticket monitoring service still uses direct database access
- ❌ Anniversary monitoring service still uses direct database access

When migration is complete:
- Data migration scripts will be needed to transform existing data
- Warning system and enhanced reporting features can be added
- Bot will fully consume backend API instead of direct database access

## Related Projects

- **grakchawwaa-web** - Next.js web interface (under construction)
- **grakchawwaa-backend** - PHP/Symfony REST API backend (planned)
- **ARCHITECTURE.md** - Complete system architecture specification

## Development Status

**Active Development:** 191+ commits since January 2024
**Production Status:** Fully operational on Heroku
**Recent Focus:** TypeScript strict mode compliance, infrastructure improvements

## License

MIT License (Copyright 2022 Shay DeWael, Author: ExeAy)
