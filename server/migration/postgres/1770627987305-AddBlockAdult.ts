import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockAdult1770627987305 implements MigrationInterface {
  name = 'AddBlockAdult1770627987305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blockAdult" boolean DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "blockAdult"`
    );
  }
}
