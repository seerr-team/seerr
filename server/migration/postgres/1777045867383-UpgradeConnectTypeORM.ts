import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeConnectTypeORM1777045867383 implements MigrationInterface {
  name = 'UpgradeConnectTypeORM1777045867383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" ADD "destroyedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "destroyedAt"`);
  }
}
