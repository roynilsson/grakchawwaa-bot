import { Migration } from '@mikro-orm/migrations';

export class Migration20251221135309 extends Migration {

  override async up(): Promise<void> {
    // Make discord_id nullable - players can exist without being registered to Discord users
    this.addSql(`alter table "players" alter column "discord_id" drop not null;`);

    // Drop the partial unique index that requires discord_id
    this.addSql(`drop index if exists "players_discord_id_main_unique";`);

    // Recreate it to allow NULL discord_id values
    this.addSql(`create unique index "players_discord_id_main_unique" on "players" ("discord_id") where "discord_id" is not null and "is_main" = true;`);
  }

  override async down(): Promise<void> {
    // Revert: Make discord_id required again
    // Note: This will fail if there are NULL discord_id values
    this.addSql(`alter table "players" alter column "discord_id" set not null;`);

    // Drop and recreate the index without NULL handling
    this.addSql(`drop index if exists "players_discord_id_main_unique";`);
    this.addSql(`create unique index "players_discord_id_main_unique" on "players" ("discord_id") where "is_main" = true;`);
  }

}
