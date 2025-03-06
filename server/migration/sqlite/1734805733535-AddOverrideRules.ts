import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverrideRules1734805733535 implements MigrationInterface {
  name = 'AddOverrideRules1734805733535';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "override_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "lidarrServiceId" integer, "users" varchar, "genre" varchar, "language" varchar, "keywords" varchar, "profileId" integer, "rootFolder" varchar, "tags" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "override_rule"`);
  }
}
