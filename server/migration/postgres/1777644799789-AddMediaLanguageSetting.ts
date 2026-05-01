import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaLanguageSetting1777644799789 implements MigrationInterface {
  name = 'AddMediaLanguageSetting1777644799789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "mediaLocale" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "mediaLocale"`
    );
  }
}
