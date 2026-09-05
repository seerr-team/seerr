import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCertificationToOverrideRules1785245659122 implements MigrationInterface {
  name = 'AddCertificationToOverrideRules1785245659122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_override_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "users" varchar, "genre" varchar, "language" varchar, "keywords" varchar, "profileId" integer, "rootFolder" varchar, "tags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "certification" varchar)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_override_rule"("id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt") SELECT "id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt" FROM "override_rule"`
    );
    await queryRunner.query(`DROP TABLE "override_rule"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_override_rule" RENAME TO "override_rule"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "override_rule" RENAME TO "temporary_override_rule"`
    );
    await queryRunner.query(
      `CREATE TABLE "override_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "users" varchar, "genre" varchar, "language" varchar, "keywords" varchar, "profileId" integer, "rootFolder" varchar, "tags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`
    );
    await queryRunner.query(
      `INSERT INTO "override_rule"("id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt") SELECT "id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt" FROM "temporary_override_rule"`
    );
    await queryRunner.query(`DROP TABLE "temporary_override_rule"`);
  }
}
