import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexProfilesSupport1745265840052 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1745265840052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD "userAgent" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD "createdAt" TIMESTAMP DEFAULT now()`
    );
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
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth")`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP COLUMN "blacklistedTags"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarVersion"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarETag"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "mainPlexUserId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isPlexProfile"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexProfileId"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP COLUMN "createdAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP COLUMN "userAgent"`
    );
  }
}
