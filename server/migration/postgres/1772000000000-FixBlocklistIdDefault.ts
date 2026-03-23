import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FixBlocklistIdDefault1772000000000 implements MigrationInterface {
  name = 'FixBlocklistIdDefault1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('public."blocklist_id_seq"'::regclass)`
    );

    await queryRunner.query(
      `SELECT setval('public."blocklist_id_seq"', COALESCE((SELECT MAX("id") FROM "blocklist"), 0) + 1, false)`
    );
  }

  public async down(): Promise<void> {
    // Intentionally left empty: dropping the DEFAULT on blocklist.id would
    // reintroduce the original bug and break blocklist inserts.
  }
}
