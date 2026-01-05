import { Migration } from '@mikro-orm/migrations';

export class Migration20251200000000 extends Migration {

  override async up(): Promise<void> {
    // Create guildMessageChannels table (old schema structure)
    this.addSql(`
      create table if not exists "guildMessageChannels" (
        "guild_id" text not null,
        "ticket_collection_channel_id" text null,
        "next_ticket_collection_refresh_time" text null,
        "ticket_reminder_channel_id" text null,
        "anniversary_channel_id" text null,
        constraint "guildMessageChannels_pkey" primary key ("guild_id")
      );
    `);

    // Create players table (old schema structure)
    this.addSql(`
      create table if not exists "players" (
        "discord_id" text not null,
        "ally_code" char(9) not null,
        "alt_ally_codes" char(9)[],
        "registered_at" timestamp not null default CURRENT_TIMESTAMP,
        constraint "players_pkey" primary key ("discord_id")
      );
    `);

    // Create ticketViolations table (old schema structure)
    this.addSql(`
      create table if not exists "ticketViolations" (
        "guild_id" text not null,
        "date" timestamp not null default CURRENT_TIMESTAMP,
        "ticket_counts" jsonb not null,
        constraint "ticketViolations_pkey" primary key ("guild_id", "date")
      );
    `);

    // Create cleanup function and trigger for old violations
    this.addSql(`
      CREATE OR REPLACE FUNCTION delete_old_ticket_violations() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        DELETE FROM "ticketViolations"
        WHERE date < NOW() - INTERVAL '3 months';
        RETURN NULL;
      END;
      $$;
    `);

    this.addSql(`
      DROP TRIGGER IF EXISTS cleanup_old_violations ON "ticketViolations";
    `);

    this.addSql(`
      CREATE TRIGGER cleanup_old_violations
        AFTER INSERT ON "ticketViolations"
        EXECUTE PROCEDURE delete_old_ticket_violations();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop trigger if exists cleanup_old_violations on "ticketViolations";`);
    this.addSql(`drop function if exists delete_old_ticket_violations();`);
    this.addSql(`drop table if exists "ticketViolations" cascade;`);
    this.addSql(`drop table if exists "players" cascade;`);
    this.addSql(`drop table if exists "guildMessageChannels" cascade;`);
  }

}
