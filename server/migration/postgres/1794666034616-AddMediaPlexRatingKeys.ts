import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaPlexRatingKeys1794666034616 implements MigrationInterface {
  name = 'AddMediaPlexRatingKeys1794666034616';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" ADD "plexRatingKeys" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "plexRatingKeys"`);
  }
}
