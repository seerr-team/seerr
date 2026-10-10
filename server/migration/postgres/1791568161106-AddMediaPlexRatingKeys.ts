import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaPlexRatingKeys1791568161106 implements MigrationInterface {
  name = 'AddMediaPlexRatingKeys1791568161106';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" ADD "plexRatingKeys" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "plexRatingKeys"`);
  }
}
