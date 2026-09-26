import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentalControlColumns1788464882569 implements MigrationInterface {
  name = 'AddParentalControlColumns1788464882569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxMovieRating" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxTvRating" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blockUnrated" boolean DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "blockUnrated"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxTvRating"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxMovieRating"`
    );
  }
}
