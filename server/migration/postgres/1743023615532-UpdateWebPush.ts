import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWebPush1743023615532 implements MigrationInterface {
  name = 'UpdateWebPush1743023615532';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD "userAgent" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD "createdAt" TIMESTAMP DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth")`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP COLUMN "createdAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP COLUMN "userAgent"`
    );
  }
}
