import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIgnoreQuotaToMediaRequest1760028688313
  implements MigrationInterface
{
  name = 'AddIgnoreQuotaToMediaRequest1760028688313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "ignoreQuota" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "ignoreQuota"`
    );
  }
}
