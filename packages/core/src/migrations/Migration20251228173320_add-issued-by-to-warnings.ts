import { Migration } from '@mikro-orm/migrations';

export class Migration20251228173320 extends Migration {

  override async up(): Promise<void> {
    this.addSql('alter table "warnings" add column "issued_by" varchar(9) null;');
    this.addSql('alter table "warnings" add constraint "warnings_issued_by_foreign" foreign key ("issued_by") references "players" ("ally_code") on update cascade on delete set null;');
  }

  override async down(): Promise<void> {
    this.addSql('alter table "warnings" drop constraint if exists "warnings_issued_by_foreign";');
    this.addSql('alter table "warnings" drop column if exists "issued_by";');
  }

}
