import { Client } from "pg"
import { setupPostgresClients } from "../src/db/postgres-client"

// NOTE: This setup script is deprecated in favor of migrations.
// For production deployment, use `pnpm migrate:up:prod` instead.
// This file is kept for legacy compatibility only.

const initializeHerokuDatabase = async (): Promise<void> => {
  const createTablesQuery = `
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

    -- Create a function to delete old records
    CREATE OR REPLACE FUNCTION delete_old_ticket_violations() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      DELETE FROM ticket_violations
      WHERE date < NOW() - INTERVAL '3 months';
      RETURN NULL;
    END;
    $$;

    -- Create or replace the trigger
    DROP TRIGGER IF EXISTS cleanup_old_violations ON ticket_violations;

    CREATE TRIGGER cleanup_old_violations
      AFTER INSERT ON ticket_violations
      EXECUTE PROCEDURE delete_old_ticket_violations();

    -- Initial cleanup of old records
    DELETE FROM ticket_violations
    WHERE date < NOW() - INTERVAL '3 months';
  `

  const client = new Client({
    connectionString: process.env.PG_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    await client.connect()
    await client.query(createTablesQuery)
    console.log("Heroku database tables created successfully.")
  } catch (error) {
    console.error("Error creating Heroku database tables:", error)
  } finally {
    await client.end()
  }
}

;(async () => {
  try {
    setupPostgresClients()
    await initializeHerokuDatabase()
    console.log("Heroku database initialization complete.")
  } catch (error) {
    console.error("Error during Heroku database initialization:", error)
  }
})()
