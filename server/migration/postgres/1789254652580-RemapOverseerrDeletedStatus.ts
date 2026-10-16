import type { MigrationInterface, QueryRunner } from 'typeorm';

// Hand written as its data only because Overseerr's MediaStatus.DELETED = 6
// collides with our BLOCKLISTED, so rows from an imported database read as blocklisted.
// see https://github.com/seerr-team/seerr/issues/3508
export class RemapOverseerrDeletedStatus1789257612345 implements MigrationInterface {
  name = 'RemapOverseerrDeletedStatus1789257612345';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "season" SET "status" = 7 WHERE "status" = 6`
    );
    await queryRunner.query(
      `UPDATE "season" SET "status4k" = 7 WHERE "status4k" = 6`
    );
    await queryRunner.query(
      `UPDATE "media" SET "status" = 7 WHERE "status" = 6 AND NOT EXISTS (SELECT 1 FROM "blocklist" WHERE "blocklist"."tmdbId" = "media"."tmdbId" AND "blocklist"."mediaType" = "media"."mediaType")`
    );
    await queryRunner.query(
      `UPDATE "media" SET "status4k" = 7 WHERE "status4k" = 6 AND NOT EXISTS (SELECT 1 FROM "blocklist" WHERE "blocklist"."tmdbId" = "media"."tmdbId" AND "blocklist"."mediaType" = "media"."mediaType")`
    );
  }

  public async down(): Promise<void> {
    // Intentionally left empty as remapped rows are indistinguishable from rows
    // that were already DELETED.
  }
}
