export const CREATE_TABLES_QUERY = `
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
    anniversary_channel_id text,
    warning_summary_channel_id text
  );

  CREATE TABLE IF NOT EXISTS warningTypes (
    id SERIAL PRIMARY KEY,
    guild_id text NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    weight integer NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_warning_types_guild_id ON warningTypes(guild_id);

  CREATE TABLE IF NOT EXISTS warnings (
    id SERIAL PRIMARY KEY,
    guild_id text NOT NULL,
    ally_code char(9) NOT NULL,
    warning_type_id integer NOT NULL REFERENCES warningTypes(id) ON DELETE CASCADE,
    notes text,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by text
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_guild_id ON warnings(guild_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_ally_code ON warnings(ally_code);
  CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_warnings_guild_ally ON warnings(guild_id, ally_code);
`

