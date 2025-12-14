// NOTE: This schema is deprecated in favor of migrations.
// Use `pnpm migrate:up:prod` for production database setup.
// This file is kept for reference and backward compatibility.

export const CREATE_TABLES_QUERY = `
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id text PRIMARY KEY,
    guild_name text,
    discord_server_id text,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
  );

  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id text NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    PRIMARY KEY (guild_id, name),
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS players (
    ally_code char(9) PRIMARY KEY,
    discord_id text NOT NULL,
    alt integer DEFAULT 1 NOT NULL,
    player_id text UNIQUE,
    player_name text,
    guild_id text,
    registered_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (discord_id, alt),
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_violations (
    guild_id text NOT NULL,
    date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ticket_counts jsonb NOT NULL,
    PRIMARY KEY (guild_id, date),
    FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
  );

  -- Function to automatically delete old ticket violations
  CREATE OR REPLACE FUNCTION delete_old_ticket_violations()
  RETURNS TRIGGER AS $$
  BEGIN
    DELETE FROM ticket_violations
    WHERE date < NOW() - INTERVAL '3 months';
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  -- Trigger to call the cleanup function after inserts
  DROP TRIGGER IF EXISTS cleanup_old_violations ON ticket_violations;
  CREATE TRIGGER cleanup_old_violations
  AFTER INSERT ON ticket_violations
  FOR EACH STATEMENT
  EXECUTE FUNCTION delete_old_ticket_violations();
`
