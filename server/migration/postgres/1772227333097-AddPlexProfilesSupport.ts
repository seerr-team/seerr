import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexProfilesSupport1772227333097 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1772227333097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileNumericId" integer`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "mainPlexUserId" integer`);
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
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mainPlexUserId"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "plexProfileNumericId"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexProfileId"`);
  }
}
