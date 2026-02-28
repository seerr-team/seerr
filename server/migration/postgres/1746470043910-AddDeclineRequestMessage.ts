import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeclineRequestMessage1746470043910
  implements MigrationInterface
{
  name = 'AddDeclineRequestMessage1746470043910';

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
