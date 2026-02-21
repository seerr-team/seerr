import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserContentRatingLimits1765557160380 implements MigrationInterface {
  name = 'AddUserContentRatingLimits1765557160380';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxMovieRating" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxTvRating" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxTvRating"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxMovieRating"`
    );
  }
}
