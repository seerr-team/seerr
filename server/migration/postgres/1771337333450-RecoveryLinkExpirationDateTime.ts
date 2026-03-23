import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RecoveryLinkExpirationDateTime1771337333450 implements MigrationInterface {
  name = 'RecoveryLinkExpirationDateTime1771337333450';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "recoveryLinkExpirationDate" TYPE TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "recoveryLinkExpirationDate" TYPE date USING ("recoveryLinkExpirationDate"::date)`
    );
  }
}
