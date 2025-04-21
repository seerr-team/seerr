import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexProfilesSupport1745254842580 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1745254842580';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexProfileId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isPlexProfile" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "mainPlexUserId" integer`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarETag" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarVersion" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD "blacklistedTags" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP COLUMN "blacklistedTags"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarVersion"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarETag"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mainPlexUserId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isPlexProfile"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexProfileId"`);
  }
}
