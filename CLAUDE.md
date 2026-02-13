# CLAUDE.md - grakchawwaa-bot

Discord bot for SWGOH guild management. Built with Sapphire Framework + Discord.js.

## Quick Reference

```bash
# Development (all commands run inside Docker)
docker compose up -d              # Start bot (connects to backend network)
docker compose logs -f bot        # View logs
docker compose restart bot        # Restart after code changes
docker compose exec bot pnpm lint # Run linting
docker compose exec bot pnpm test # Run tests
```

**Prerequisite:** The backend must be running first (`cd ../grakchawwaa-backend && docker compose up -d`).

## Project Structure

```
src/
├── commands/
│   ├── player/         # Player registration commands
│   │   ├── register-player.ts
│   │   ├── unregister-player.ts
│   │   └── identify.ts
│   └── guild/          # Guild management commands
│       ├── register-guild.ts
│       ├── get-guild-members.ts
│       ├── ticket-summary.ts
│       ├── register-channel.ts
│       └── ...
├── api/                # Backend API clients
│   ├── base-client.ts
│   ├── player-client.ts
│   ├── guild-client.ts
│   ├── violation-client.ts
│   └── automation-client.ts
├── processors/         # Notification processors
│   ├── NotificationProcessor.ts
│   ├── TicketCollectionNotificationProcessor.ts
│   └── TicketReminderProcessor.ts
├── workers/            # Background workers
│   └── notificationWorker.ts
├── services/           # Business logic
│   ├── cache-service.ts
│   ├── violation-summary.ts
│   └── anniversary-monitor.ts
├── model/              # Type definitions
└── index.ts            # Bot entry point
```

## Key Patterns

### Sapphire Commands
Commands extend `@sapphire/framework` Command class and use slash command registration.

### API Communication
Bot communicates with backend via REST API clients in `src/api/`. Base URL configured via `BACKEND_API_URL` environment variable (defaults to `http://grakchawwaa-backend:3000` in Docker).

### Environment Variables
- `DISCORD_TOKEN` - Bot token (required)
- `BACKEND_API_URL` - Backend API URL (optional, has default)

## Adding Features

### New Command
1. Create command file in appropriate `src/commands/` subdirectory
2. Extend Sapphire Command class
3. Register slash command options
4. Test in Discord

### API Integration
1. Add/update client in `src/api/`
2. Use `BaseClient` for consistent error handling
3. Call from commands or services

## SWGOH Domain

- **Ally Code:** 9-digit unique player identifier (validated in commands)
- **Ticket requirement:** 600 tickets/day
- Tickets reset at guild reset time

## Reference

- Backend API runs on port 3000
