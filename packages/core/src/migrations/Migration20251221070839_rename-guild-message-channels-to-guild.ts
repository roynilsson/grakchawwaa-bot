import { Migration } from '@mikro-orm/migrations';

export class Migration20251221070839 extends Migration {

  override async up(): Promise<void> {
    // Rename table
    this.addSql(`alter table "guildMessageChannels" rename to "guilds";`);

    // Rename primary key column guild_id -> id
    this.addSql(`alter table "guilds" rename column "guild_id" to "id";`);

    // Add name column for guild display name (nullable)
    this.addSql(`alter table "guilds" add column "name" varchar(255) null;`);
  }

  override async down(): Promise<void> {
    // Remove name column
    this.addSql(`alter table "guilds" drop column "name";`);

    // Rename primary key column id -> guild_id
    this.addSql(`alter table "guilds" rename column "id" to "guild_id";`);

    // Rename table back
    this.addSql(`alter table "guilds" rename to "guildMessageChannels";`);
  }

}
