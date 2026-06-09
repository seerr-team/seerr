import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchAutomaticallyColumn1780982504352 implements MigrationInterface {
  name = 'AddSearchAutomaticallyColumn1780982504352';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "searchAutomatically" boolean`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "searchAutomatically"`
    );
  }
}
