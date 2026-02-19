import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSettingsExcludedWatchProviders1771722789735
  implements MigrationInterface
{
  name = 'AddUserSettingsExcludedWatchProviders1771722789735';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "excludedWatchProviders" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "excludedWatchProviders"`
    );
  }
}
