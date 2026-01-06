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
      `CREATE UNIQUE INDEX "UQ_6427d07d9a171a3a1ab87480005" ON "user_push_subscription" ("endpoint", "userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_6427d07d9a171a3a1ab87480005"`);
  }
}
