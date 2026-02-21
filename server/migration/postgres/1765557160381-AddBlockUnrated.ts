import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockUnrated1765557160381 implements MigrationInterface {
  name = 'AddBlockUnrated1765557160381';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blockUnrated" boolean DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "blockUnrated"`
    );
  }
}
