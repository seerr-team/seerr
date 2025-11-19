import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlocklistTagsColumn1737320080282 implements MigrationInterface {
  name = 'AddBlocklistTagsColumn1737320080282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD blocklistedTags character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP COLUMN blocklistedTags`
    );
  }
}
