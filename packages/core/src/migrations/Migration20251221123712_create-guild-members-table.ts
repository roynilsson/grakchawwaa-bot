import { Migration } from '@mikro-orm/migrations';

export class Migration20251221123712 extends Migration {

  override async up(): Promise<void> {
    // Create guild_members table
    this.addSql(`create table "guild_members" ("guild_id" varchar(255) not null, "ally_code" varchar(9) not null, "joined_at" timestamptz not null, "left_at" timestamptz null, "is_active" boolean not null default true, constraint "guild_members_pkey" primary key ("guild_id", "ally_code"));`);

    // Add index on is_active for performance
    this.addSql(`create index "guild_members_is_active_index" on "guild_members" ("is_active");`);

    // Add foreign key constraints
    this.addSql(`alter table "guild_members" add constraint "guild_members_guild_id_foreign" foreign key ("guild_id") references "guilds" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "guild_members" add constraint "guild_members_ally_code_foreign" foreign key ("ally_code") references "players" ("ally_code") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    // Drop guild_members table
    this.addSql(`drop table if exists "guild_members" cascade;`);
  }

}
