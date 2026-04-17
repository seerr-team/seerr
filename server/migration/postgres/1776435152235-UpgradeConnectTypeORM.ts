import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeConnectTypeORM1776435152235 implements MigrationInterface {
  name = 'UpgradeConnectTypeORM1776435152235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" ADD "destroyedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "destroyedAt"`);
  }
}
