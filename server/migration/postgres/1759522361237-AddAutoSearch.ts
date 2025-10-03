import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoSearch1759522361237 implements MigrationInterface {
  name = 'AddAutoSearch1759522361237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "autoSearch" boolean`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "autoSearch"`
    );
  }
}
