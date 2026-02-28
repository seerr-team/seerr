import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentRatingFilters1736000000000
  implements MigrationInterface
{
  name = 'AddContentRatingFilters1736000000000';

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
