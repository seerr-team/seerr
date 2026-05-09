import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoSearch1778290530007 implements MigrationInterface {
  name = 'AddAutoSearch1778290530007';

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
