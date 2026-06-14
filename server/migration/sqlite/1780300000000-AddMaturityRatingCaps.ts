import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaturityRatingCaps1780300000000 implements MigrationInterface {
  name = 'AddMaturityRatingCaps1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "maxMovieRating" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "maxTvRating" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "ratingBlockUnrated" boolean`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "ratingBlockUnrated"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "maxTvRating"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "maxMovieRating"`);
  }
}
