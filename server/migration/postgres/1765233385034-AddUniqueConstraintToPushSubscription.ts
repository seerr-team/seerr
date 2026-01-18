import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToPushSubscription1765233385034
  implements MigrationInterface
{
  name = 'AddUniqueConstraintToPushSubscription1765233385034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_push_subscription"
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM "user_push_subscription"
        GROUP BY "endpoint", "userId"
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005"`
    );
  }
}
