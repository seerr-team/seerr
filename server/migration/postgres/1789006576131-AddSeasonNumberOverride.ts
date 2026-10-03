import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonNumberOverride1789006576131 implements MigrationInterface {
  name = 'AddSeasonNumberOverride1789006576131';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "overrideTvdbId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD "dispatchedSeasonNumber" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "season" DROP COLUMN "dispatchedSeasonNumber"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "overrideTvdbId"`
    );
  }
}
