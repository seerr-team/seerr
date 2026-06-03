import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestProfileId1778284800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "requestProfileId" integer NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite does not support DROP COLUMN directly; create a new table without the column
    await queryRunner.query(
      `CREATE TABLE "media_request_backup" AS SELECT id, status, mediaId, requestedById, modifiedById, createdAt, updatedAt, type, is4k, serverId, profileId, rootFolder, languageProfileId, tags, isAutoRequest FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "media_request_backup" RENAME TO "media_request"`
    );
  }
}
