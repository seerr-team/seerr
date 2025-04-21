import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexProfilesSupport1745265825619 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1745265825619';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isPlexProfile" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "mainPlexUserId" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mainPlexUserId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isPlexProfile"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexProfileId"`);
  }
}
