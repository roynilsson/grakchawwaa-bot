import { Client } from "pg"
import { setupPostgresClients } from "../src/db/postgres-client"

const initializeHerokuDatabase = async (): Promise<void> => {
  const createTablesQuery = `
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
      echobase_channel_id text
    );

    -- Create a function to delete old records
    CREATE OR REPLACE FUNCTION delete_old_ticket_violations() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      DELETE FROM ticketViolations
      WHERE date < NOW() - INTERVAL '3 months';
      RETURN NULL;
    END;
    $$;

    -- Create or replace the trigger
    DROP TRIGGER IF EXISTS cleanup_old_violations ON ticketViolations;
    
    CREATE TRIGGER cleanup_old_violations
      AFTER INSERT ON ticketViolations
      EXECUTE PROCEDURE delete_old_ticket_violations();

    -- Initial cleanup of old records
    DELETE FROM ticketViolations
    WHERE date < NOW() - INTERVAL '3 months';

    -- TB instances to track different Territory Battle events
    CREATE TABLE IF NOT EXISTS tb_instances (
      id SERIAL PRIMARY KEY,
      guild_id text NOT NULL,
      tb_event_id text NOT NULL,
      start_time timestamp NOT NULL,
      end_time timestamp,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP
    );

    -- Platoon assignments parsed from Echobase messages
    CREATE TABLE IF NOT EXISTS platoon_assignments (
      id SERIAL PRIMARY KEY,
      tb_instance_id integer NOT NULL REFERENCES tb_instances(id) ON DELETE CASCADE,
      zone_id text NOT NULL,
      platoon_number integer NOT NULL,
      squad_number integer NOT NULL,
      slot_number integer NOT NULL,
      assigned_player_name text NOT NULL,
      assigned_unit_name text NOT NULL,
      message_id text,
      assigned_at timestamp DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tb_instance_id, zone_id, platoon_number, squad_number, slot_number)
    );

    -- Unit name mappings (Echobase name -> API identifier)
    CREATE TABLE IF NOT EXISTS unit_name_mappings (
      id SERIAL PRIMARY KEY,
      echobase_name text NOT NULL UNIQUE,
      api_identifier text NOT NULL,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_tb_instances_guild_active ON tb_instances(guild_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_platoon_assignments_tb_instance ON platoon_assignments(tb_instance_id);
    CREATE INDEX IF NOT EXISTS idx_platoon_assignments_zone ON platoon_assignments(zone_id);
    CREATE INDEX IF NOT EXISTS idx_unit_mappings_echobase ON unit_name_mappings(echobase_name);
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
