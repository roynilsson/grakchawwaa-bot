import { Migration } from '@mikro-orm/migrations';

export class Migration20251200000000 extends Migration {

  override async up(): Promise<void> {
    // Create guilds table
    this.addSql(`
      create table if not exists "guilds" (
        "id" varchar(24) not null,
        "name" varchar(255) null,
        "ticket_collection_channel_id" varchar(20) null,
        "ticket_reminder_channel_id" varchar(20) null,
        "anniversary_channel_id" varchar(20) null,
        "next_ticket_collection_refresh_time" timestamptz null,
        constraint "guilds_pkey" primary key ("id")
      );
    `);

    // Create players table
    this.addSql(`
      create table if not exists "players" (
        "ally_code" varchar(9) not null,
        "discord_id" varchar(255) null,
        "name" varchar(255) null,
        "player_id" varchar(50) null,
        "is_main" boolean not null default false,
        "registered_at" timestamptz not null,
        constraint "players_pkey" primary key ("ally_code")
      );
    `);

    // Create partial unique index for main players
    this.addSql(`
      create unique index if not exists "players_discord_id_unique"
      on "players" ("discord_id")
      where "is_main" = true and "discord_id" is not null;
    `);

    // Create guild_members table
    this.addSql(`
      create table if not exists "guild_members" (
        "guild_id" varchar(24) not null,
        "ally_code" varchar(9) not null,
        "joined_at" timestamptz not null,
        "left_at" timestamptz null,
        "is_active" boolean not null default true,
        "member_level" int null,
        constraint "guild_members_pkey" primary key ("guild_id", "ally_code")
      );
    `);

    // Create guild_members indexes
    this.addSql(`
      create index if not exists "guild_members_guild_id_index"
      on "guild_members" ("guild_id");
    `);

    this.addSql(`
      create index if not exists "guild_members_ally_code_index"
      on "guild_members" ("ally_code");
    `);

    this.addSql(`
      create index if not exists "guild_members_is_active_index"
      on "guild_members" ("is_active");
    `);

    this.addSql(`
      create index if not exists "guild_members_member_level_index"
      on "guild_members" ("member_level");
    `);

    // Create ticket_violations table
    this.addSql(`
      create table if not exists "ticket_violations" (
        "guild_id" varchar(24) not null,
        "player_id" varchar(50) not null,
        "date" timestamptz not null,
        "ticket_count" int not null,
        constraint "ticket_violations_pkey" primary key ("guild_id", "player_id", "date")
      );
    `);

    // Add foreign key constraints
    this.addSql(`
      alter table "guild_members"
      add constraint if not exists "guild_members_guild_id_foreign"
      foreign key ("guild_id") references "guilds" ("id")
      on update cascade on delete cascade;
    `);

    this.addSql(`
      alter table "guild_members"
      add constraint if not exists "guild_members_ally_code_foreign"
      foreign key ("ally_code") references "players" ("ally_code")
      on update cascade on delete cascade;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "guild_members" cascade;`);
    this.addSql(`drop table if exists "ticket_violations" cascade;`);
    this.addSql(`drop table if exists "players" cascade;`);
    this.addSql(`drop table if exists "guilds" cascade;`);
  }

}
