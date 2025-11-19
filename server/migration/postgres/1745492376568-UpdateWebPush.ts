import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWebPush1745492376568 implements MigrationInterface {
  name = 'UpdateWebPush1745492376568';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME COLUMN "blocklistedtags" TO "blocklistedTags"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME COLUMN "blocklistedTags" TO "blocklistedtags"`
    );
  }
}
