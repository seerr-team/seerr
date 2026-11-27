import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserApiKeyHash1792348651934 implements MigrationInterface {
  name = 'AddUserApiKeyHash1792348651934';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "apiKeyHash" varchar`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fa5a2d13c60c9ec6f04637de8e" ON "user_settings" ("apiKeyHash") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_fa5a2d13c60c9ec6f04637de8e"`);
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "apiKeyHash"`
    );
  }
}
