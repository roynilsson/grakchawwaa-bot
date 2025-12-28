import { Migration } from '@mikro-orm/migrations';

export class Migration20251221120046 extends Migration {

  override async up(): Promise<void> {
    // Add new columns
    this.addSql(`alter table "players" add column "name" varchar(255) null;`);
    this.addSql(`alter table "players" add column "is_main" boolean not null default false;`);

    // Set all existing players to is_main = true (since they are the only/main account)
    this.addSql(`update "players" set "is_main" = true;`);

    // Drop the old primary key constraint
    this.addSql(`alter table "players" drop constraint "players_pkey";`);

    // Add new primary key on ally_code
    this.addSql(`alter table "players" add constraint "players_pkey" primary key ("ally_code");`);

    // Add partial unique constraint: only one main player per discord_id
    this.addSql(`create unique index "players_discord_id_main_unique" on "players" ("discord_id") where "is_main" = true;`);

    // Drop alt_ally_codes column
    this.addSql(`alter table "players" drop column "alt_ally_codes";`);
  }

  override async down(): Promise<void> {
    // Add back alt_ally_codes column
    this.addSql(`alter table "players" add column "alt_ally_codes" text[] not null default '{}';`);

    // Drop partial unique index
    this.addSql(`drop index "players_discord_id_main_unique";`);

    // Drop current primary key
    this.addSql(`alter table "players" drop constraint "players_pkey";`);

    // Restore original primary key on discord_id
    this.addSql(`alter table "players" add constraint "players_pkey" primary key ("discord_id");`);

    // Drop new columns
    this.addSql(`alter table "players" drop column "is_main";`);
    this.addSql(`alter table "players" drop column "name";`);
  }

}
