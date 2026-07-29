import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlocklistGenresColumn1785336641330 implements MigrationInterface {
  name = 'AddBlocklistGenresColumn1785336641330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD "blocklistedGenres" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP COLUMN "blocklistedGenres"`
    );
  }
}
