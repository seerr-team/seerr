import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaSourcesJson1772200000000 implements MigrationInterface {
  name = 'AddMediaSourcesJson1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" ADD "mediaSources" text`);
    await queryRunner.query(`ALTER TABLE "media" ADD "mediaSources4k" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mediaSources4k"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mediaSources"`);
  }
}
