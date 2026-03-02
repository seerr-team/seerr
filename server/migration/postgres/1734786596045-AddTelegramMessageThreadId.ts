import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramMessageThreadId1734786596045 implements MigrationInterface {
  name = 'AddTelegramMessageThreadId1734786596045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "telegramMessageThreadId" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "telegramMessageThreadId"`
    );
  }
}
