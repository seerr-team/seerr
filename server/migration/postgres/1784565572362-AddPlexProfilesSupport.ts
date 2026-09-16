import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexProfilesSupport1784565572362 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1784565572362';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileNumericId" integer`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "mainPlexUserId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mainPlexUserId"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "plexProfileNumericId"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexProfileId"`);
  }
}
