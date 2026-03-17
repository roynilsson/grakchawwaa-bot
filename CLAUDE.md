# CLAUDE.md - grakchawwaa-bot

Discord bot for SWGOH guild management. Built with Sapphire Framework + Discord.js.

## Quick Reference

```bash
# Development (all commands run inside Docker)
docker compose up -d              # Start bot (connects to backend network)
docker compose logs -f bot        # View logs
docker compose restart bot        # Restart after code changes
docker compose exec bot pnpm lint # Run linting
```

**Prerequisite:** The backend must be running first (`cd ../grakchawwaa-backend && docker compose up -d`).

## Project Structure

```
src/
├── commands/
│   ├── ping.ts             # Health check command
│   ├── player.ts           # Player registration, warnings, leave
│   ├── guild.ts            # Guild info and ticket summaries
│   └── officer.ts          # Officer tools (warn, setup, leave mgmt)
├── api/                    # Backend API clients
│   ├── base-client.ts      # Base client with auth headers
│   ├── player-client.ts
│   ├── guild-client.ts
│   ├── violation-client.ts
│   ├── warning-client.ts
│   ├── leave-client.ts
│   └── automation-client.ts
├── processors/             # Notification processors
│   └── notification/
│       ├── TicketCollectionNotificationProcessor.ts
│       ├── TicketReminderProcessor.ts
│       ├── RaidReminderProcessor.ts
│       ├── WarningSummaryProcessor.ts
│       └── AnniversaryProcessor.ts
├── workers/                # Background workers
│   └── notificationWorker.ts
├── utils/                  # Shared utilities
│   └── embeds.ts           # Discord embed builders
└── index.ts                # Bot entry point
```

## Key Patterns

### Sapphire Commands
Commands extend `@sapphire/framework` Command class with subcommands:

```typescript
public override registerApplicationCommands(registry: Command.Registry) {
  registry.registerChatInputCommand((builder) =>
    builder
      .setName('player')
      .addSubcommand((sub) => sub.setName('register')...)
  );
}
```

### API Communication
Bot communicates with backend via REST API clients in `src/api/`:
- `BACKEND_URL` env var (defaults to `http://grakchawwaa-backend:3000`)
- `INTERNAL_API_KEY` for service-level auth
- `x-caller-ally-code` header for user-level auth in officer commands

### Authentication Flow
```typescript
// For officer commands - pass caller's ally code
await api.warnings.issue(guildId, data, {
  callerAllyCode: interaction.user.allyCode
});

// For automated processors - use API key only
await api.automations.markRun(automationId);
```

## Adding Features

### New Command
1. Add subcommand in appropriate file (`player.ts`, `guild.ts`, `officer.ts`)
2. Register in `registerApplicationCommands`
3. Add handler method `chatInput<Name>`
4. Test in Discord

### New Notification Processor
1. Create processor in `src/processors/notification/`
2. Implement `NotificationProcessor` interface
3. Register in `notificationWorker.ts`

### API Integration
1. Add/update client in `src/api/`
2. Use `BaseClient` for consistent error handling
3. Pass `callerAllyCode` for officer-level operations

## Environment Variables

- `DISCORD_TOKEN` - Bot token (required)
- `BACKEND_URL` - Backend API URL (default: `http://grakchawwaa-backend:3000`)
- `INTERNAL_API_KEY` - API key for backend auth (required)

## SWGOH Domain

- **Ally Code:** 9-digit unique player identifier
- **Ticket requirement:** 600 tickets/day
- Tickets reset at guild reset time
- Officer = member level 3+ or admin flag

## Reference

- Backend API runs on port 3000
- [DEPLOYMENT.md](DEPLOYMENT.md) - Heroku deployment guide
