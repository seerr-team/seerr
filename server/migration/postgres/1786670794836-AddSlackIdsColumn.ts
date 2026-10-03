import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlackIdsColumn1786670794836 implements MigrationInterface {
  name = 'AddSlackIdsColumn1786670794836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" ADD "slackIds" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "slackIds"`
    );
  }
}
