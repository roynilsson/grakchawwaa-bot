import { Migration } from '@mikro-orm/migrations';

export class Migration20251221132624 extends Migration {

  override async up(): Promise<void> {
    // Add player_id column to players table
    this.addSql(`alter table "players" add column "player_id" varchar(50);`);
  }

  override async down(): Promise<void> {
    // Remove player_id column
    this.addSql(`alter table "players" drop column "player_id";`);
  }

}
