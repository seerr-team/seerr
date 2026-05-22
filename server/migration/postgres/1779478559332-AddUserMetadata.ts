import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserMetadata1779478559332 implements MigrationInterface {
  name = 'AddUserMetadata1779478559332';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_metadata" ADD "isSensitive" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_metadata" DROP COLUMN "isSensitive"`
    );
  }
}
