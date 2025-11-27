import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlacklistTagsColumn1737320080282 implements MigrationInterface {
  name = 'AddBlacklistTagsColumn1737320080282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD blacklistedTags character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP COLUMN blacklistedTags`
    );
  }
}
