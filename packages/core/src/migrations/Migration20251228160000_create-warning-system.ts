import { Migration } from '@mikro-orm/migrations';

export class Migration20251228160000 extends Migration {

  override async up(): Promise<void> {
    // Create warning_types table
    this.addSql(`
      create table "warning_types" (
        "id" serial primary key,
        "guild_id" varchar(24) not null,
        "name" varchar(100) not null,
        "severity" smallint not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "warning_types_guild_id_foreign"
          foreign key ("guild_id")
          references "guilds" ("id")
          on update cascade
          on delete cascade
      );
    `);

    // Add index for guild lookups
    this.addSql(`create index "warning_types_guild_id_index" on "warning_types" ("guild_id");`);

    // Create warnings table
    this.addSql(`
      create table "warnings" (
        "id" serial primary key,
        "guild_id" varchar(24) not null,
        "player_id" varchar(50) not null,
        "warning_type_id" int not null,
        "created_at" timestamptz not null,
        "note" text null,
        constraint "warnings_guild_id_foreign"
          foreign key ("guild_id")
          references "guilds" ("id")
          on update cascade
          on delete cascade,
        constraint "warnings_player_id_foreign"
          foreign key ("player_id")
          references "players" ("ally_code")
          on update cascade
          on delete cascade,
        constraint "warnings_warning_type_id_foreign"
          foreign key ("warning_type_id")
          references "warning_types" ("id")
          on update cascade
          on delete cascade
      );
    `);

    // Add indexes for common queries
    this.addSql(`create index "warnings_guild_id_player_id_index" on "warnings" ("guild_id", "player_id");`);
    this.addSql(`create index "warnings_guild_id_created_at_index" on "warnings" ("guild_id", "created_at");`);
  }

  override async down(): Promise<void> {
    // Drop warnings table first (due to foreign key)
    this.addSql(`drop table if exists "warnings" cascade;`);

    // Drop warning_types table
    this.addSql(`drop table if exists "warning_types" cascade;`);
  }

}
