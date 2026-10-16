import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterDiscoverSliderDataToText1789300000000
  implements MigrationInterface
{
  name = 'AlterDiscoverSliderDataToText1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discover_slider" RENAME TO "discover_slider_old"`
    );

    await queryRunner.query(`
      CREATE TABLE "discover_slider" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "type" integer NOT NULL,
        "order" integer NOT NULL,
        "isBuiltIn" boolean NOT NULL DEFAULT (0),
        "enabled" boolean NOT NULL DEFAULT (1),
        "title" varchar,
        "data" text,
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "discover_slider" (
        "id",
        "type",
        "order",
        "isBuiltIn",
        "enabled",
        "title",
        "data",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        "type",
        "order",
        "isBuiltIn",
        "enabled",
        "title",
        "data",
        "createdAt",
        "updatedAt"
      FROM "discover_slider_old"
    `);

    await queryRunner.query(`DROP TABLE "discover_slider_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discover_slider" RENAME TO "discover_slider_old"`
    );

    await queryRunner.query(`
      CREATE TABLE "discover_slider" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "type" integer NOT NULL,
        "order" integer NOT NULL,
        "isBuiltIn" boolean NOT NULL DEFAULT (0),
        "enabled" boolean NOT NULL DEFAULT (1),
        "title" varchar,
        "data" varchar,
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "discover_slider" (
        "id",
        "type",
        "order",
        "isBuiltIn",
        "enabled",
        "title",
        "data",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        "type",
        "order",
        "isBuiltIn",
        "enabled",
        "title",
        "data",
        "createdAt",
        "updatedAt"
      FROM "discover_slider_old"
    `);

    await queryRunner.query(`DROP TABLE "discover_slider_old"`);
  }
}
