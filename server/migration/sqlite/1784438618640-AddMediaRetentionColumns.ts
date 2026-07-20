import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaRetentionColumns1784438618640 implements MigrationInterface {
  name = 'AddMediaRetentionColumns1784438618640';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Plain nullable columns - ADD COLUMN (SQLite 3.1.0+) avoids the
    // destructive temp-table recreate TypeORM would otherwise use.
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "retentionDays" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN "availableSince" datetime`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "movieRetentionDays" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "tvRetentionDays" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DROP COLUMN (SQLite 3.35.0+); none of these columns are indexed/keyed.
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "tvRetentionDays"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "movieRetentionDays"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "availableSince"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "retentionDays"`
    );
  }
}
