import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestDeclinedMessage1781992427522 implements MigrationInterface {
  name = 'AddRequestDeclinedMessage1781992427522';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "declineReason" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "declineReason"`
    );
  }
}
