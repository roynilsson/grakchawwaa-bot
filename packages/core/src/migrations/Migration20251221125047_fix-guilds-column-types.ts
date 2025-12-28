import { Migration } from '@mikro-orm/migrations';

export class Migration20251221125047 extends Migration {

  override async up(): Promise<void> {
    // Drop foreign key constraint temporarily
    this.addSql(`alter table "guild_members" drop constraint "guild_members_guild_id_foreign";`);

    // Fix Guild ID column - SWGOH guild IDs are base64-encoded (22-24 chars)
    this.addSql(`alter table "guilds" alter column "id" type varchar(24) using ("id"::varchar(24));`);

    // Fix channel ID columns - Discord snowflake IDs (up to 20 chars)
    this.addSql(`alter table "guilds" alter column "ticket_collection_channel_id" type varchar(20) using ("ticket_collection_channel_id"::varchar(20));`);
    this.addSql(`alter table "guilds" alter column "ticket_reminder_channel_id" type varchar(20) using ("ticket_reminder_channel_id"::varchar(20));`);
    this.addSql(`alter table "guilds" alter column "anniversary_channel_id" type varchar(20) using ("anniversary_channel_id"::varchar(20));`);

    // Fix timestamp column
    this.addSql(`alter table "guilds" alter column "next_ticket_collection_refresh_time" type timestamptz using (to_timestamp("next_ticket_collection_refresh_time"::bigint / 1000));`);

    // Fix guild_members.guild_id to match guilds.id type
    this.addSql(`alter table "guild_members" alter column "guild_id" type varchar(24) using ("guild_id"::varchar(24));`);

    // Recreate foreign key constraint
    this.addSql(`alter table "guild_members" add constraint "guild_members_guild_id_foreign" foreign key ("guild_id") references "guilds" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    // Drop foreign key constraint temporarily
    this.addSql(`alter table "guild_members" drop constraint "guild_members_guild_id_foreign";`);

    // Revert guild_members.guild_id to varchar(255)
    this.addSql(`alter table "guild_members" alter column "guild_id" type varchar(255) using ("guild_id"::varchar(255));`);

    // Revert to text types
    this.addSql(`alter table "guilds" alter column "id" type text using ("id"::text);`);
    this.addSql(`alter table "guilds" alter column "ticket_collection_channel_id" type text using ("ticket_collection_channel_id"::text);`);
    this.addSql(`alter table "guilds" alter column "ticket_reminder_channel_id" type text using ("ticket_reminder_channel_id"::text);`);
    this.addSql(`alter table "guilds" alter column "anniversary_channel_id" type text using ("anniversary_channel_id"::text);`);

    // Revert timestamp to text
    this.addSql(`alter table "guilds" alter column "next_ticket_collection_refresh_time" type text using (extract(epoch from "next_ticket_collection_refresh_time")::bigint * 1000)::text;`);

    // Recreate foreign key constraint
    this.addSql(`alter table "guild_members" add constraint "guild_members_guild_id_foreign" foreign key ("guild_id") references "guilds" ("id") on update cascade on delete cascade;`);
  }

}
