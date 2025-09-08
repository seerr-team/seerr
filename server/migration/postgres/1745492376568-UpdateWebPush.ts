import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWebPush1745492376568 implements MigrationInterface {
  name = 'UpdateWebPush1745492376568';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME COLUMN "blacklistedtags" TO "blacklistedTags"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME COLUMN "blacklistedTags" TO "blacklistedtags"`
    );
  }
}
