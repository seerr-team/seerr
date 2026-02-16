import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBlacklistToBlocklist1771080196816 implements MigrationInterface {
  name = 'RenameBlacklistToBlocklist1771080196816';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blacklist" RENAME TO "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME COLUMN "blacklistedTags" TO "blocklistedTags"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME COLUMN "blocklistedTags" TO "blacklistedTags"`
    );
    await queryRunner.query(`ALTER TABLE "blocklist" RENAME TO "blacklist"`);
  }
}
