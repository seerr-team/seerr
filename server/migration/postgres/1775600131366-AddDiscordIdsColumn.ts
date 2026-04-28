import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscordIdsColumn1775600131366 implements MigrationInterface {
  name = 'AddDiscordIdsColumn1775600131366';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "discordIds" text`
    );
    // same for postgres (convert existing single ID into list with one entry)
    await queryRunner.query(
      `UPDATE "user_settings" SET "discordIds" = '["' || "discordId" || '"]' WHERE "discordId" IS NOT NULL AND "discordId" != ''`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "discordIds"`
    );
  }
}
