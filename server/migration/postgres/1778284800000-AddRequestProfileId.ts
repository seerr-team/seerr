import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestProfileId1778284800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD COLUMN IF NOT EXISTS "requestProfileId" integer NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN IF EXISTS "requestProfileId"`
    );
  }
}
