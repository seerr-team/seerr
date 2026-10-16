import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscordIdsColumn1779783365432 implements MigrationInterface {
  name = 'AddDiscordIdsColumn1779783365432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "discordIds" text`
    );
    // same for postgres (convert existing single ID into list with one entry)
    await queryRunner.query(
      `UPDATE "user_settings" SET "discordIds" = '["' || "discordId" || '"]' WHERE "discordId" IS NOT NULL AND "discordId" != ''`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "discordId"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "discordId" character varying`
    );
    await queryRunner.query(
      `UPDATE "user_settings" SET "discordId" = ("discordIds"::jsonb ->> 0) WHERE "discordIds" IS NOT NULL AND "discordIds" != ''`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "discordIds"`
    );
  }
}
