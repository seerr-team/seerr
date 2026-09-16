import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailureReasonToMediaRequest1788991020650 implements MigrationInterface {
  name = 'AddFailureReasonToMediaRequest1788991020650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "failureReason" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "failureReason"`
    );
  }
}
