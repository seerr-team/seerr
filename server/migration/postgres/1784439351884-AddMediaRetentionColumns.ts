import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaRetentionColumns1784439351884 implements MigrationInterface {
  name = 'AddMediaRetentionColumns1784439351884';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "retentionDays" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "availableSince" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "movieRetentionDays" integer`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "tvRetentionDays" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
