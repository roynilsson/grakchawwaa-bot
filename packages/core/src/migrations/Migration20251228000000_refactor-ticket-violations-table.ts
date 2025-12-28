import { Migration } from '@mikro-orm/migrations';

export class Migration20251228000000 extends Migration {

  override async up(): Promise<void> {
    // Create new ticket_violations table with proper structure
    this.addSql(`
      create table "ticket_violations" (
        "guild_id" varchar(24) not null,
        "player_id" varchar(50) not null,
        "date" timestamptz not null,
        "ticket_count" int not null,
        constraint "ticket_violations_pkey" primary key ("guild_id", "player_id", "date")
      );
    `);

    // Add index for common queries
    this.addSql(`create index "ticket_violations_date_idx" on "ticket_violations" ("date");`);
    this.addSql(`create index "ticket_violations_player_id_idx" on "ticket_violations" ("player_id");`);

    // Migrate data from old ticketViolations table to new ticket_violations table
    this.addSql(`
      insert into "ticket_violations" (guild_id, player_id, date, ticket_count)
      select
        tv.guild_id,
        (jsonb_each(tv.ticket_counts)).key as player_id,
        tv.date,
        ((jsonb_each(tv.ticket_counts)).value)::text::int as ticket_count
      from "ticketViolations" tv;
    `);

    // Drop old ticketViolations table
    this.addSql(`drop table "ticketViolations";`);
  }

  override async down(): Promise<void> {
    // Recreate old ticketViolations table
    this.addSql(`
      create table "ticketViolations" (
        "guild_id" varchar(24) not null,
        "date" timestamptz not null,
        "ticket_counts" jsonb not null,
        constraint "ticketViolations_pkey" primary key ("guild_id", "date")
      );
    `);

    // Migrate data back to old structure
    this.addSql(`
      insert into "ticketViolations" (guild_id, date, ticket_counts)
      select
        guild_id,
        date,
        jsonb_object_agg(player_id, ticket_count) as ticket_counts
      from "ticket_violations"
      group by guild_id, date;
    `);

    // Drop new ticket_violations table
    this.addSql(`drop table "ticket_violations";`);
  }

}
