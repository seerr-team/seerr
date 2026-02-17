import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationApprise1771353857398 implements MigrationInterface {
  name = 'NotificationApprise1771353857398';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "appriseTags" character varying`
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "blocklist_id_seq" OWNED BY "blocklist"."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('"blocklist_id_seq"')`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`DROP SEQUENCE "blocklist_id_seq"`);
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "appriseTags"`
    );
  }
}
