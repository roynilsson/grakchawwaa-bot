import { Migration } from '@mikro-orm/migrations';

export class Migration20251228120000 extends Migration {

  override async up(): Promise<void> {
    // Add member_level column to guild_members table
    this.addSql(`
      alter table "guild_members"
      add column "member_level" smallint null;
    `);

    // Add comment to document the memberLevel values
    this.addSql(`
      comment on column "guild_members"."member_level" is
      'SWGOH member level: 2=member, 3=officer, 4=leader';
    `);

    // Add index for permission checks
    this.addSql(`
      create index "guild_members_member_level_idx"
      on "guild_members" ("member_level");
    `);
  }

  override async down(): Promise<void> {
    // Drop index
    this.addSql(`drop index if exists "guild_members_member_level_idx";`);

    // Remove column
    this.addSql(`alter table "guild_members" drop column "member_level";`);
  }

}
