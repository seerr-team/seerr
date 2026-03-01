import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1770627987304 implements MigrationInterface {
  name = 'AddPerformanceIndexes1770627987304';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_4c696e8ed36ae34fe18abe59d2" ON "media_request" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c730c2d67f271a372c39a07b7e" ON "media" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d6218de4f547909391a5c1347" ON "media" ("status4k") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8233358694d1677a67899b90a" ON "media" ("tmdbId", "mediaType") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8233358694d1677a67899b90a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d6218de4f547909391a5c1347"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c730c2d67f271a372c39a07b7e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c696e8ed36ae34fe18abe59d2"`
    );
  }
}
