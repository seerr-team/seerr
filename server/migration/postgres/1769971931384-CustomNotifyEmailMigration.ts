import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomNotifyEmailMigration1769971931384 implements MigrationInterface {
  name = 'CustomNotifyEmailMigration1769971931384';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "notifyEmail" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "notifyEmail"`
    );
  }
}
