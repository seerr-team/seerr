import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatarCacheFields1743107707465
  implements MigrationInterface
{
  name = 'AddUserAvatarCacheFields1743107707465';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarETag" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarVersion" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarVersion"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarETag"`);
  }
}
