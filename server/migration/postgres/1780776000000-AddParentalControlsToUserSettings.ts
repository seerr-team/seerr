import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentalControlsToUserSettings1780776000000 implements MigrationInterface {
  name = 'AddParentalControlsToUserSettings1780776000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "parentalControlsEnabled" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxMovieCertification" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxTvCertification" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "parentalControlsRegion" character varying NOT NULL DEFAULT 'US'`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blockUnrated" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "blockUnrated"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "parentalControlsRegion"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxTvCertification"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxMovieCertification"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "parentalControlsEnabled"`
    );
  }
}
